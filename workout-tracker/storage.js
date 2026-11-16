// Local copies and deletion markers are scoped to the immutable GitHub repository ID.
const prefix = 'workout-tracker:v1:';
const endpoint = 'https://api.github.com';
const journalFile = 'tracker/journal-v1.json';
const recordTypes = new Set(['workout', 'meal', 'weight', 'prayer']);
const emptyState = () => ({ rows: [], lastSync: null });
const device = { scope: 'device', repository: '' };
const emit = () => window.dispatchEvent(new Event('tracker-change'));

function preference(store, key) {
  try { return JSON.parse(store.getItem(prefix + key)); } catch { return null; }
}

function writePreference(store, key, value) {
  try {
    if (value === null) store.removeItem(prefix + key);
    else store.setItem(prefix + key, JSON.stringify(value));
  } catch { /* Browser preferences are optional. Record writes report storage errors. */ }
}

const savedSession = preference(sessionStorage, 'session') || preference(localStorage, 'remembered-connection');
let profile = savedSession?.profile || preference(localStorage, 'profile') || device;
let credential = savedSession?.token || '';
let issue = '';
let syncing = false;
let running = null;
let again = false;
let timer;

function read(scope = profile.scope) {
  const raw = localStorage.getItem(prefix + 'journal:' + scope);
  if (raw === null) return emptyState();
  const state = JSON.parse(raw);
  if (!Array.isArray(state.rows)) throw new Error('The saved journal could not be opened on this device.');
  return state;
}

function write(scope, state) {
  try { localStorage.setItem(prefix + 'journal:' + scope, JSON.stringify(state)); }
  catch { throw new Error('This browser could not save your entries. Check available storage and try again.'); }
}

function locked(action) {
  return navigator.locks ? navigator.locks.request(prefix + 'write', action) : Promise.resolve().then(action);
}

function latest(rows) {
  return new Map(rows.map(row => [row.id, row]));
}

function newer(a, b) {
  return a.time > b.time || (a.time === b.time && a.rev > b.rev);
}

function validEntry(entry) {
  return entry && typeof entry.id === 'string' && entry.id.length > 0 &&
    recordTypes.has(entry.type) && /^\d{4}-\d{2}-\d{2}$/.test(entry.date);
}

export function getRecords() {
  return read().rows.filter(row => row.entry).map(row => row.entry);
}

export function getUnit() {
  return preference(localStorage, 'unit') === 'lb' ? 'lb' : 'kg';
}

export function setUnit(unit) {
  if (!['lb', 'kg'].includes(unit)) return;
  writePreference(localStorage, 'unit', unit);
  emit();
}

async function mutate(id, entry) {
  const scope = profile.scope;
  await locked(() => {
    const state = read(scope);
    const rows = latest(state.rows);
    const old = rows.get(id);
    if (entry === null && !old?.entry) return;
    const time = Math.max(Date.now(), (old?.time || 0) + 1);
    rows.set(id, { id, entry, time, rev: crypto.randomUUID(), dirty: true });
    write(scope, { ...state, rows: [...rows.values()] });
  });
  emit();
  schedule();
}

export function saveRecord(entry) {
  if (!validEntry(entry)) throw new Error('A record needs a valid type, ID, and date.');
  return mutate(entry.id, entry);
}

export function deleteRecord(id) {
  return mutate(id, null);
}

export function getSyncStatus() {
  const { rows, lastSync } = read();
  const pending = rows.filter(row => row.dirty).length;
  const connected = !!credential && profile.scope !== device.scope;
  let label = 'Device only';
  if (profile.scope !== device.scope) {
    if (!credential) label = 'Reconnect';
    else if (syncing) label = 'Syncing…';
    else if (navigator.onLine === false) label = 'Offline';
    else if (issue) label = 'Sync paused';
    else if (pending || !lastSync) label = 'Pending sync';
    else label = 'Synced';
  }
  return { label, connected, pending, lastSync, issue, repository: profile.repository, syncing };
}

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Restrict every authenticated request to the GitHub API, including redirects.
async function api(path, token, { method = 'GET', body, raw = false } = {}) {
  let response;
  try {
    response = await fetch(endpoint + path, {
      method, mode: 'cors', credentials: 'omit', redirect: 'error', cache: 'no-store',
      referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(25000),
      headers: {
        Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
        Authorization: 'Bearer ' + token,
        ...(body && { 'Content-Type': 'application/json' })
      },
      ...(body && { body: JSON.stringify(body) })
    });
  } catch {
    throw new Error('GitHub could not be reached. Your entries are saved on this device.');
  }
  if (!response.ok) {
    const messages = {
      401: 'The token has expired or was rejected. Reconnect with a new fine-grained token.',
      403: 'GitHub denied this request. Check token permissions and GitHub API limits.',
      404: 'The repository could not be found. Check its name and the repositories selected for the token.',
      409: 'Another device changed the journal. Retry sync.',
      422: 'GitHub could not write the journal. Check branch rules and Contents write access.'
    };
    throw new ApiError(response.status, messages[response.status] || 'GitHub could not complete this request. Try syncing again.');
  }
  return raw ? response.text() : response.json();
}

function repoPath(repository) {
  if (!/^[a-z\d-]+\/[a-z\d_.-]+$/i.test(repository) || ['.', '..'].includes(repository.split('/')[1]))
    throw new Error('Enter the repository in owner/name format.');
  return '/repos/' + repository;
}

async function checkRepo(repository, token, expected) {
  const meta = await api(repoPath(repository), token);
  if (meta.private !== true || meta.visibility === 'internal' || meta.fork)
    throw new Error('Choose a private, personal repository that you own. A standalone repository keeps journal history separate.');
  if (meta.archived || meta.disabled) throw new Error('This repository is read-only. Choose an active private repository.');
  if (expected && String(meta.id) !== expected) throw new Error('This repository changed. Reconnect before syncing.');
  return meta;
}

function pack(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}

function unpack(content) {
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(content), c => c.charCodeAt(0)));
}

async function loadRemote(meta, token) {
  const base = repoPath(meta.full_name);
  const path = base + '/contents/' + journalFile;
  let file;
  try { file = await api(path + '?ref=' + encodeURIComponent(meta.default_branch), token); }
  catch (e) { if (e.status === 404) return { rows: [], sha: null }; throw e; }
  const invalid = 'The online file is not a compatible journal. Your local entries are safe.';
  if (file.type !== 'file' || !/^[a-f0-9]{40,64}$/i.test(file.sha)) throw new Error(invalid);
  let json;
  try {
    const content = file.encoding === 'base64' ? unpack(file.content) :
      await api(base + '/git/blobs/' + file.sha, token, { raw: true });
    json = JSON.parse(content);
  } catch (e) { if (e instanceof ApiError) throw e; throw new Error(invalid); }
  if (json?.version !== 1 || !Array.isArray(json.rows)) throw new Error(invalid);
  const ids = new Set();
  const rows = json.rows.map(row => {
    if (!row || typeof row.id !== 'string' || ids.has(row.id) || !Number.isSafeInteger(row.time) ||
      typeof row.rev !== 'string' || !(row.entry === null || (validEntry(row.entry) && row.entry.id === row.id)))
      throw new Error(invalid);
    ids.add(row.id);
    return { id: row.id, time: row.time, rev: row.rev, entry: row.entry };
  });
  return { rows, sha: file.sha };
}

function merge(remote, local) {
  const rows = latest(remote);
  let changed = false;
  for (const { id, entry, rev, time } of local) {
    const online = rows.get(id);
    if (!online || newer({ time, rev }, online)) {
      rows.set(id, { id, entry, rev, time });
      changed = true;
    }
  }
  return { rows: [...rows.values()], changed };
}

async function exchange(active, token) {
  // A private repo can change visibility between visits. Check before each sync.
  for (let attempt = 0; attempt < 4; attempt++) {
    const meta = await checkRepo(active.repository, token, active.scope);
    const remote = await loadRemote(meta, token);
    const merged = merge(remote.rows, read(active.scope).rows);
    if (active !== profile || token !== credential) return;
    if (merged.changed) {
      try {
        await api(repoPath(meta.full_name) + '/contents/' + journalFile, token, {
          method: 'PUT', body: {
            message: 'Sync journal', branch: meta.default_branch,
            ...(remote.sha && { sha: remote.sha }),
            content: pack(JSON.stringify({ version: 1, rows: merged.rows }))
          }
        });
      } catch (e) {
        if ((e.status === 409 || e.status === 422) && attempt < 3) continue;
        throw e;
      }
    }
    await locked(() => {
      // Edits made during the network round trip stay dirty for the next pass.
      const confirmed = latest(merged.rows);
      for (const row of read(active.scope).rows) {
        const online = confirmed.get(row.id);
        if (!online || newer(row, online)) confirmed.set(row.id, row);
      }
      write(active.scope, { rows: [...confirmed.values()], lastSync: Date.now() });
    });
    return;
  }
}

export function syncNow() {
  if (!credential || profile.scope === device.scope) return Promise.resolve(false);
  if (running) { again = true; return running; }
  const active = profile;
  const token = credential;
  syncing = true;
  issue = '';
  emit();
  running = (async () => {
    try {
      do {
        again = false;
        await exchange(active, token);
      } while (active === profile && token === credential && (again || read(active.scope).rows.some(row => row.dirty)));
      return true;
    } catch (e) {
      if (active === profile) {
        issue = e.message;
        if (e.status === 401) {
          if (preference(localStorage, 'remembered-connection')?.token === token)
            writePreference(localStorage, 'remembered-connection', null);
          credential = '';
          writePreference(sessionStorage, 'session', { profile });
        }
      }
      return false;
    } finally {
      running = null;
      syncing = false;
      emit();
    }
  })();
  return running;
}

function schedule(delay = 420) {
  clearTimeout(timer);
  if (credential) timer = setTimeout(() => { void syncNow(); }, delay);
}

export async function connectSync({ repository, token, includeLocal, remember = false }) {
  repository = repository.trim();
  token = token.trim();
  if (!token.startsWith('github_pat_')) throw new Error('Use a fine-grained personal access token from GitHub.');
  if (running) await running;
  const user = await api('/user', token);
  const fullName = repository.includes('/') ? repository : user.login + '/' + repository;
  const meta = await checkRepo(fullName, token);
  if (meta.owner?.id !== user.id) throw new Error('Use a private repository owned by the account that created this token.');
  await loadRemote(meta, token);
  const next = { scope: String(meta.id), repository: meta.full_name };
  await locked(() => {
    if (includeLocal && profile.scope === device.scope) {
      // Writing the destination first makes interrupted transfers retryable.
      const from = read(device.scope);
      const to = read(next.scope);
      const rows = latest(to.rows);
      for (const row of from.rows) {
        if (row.entry && (!rows.has(row.id) || newer(row, rows.get(row.id)))) rows.set(row.id, row);
      }
      write(next.scope, { ...to, rows: [...rows.values()] });
      write(device.scope, emptyState());
    }
  });
  profile = next;
  credential = token;
  issue = '';
  writePreference(localStorage, 'profile', profile);
  writePreference(localStorage, 'remembered-connection', remember === true ? { profile, token } : null);
  writePreference(sessionStorage, 'session', { profile, token });
  await syncNow();
}

export async function disconnectSync() {
  if (running) await running;
  if (preference(localStorage, 'remembered-connection')?.profile.scope === profile.scope)
    writePreference(localStorage, 'remembered-connection', null);
  if (preference(localStorage, 'profile')?.scope === profile.scope)
    writePreference(localStorage, 'profile', null);
  profile = device;
  credential = '';
  issue = '';
  writePreference(sessionStorage, 'session', null);
  emit();
}

window.addEventListener('online', () => { emit(); schedule(0); });
window.addEventListener('offline', emit);
window.addEventListener('storage', event => {
  if (event.key === prefix + 'remembered-connection' && event.oldValue) {
    const previous = JSON.parse(event.oldValue);
    const replacement = preference(localStorage, 'remembered-connection');
    if (previous.token === credential && (replacement?.token !== credential || replacement?.profile.scope !== profile.scope)) {
      credential = '';
      issue = '';
      writePreference(sessionStorage, 'session', { profile });
      emit();
    }
  }
  if (event.key === prefix + 'journal:' + profile.scope || event.key === prefix + 'unit') emit();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') schedule(0);
});
setInterval(() => { if (document.visibilityState === 'visible') schedule(0); }, 120000);
schedule(0);
