import { connectSync, disconnectSync, getRecords, getSyncStatus, syncNow } from './storage.js';

export function openSync() {
  const existing = document.querySelector('dialog.tracker-sync');
  if (existing) { existing.focus(); return; }
  const dialog = document.createElement('dialog');
  dialog.className = 'tracker-sync';
  dialog.setAttribute('aria-labelledby', 'tracker-sync-title');
  dialog.innerHTML = `
    <header class="sync-heading">
      <h2 id="tracker-sync-title">Online sync</h2>
      <button class="sync-close" type="button" aria-label="Close sync settings">×</button>
    </header>
    <div class="sync-body">
      <p class="sync-intro">Keep your journal in a private GitHub repository and open it on your other devices.</p>
      <section class="sync-connection" aria-live="polite">
        <strong class="sync-state"></strong>
        <span class="sync-detail"></span>
        <p class="sync-issue"></p>
      </section>
      <form class="sync-setup">
        <details class="sync-guide">
          <summary>Set up a private journal</summary>
          <ol>
            <li>Use your private <strong>daymark-journal</strong> repository. If you need one, <a href="https://github.com/new" target="_blank" rel="noopener noreferrer">create a private repository</a> and add a README.</li>
            <li><a href="https://github.com/settings/personal-access-tokens/new?name=Personal+journal+sync&amp;contents=write" target="_blank" rel="noopener noreferrer">Create a fine-grained token</a>. Under <strong>Only select repositories</strong>, choose your private journal. Give <strong>Contents</strong> read and write access.</li>
            <li>Enter the repository name and token below. On another device, connect to the same repository.</li>
          </ol>
        </details>
        <label>Private repository
          <input name="repository" type="text" required spellcheck="false" autocapitalize="none" autocomplete="off" placeholder="daymark-journal">
        </label>
        <label>Fine-grained token
          <input name="token" type="password" required spellcheck="false" autocomplete="off" placeholder="github_pat_…" aria-describedby="sync-token-hint">
        </label>
        <small id="sync-token-hint">By default, the connection lasts for this tab. Remembering it saves the token in this browser until you disconnect.</small>
        <label class="sync-include"><input name="remember" type="checkbox">Remember connection on this personal device</label>
        <label class="sync-include sync-migrate"><input name="includeLocal" type="checkbox" checked><span></span></label>
        <p class="sync-feedback" role="alert"></p>
        <button class="sync-primary" type="submit">Connect journal</button>
      </form>
      <div class="sync-manage" hidden>
        <p>Changes save on this device and sync while the journal is open. GitHub keeps earlier versions in the repository history.</p>
        <div class="sync-actions">
          <button type="button" class="sync-primary sync-refresh">Sync now</button>
          <button type="button" class="sync-secondary sync-disconnect">Disconnect journal</button>
        </div>
      </div>
    </div>`;
  const find = selector => dialog.querySelector(selector);
  const form = find('.sync-setup');
  const repositoryInput = form.elements.repository;
  const tokenInput = form.elements.token;
  const include = find('.sync-migrate');
  const current = getSyncStatus();
  repositoryInput.value = current.repository || 'daymark-journal';
  find('.sync-guide').open = !current.repository;
  const refresh = find('.sync-refresh');
  const disconnect = find('.sync-disconnect');
  const submit = form.querySelector('[type=submit]');
  let processing = false;

  function update() {
    const status = getSyncStatus();
    find('.sync-state').textContent = status.label;
    const count = getRecords().length;
    let detail = count === 1 ? '1 entry on this device' : count + ' entries on this device';
    if (status.repository) {
      detail = status.repository;
      if (status.pending) detail += ' · ' + status.pending + ' pending';
      else if (status.lastSync) detail += ' · Last synced ' + new Date(status.lastSync).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
    find('.sync-detail').textContent = detail;
    const problem = find('.sync-issue');
    problem.textContent = status.issue;
    problem.hidden = !status.issue;
    form.hidden = status.connected;
    find('.sync-manage').hidden = !status.connected;
    include.hidden = Boolean(status.repository) || !count;
    include.querySelector('span').textContent = count === 1 ? 'Move my device entry into this journal' : 'Move my ' + count + ' device entries into this journal';
    refresh.disabled = status.syncing || processing;
    disconnect.disabled = status.syncing || processing;
    submit.disabled = processing;
    submit.textContent = processing ? 'Connecting…' : (status.repository ? 'Reconnect journal' : 'Connect journal');
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (processing) return;
    const feedback = find('.sync-feedback');
    feedback.textContent = '';
    processing = true;
    update();
    try {
      await connectSync({
        repository: repositoryInput.value, token: tokenInput.value,
        includeLocal: !include.hidden && form.elements.includeLocal.checked,
        remember: form.elements.remember.checked
      });
      tokenInput.value = '';
    } catch (e) { feedback.textContent = e.message; }
    finally { processing = false; update(); }
  });
  refresh.addEventListener('click', () => { void syncNow(); });
  disconnect.addEventListener('click', async () => {
    await disconnectSync();
    repositoryInput.value = 'daymark-journal';
    tokenInput.value = '';
    form.elements.remember.checked = false;
    find('.sync-guide').open = true;
    update();
  });
  find('.sync-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    tokenInput.value = '';
    window.removeEventListener('tracker-change', update);
    dialog.remove();
  }, { once: true });
  window.addEventListener('tracker-change', update);
  document.body.appendChild(dialog);
  update();
  dialog.showModal();
}
