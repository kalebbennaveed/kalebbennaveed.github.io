import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createGate, createDrone } from "./models.js?v=devquad-1";
import { createFlyLabRoom } from "./flylab-room.js";
import {
  addPositionBounds,
  addSweptBounds,
  addDroneEnvelope,
  addCurrentBound,
} from "./uncertainty.js";
import { addRejectionBox, addEventMarker } from "./rejection.js?v=contact-2";
import { candidateDecision, activeCommitment } from "./decision-state.js";
import { drawTubeProfile } from "./tube-profile.js";
import { drawFlightDiagnostics } from "./flight-diagnostics.js?v=devquad-flight-2";
import { scenarios, scenarioFor } from "./scenarios.js?v=devquad-full-45";

const $ = (id) => document.getElementById(id),
  num = (x, n = 2) => (Number.isFinite(x) ? x.toFixed(n) : "—");
const colors = {
  nominal: 0xedba74,
  active: 0x71e2db,
  candidate: 0xc6b4ff,
  flown: 0xdce5ef,
};
let environment,
  entries,
  record,
  time = 0,
  selected = 0,
  tubeTime = 2.5,
  playing = false,
  evolving = false;
let request = 0,
  epochIndex = -1,
  lastFrame = 0,
  lastUpdate = 0,
  cameraMode = "orbit",
  anchor = null;
const scene = new THREE.Scene();
scene.background = new THREE.Color("#242831");
const camera = new THREE.PerspectiveCamera(42, 1, 0.02, 160);
camera.up.set(0, 0, 1);
const renderer = new THREE.WebGLRenderer({
  canvas: $("scene"),
  antialias: true,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const controls = new OrbitControls(camera, $("scene"));
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xe2ecff, 0x333944, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 2.7);
sun.position.set(-10, -7, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {
  left: -25,
  right: 25,
  top: 25,
  bottom: -25,
  far: 60,
});
scene.add(sun);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(90, 90),
  new THREE.MeshStandardMaterial({ color: 0x343843, roughness: 0.95 }),
);
ground.receiveShadow = true;
ground.position.z = -0.02;
scene.add(ground);
const course = new THREE.Group(),
  paths = new THREE.Group(),
  trailGroup = new THREE.Group();
scene.add(course, paths, trailGroup);
const drone = createDrone();
scene.add(drone);
let room, route;
function clear(group) {
  group.traverse((child) => {
    child.geometry?.dispose();
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    materials.forEach((m) => m?.dispose());
  });
  group.clear();
}
function line(parent, points, color, { dashed = false, opacity = 1 } = {}) {
  if (!points?.length) return;
  const geometry = new THREE.BufferGeometry().setFromPoints(
    points.map((p) => new THREE.Vector3(...p)),
  );
  const material = dashed
    ? new THREE.LineDashedMaterial({
        color,
        dashSize: 0.12,
        gapSize: 0.1,
        transparent: true,
        opacity,
        toneMapped: false,
      })
    : new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity,
        toneMapped: false,
      });
  const l = new THREE.Line(geometry, material);
  if (dashed) l.computeLineDistances();
  parent.add(l);
  return l;
}
function currentEpoch() {
  let i = 0;
  while (
    i + 1 < record.epochs.length &&
    record.epochs[i + 1].time <= time + 1e-8
  )
    i++;
  return [record.epochs[i], i];
}
function sampleAt(t) {
  let a = 0,
    b = record.samples.length - 1;
  while (a < b) {
    const m = Math.ceil((a + b) / 2);
    if (record.samples[m].time <= t) a = m;
    else b = m - 1;
  }
  const s = record.samples[a],
    next = record.samples[Math.min(a + 1, record.samples.length - 1)];
  const f = next.time > s.time ? (t - s.time) / (next.time - s.time) : 0;
  const p = new THREE.Vector3(...s.state.slice(0, 3)).lerp(
    new THREE.Vector3(...next.state.slice(0, 3)),
    f,
  );
  const q = (s) =>
    new THREE.Quaternion(s.state[7], s.state[8], s.state[9], s.state[6]);
  return { sample: s, index: a, p, q: q(s).slerp(q(next), f) };
}
function fit(points) {
  const box = new THREE.Box3();
  points
    .filter((p) => p?.every(Number.isFinite))
    .forEach((p) => box.expandByPoint(new THREE.Vector3(...p)));
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3()),
    size = box.getSize(new THREE.Vector3()).length();
  controls.target.copy(center);
  camera.position
    .copy(center)
    .add(
      new THREE.Vector3(0.65, -1, 0.7)
        .normalize()
        .multiplyScalar(Math.max(1, (size * 1.2) / Math.min(camera.aspect, 1))),
    );
  camera.lookAt(center);
  controls.update();
  anchor = null;
}
function resetCamera(mode = cameraMode) {
  cameraMode = mode;
  anchor = null;
  if (mode === "follow" || mode === "drone") {
    controls.target.copy(drone.position);
    camera.position
      .copy(drone.position)
      .add(
        new THREE.Vector3(
          ...(mode === "drone" ? [0.32, -0.52, 0.27] : [-1.3, -1.8, 0.9]),
        ),
      );
    anchor = drone.position.clone();
  } else {
    fit(record.track.centerline);
    if (mode === "top") {
      camera.position
        .copy(controls.target)
        .add(
          new THREE.Vector3(
            0,
            -0.01,
            Math.max(12, camera.position.distanceTo(controls.target)),
          ),
        );
    }
  }
  controls.update();
  document
    .querySelectorAll("[data-camera]")
    .forEach((b) => b.classList.toggle("active", b.dataset.camera === mode));
}
function resize() {
  const r = $("scene").getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
  if (record) charts();
}
new ResizeObserver(resize).observe($("scene").parentElement);
function charts() {
  drawFlightDiagnostics(record, time);
  if (record.gatekeeper_enabled) {
    const [e] = currentEpoch();
    drawTubeProfile(
      e.candidates[selected]?.position_bounds,
      tubeTime,
      record.dt,
    );
  }
}
function timing(e) {
  const rows = [
    ["MPPI", e.computation.planner_ms],
    ["Candidate generation", e.computation.candidate_generation_ms],
    ["Reachable sets", e.computation.reachable_tubes_ms],
    ["Tube clearance checks", e.computation.geometry_checks_ms],
    ["Selection and dispatch", e.computation.selection_and_dispatch_ms],
    ["Total", e.computation.total_ms],
  ];
  $("timing").replaceChildren(
    ...rows.flatMap(([name, value]) => {
      const dt = document.createElement("dt"),
        dd = document.createElement("dd");
      dt.textContent = name;
      dd.textContent = `${num(value, 1)} ms`;
      return [dt, dd];
    }),
  );
}
function decisions(e, index) {
  $("update-time").textContent = `Update ${index + 1} · ${num(e.time)} s`;
  timing(e);
  if (!record.gatekeeper_enabled) {
    $("active-title").textContent =
      e.selection.index === null
        ? "Previous MPPI reference retained"
        : "MPPI reference applied";
    $("active-detail").textContent =
      e.selection.index === null
        ? "The optimizer did not find a feasible replacement. No reachable-set check was run."
        : "The neural controller executes the planner’s reference directly. Gatekeeper is disabled.";
    return;
  }
  const active = activeCommitment(e, time);
  $("active-title").textContent = active.label;
  $("active-detail").textContent = active.detail;
  $("candidate-buttons").replaceChildren(
    ...e.candidates.map((c, i) => {
      const state = candidateDecision(e, i),
        b = document.createElement("button");
      b.className =
        (state.kind === "committed"
          ? "committed"
          : state.kind === "passed"
            ? "passed"
            : "rejected") + (i === selected ? " active" : "");
      b.setAttribute("aria-pressed", String(i === selected));
      b.textContent =
        c.switch_seconds === 0
          ? "Backup immediately"
          : `${c.switch_seconds.toFixed(1)} s racing`;
      const small = document.createElement("small");
      small.textContent = state.label;
      b.append(small);
      b.onclick = () => {
        selected = i;
        tubeTime = record.horizon || 2.5;
        evolving = false;
        drawPaths();
      };
      return b;
    }),
  );
  const c = e.candidates[selected],
    state = candidateDecision(e, selected);
  $("candidate-status").textContent = `${state.label} · ${state.detail}`;
  const failure = c.rejection;
  $("focus-failure").disabled = !failure;
  $("failure-detail").textContent = failure
    ? failure.region_validated
      ? `At +${num(failure.time_offset)} s: clearance from ${failure.obstacle || "an obstacle"} was not established.`
      : `At +${num(failure.time_offset)} s: propagation could not establish the next set. The red cross marks the predicted position at that time; it is not a collision or an uncertainty boundary.`
    : "The complete candidate tube passed the recorded checks.";
}
function drawPaths() {
  if (!record) return;
  const [e, index] = currentEpoch();
  selected = Math.min(selected, e.candidates.length - 1);
  clear(paths);
  if ($("show-nominal").checked)
    line(paths, e.nominal, colors.nominal, { opacity: 0.85 });
  if ($("show-active").checked && e.commitment) {
    const c = e.commitment;
    line(
      paths,
      c.points.slice(
        Math.max(0, Math.floor((time - c.start_time) / record.dt)),
      ),
      colors.active,
    );
  }
  if (record.gatekeeper_enabled) {
    const c = e.candidates[selected],
      bounds = c.position_bounds;
    const horizon = (c.points.length - 1) * record.dt,
      end = e.time + tubeTime;
    const validUntil = Math.max(
        0,
        (bounds?.validated_until ?? e.time) - e.time,
      ),
      split = Math.floor(validUntil / record.dt) + 1;
    line(
      paths,
      c.points.slice(0, Math.min(split, Math.floor(tubeTime / record.dt) + 1)),
      colors.candidate,
    );
    if (validUntil < horizon - 1e-8 && tubeTime > validUntil)
      line(
        paths,
        c.points.slice(
          Math.max(0, split - 1),
          Math.floor(tubeTime / record.dt) + 1,
        ),
        0x858b99,
        { dashed: true, opacity: 0.75 },
      );
    const count = Math.min(
      bounds?.radii.length || 0,
      Math.max(0, Math.floor(tubeTime / record.dt + 1e-6)),
    );
    const shown = bounds
      ? {
          ...bounds,
          centers: bounds.centers.slice(0, count),
          radii: bounds.radii.slice(0, count),
          swept: bounds.swept.filter((b) => b.end_time <= end + 1e-7),
        }
      : null;
    if ($("show-tube").checked && shown) {
      addPositionBounds(paths, c.points, shown, e.time, record.dt);
      addSweptBounds(paths, shown, e.time);
      if (evolving) addCurrentBound(paths, shown.swept.at(-1));
    }
    if ($("show-body").checked && shown)
      addDroneEnvelope(paths, shown.swept, record.collision_model.radius);
    if (
      $("show-rejected").checked &&
      c.rejection &&
      tubeTime >= c.rejection.time_offset
    ) {
      if (c.rejection.region_validated)
        addRejectionBox(paths, c.rejection.position_box);
      else addEventMarker(paths, c.rejection.marker_position);
    }
    $("tube-time").max = horizon;
    $("tube-time").value = tubeTime;
    $("tube-clock").textContent = `+${num(tubeTime)} s`;
    $("tube-note").textContent =
      `${shown?.swept.length || 0} recorded time slabs. ${validUntil >= horizon - 1e-7 ? "The full 2.5 s tube is established." : `The established tube ends at +${num(validUntil)} s; the gray suffix has no verified set.`} Position widths are shown at their actual scale. The body envelope adds the ${num(record.collision_model.radius)} m collision radius.`;
  }
  decisions(e, index);
  charts();
  epochIndex = index;
}
function update() {
  if (!record) return;
  const s = sampleAt(time);
  drone.position.copy(s.p);
  drone.quaternion.copy(s.q);
  $("clock").textContent = `${num(time)} / ${num(record.metrics.duration)} s`;
  $("timeline").value = time;
  $("speed").textContent = num(s.sample.speed, 1);
  $("gate-count").textContent = `${s.sample.gates} gates passed`;
  const [e, index] = currentEpoch();
  if (index !== epochIndex) {
    selected = 0;
    tubeTime = 2.5;
    drawPaths();
  }
  if (record.gatekeeper_enabled) {
    const active = activeCommitment(e, time);
    $("active-title").textContent = active.label;
    $("active-detail").textContent = active.detail;
  }
  $("scene-status").textContent =
    time >= record.metrics.duration - 0.005
      ? record.outcome.label
      : record.gatekeeper_enabled
        ? "Flying the committed reference"
        : "Direct MPPI + neural controller";
  if (cameraMode === "follow") {
    if (anchor) {
      const delta = s.p.clone().sub(anchor);
      camera.position.add(delta);
      controls.target.add(delta);
    }
    anchor = s.p.clone();
  }
  clear(trailGroup);
  if (record.outcome.position && $("show-contact").checked)
    addEventMarker(trailGroup, record.outcome.position, 0.3);
  if ($("show-flown").checked)
    line(
      trailGroup,
      record.samples
        .slice(0, s.index + 1)
        .map((s) => s.state.slice(0, 3))
        .concat([s.p.toArray()]),
      colors.flown,
      { opacity: 0.85 },
    );
  charts();
}
function play(value) {
  playing = value;
  $("play").textContent = value ? "Ⅱ" : "▶";
  $("play").setAttribute("aria-label", value ? "Pause replay" : "Play replay");
}
function showSummary() {
  const info = scenarioFor(record),
    m = record.metrics,
    epochs = record.epochs.slice(1);
  const mean = epochs.length
    ? epochs.reduce((a, e) => a + e.computation.total_ms, 0) / epochs.length
    : null;
  $("scenario-label").textContent = info.label;
  $("contact-control").hidden = !record.outcome.position;
  $("focus-contact").hidden = !record.outcome.position;
  $("contact-detail").textContent = record.outcome.position
    ? `Red cross: first recorded contact/boundary violation at ${num(record.outcome.time)} s. Location is the drone’s center at that sample.`
    : "No recorded collision. A rejected candidate or an expired reference is not a crash.";
  $("scenario-title").textContent = info.subtitle;
  $("scenario-description").textContent = info.description;
  $("scenario-observe").textContent = info.observe;
  $("run-summary").replaceChildren(
    ...[
      `${num(m.duration, 1)} s recorded · ${m.gates_passed} gates`,
      `${num(m.mean_speed)} m/s mean · ${num(m.max_speed)} m/s peak`,
      `${num(mean, 1)} ms per update after compilation`,
      record.tracking
        ? `Course distance: ${num(record.tracking.course_position_rmse)} m RMS · ${num(record.tracking.course_position_p95)} m at the 95th percentile`
        : "",
      record.outcome.label,
    ].map((text) => {
      const p = document.createElement("p");
      p.textContent = text;
      return p;
    }),
  );
  $("course-details").textContent =
    `${record.track.gates.length} gates; ${num(record.track.gates[0].width)} × ${num(record.track.gates[0].height)} m openings. Body radius: ${num(record.collision_model.radius)} m. MPCC progress weight: ${record.planner_settings.progress}; contouring weight: ${record.planner_settings.contour}. The route and these settings are the same for all three comparisons in this environment.`;
  $("comparison-results").replaceChildren(
    ...entries.map((entry) => {
      const card = document.createElement("div");
      card.className = "result-card";
      const title = document.createElement("h3");
      title.textContent = scenarios[entry.variant].label;
      card.append(title);
      const metrics = entry.metrics;
      for (const text of [
        scenarios[entry.variant].subtitle,
        metrics
          ? `${num(metrics.duration, 1)} s · ${metrics.gates_passed} gates passed`
          : "Recording available",
        metrics
          ? `Mean ${num(metrics.mean_speed)} m/s · peak ${num(metrics.max_speed)} m/s`
          : "",
        entry.status?.replaceAll("_", " ") || "",
      ]) {
        const p = document.createElement("p");
        p.textContent = text;
        card.append(p);
      }
      return card;
    }),
  );
}
async function loadVariant(variant) {
  const token = ++request;
  play(false);
  evolving = false;
  $("loading").hidden = false;
  $("content").inert = true;
  $("error").hidden = true;
  const response = await fetch(
    `./data/${environment.directory}${variant}.json?v=devquad-full-45`,
    { cache: "no-cache" },
  );
  if (!response.ok) throw Error(`Recording not available (${response.status})`);
  const data = await response.json();
  if (token !== request) return;
  if (!data.samples.length)
    throw Error(
      "The recording has no executed trajectory: " + data.outcome.label,
    );
  record = data;
  time = 0;
  selected = 0;
  epochIndex = -1;
  tubeTime = 2.5;
  clear(course);
  record.track.gates.forEach((g, i) => course.add(createGate(g, i, true)));
  room = record.track.room ? createFlyLabRoom(record.track.room) : null;
  if (room) course.add(room);
  route = line(course, record.track.centerline, 0xc5c8a1, { opacity: 0.52 });
  route.visible = $("show-route").checked;
  $("room-control").hidden = !room;
  if (room) room.visible = $("show-room").checked;
  $("gatekeeper-controls").hidden = !record.gatekeeper_enabled;
  $("baseline-note").hidden = record.gatekeeper_enabled;
  $("focus-tube").disabled = !record.gatekeeper_enabled;
  $("timeline").max = record.metrics.duration;
  showSummary();
  $("content").hidden = false;
  $("content").inert = false;
  $("loading").hidden = true;
  document
    .querySelectorAll("[data-variant]")
    .forEach((b) =>
      b.setAttribute("aria-selected", String(b.dataset.variant === variant)),
    );
  const url = new URL(location.href);
  url.searchParams.set("environment", environment.id);
  url.searchParams.set("scenario", String(scenarioFor(record).number));
  history.replaceState(null, "", url);
  resize();
  update();
  resetCamera("orbit");
}
async function loadEnvironment(env, variant) {
  environment = env;
  const response = await fetch(
    `./data/${env.directory}index.json?v=devquad-full-45`,
    { cache: "no-cache" },
  );
  if (!response.ok) throw Error("Environment recordings unavailable");
  entries = await response.json();
  $("environment-description").textContent = env.description;
  document
    .querySelectorAll("[data-environment]")
    .forEach((b) =>
      b.setAttribute("aria-selected", String(b.dataset.environment === env.id)),
    );
  $("variants").replaceChildren(
    ...entries.map((e) => {
      const b = document.createElement("button");
      b.dataset.variant = e.variant;
      b.setAttribute("role", "tab");
      const title = document.createElement("strong"),
        sub = document.createElement("small");
      title.textContent = scenarios[e.variant].label;
      sub.textContent = scenarios[e.variant].subtitle;
      b.append(title, sub);
      b.onclick = () => loadVariant(e.variant).catch(fail);
      return b;
    }),
  );
  await loadVariant(variant || "method-1");
}
function fail(error) {
  console.error(error);
  $("error").textContent = error.message;
  $("error").hidden = false;
  $("loading").hidden = true;
  $("content").inert = false;
}
$("play").onclick = () => {
  if (time >= record.metrics.duration) time = 0;
  play(!playing);
};
$("restart").onclick = () => {
  play(false);
  time = 0;
  update();
};
$("timeline").oninput = () => {
  play(false);
  time = Number($("timeline").value);
  update();
  drawPaths();
};
$("tube-time").oninput = () => {
  evolving = false;
  tubeTime = Number($("tube-time").value);
  drawPaths();
};
$("evolve").onclick = () => {
  play(false);
  if (tubeTime >= 2.5) tubeTime = 0;
  evolving = !evolving;
  $("evolve").textContent = evolving ? "Ⅱ Pause" : "▶ Evolve";
};
$("full-tube").onclick = () => {
  evolving = false;
  tubeTime = 2.5;
  $("evolve").textContent = "▶ Evolve";
  drawPaths();
};
for (const id of [
  "show-tube",
  "show-rejected",
  "show-body",
  "show-nominal",
  "show-active",
])
  $(id).onchange = drawPaths;
$("show-route").onchange = () => {
  route.visible = $("show-route").checked;
};
$("show-room").onchange = () => {
  if (room) room.visible = $("show-room").checked;
};
$("show-flown").onchange = update;
$("show-contact").onchange = update;
$("focus-contact").onclick = () => {
  if (!record.outcome.position) return;
  play(false);
  time = record.outcome.time;
  update();
  cameraMode = "tube";
  fit([record.outcome.position]);
};
$("focus-tube").onclick = () => {
  play(false);
  cameraMode = "tube";
  const [e] = currentEpoch(),
    c = e.candidates[selected];
  fit(c.points);
};
$("focus-failure").onclick = () => {
  play(false);
  cameraMode = "tube";
  const [e] = currentEpoch(),
    failure = e.candidates[selected].rejection,
    box = failure?.region_validated ? failure.position_box : null;
  if (box)
    fit([
      box.center.map((v, i) => v - box.radius[i]),
      box.center.map((v, i) => v + box.radius[i]),
    ]);
  else if (failure?.marker_position) fit([failure.marker_position]);
};
$("focus-drone").onclick = () => {
  play(false);
  resetCamera("drone");
};
for (const b of document.querySelectorAll("[data-camera]"))
  b.onclick = () => resetCamera(b.dataset.camera);
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  if (record) {
    if (playing) {
      time = Math.min(
        record.metrics.duration,
        time + dt * Number($("playback-speed").value),
      );
      drone.userData.rotors.forEach(
        (r, i) => (r.rotation.z += (i % 2 ? 1 : -1) * dt * 70),
      );
      if (time >= record.metrics.duration) {
        play(false);
        update();
        drawPaths();
      }
    }
    if (evolving) {
      tubeTime = Math.min(2.5, tubeTime + dt);
      if (tubeTime >= 2.5) {
        evolving = false;
        $("evolve").textContent = "▶ Evolve";
        drawPaths();
      }
      if (now - lastUpdate > 60) drawPaths();
    }
    if (now - lastUpdate > 60 && (playing || evolving)) {
      update();
      lastUpdate = now;
    }
  }
  controls.update();
  renderer.render(scene, camera);
}
async function start() {
  await drone.userData.ready;
  const response = await fetch("./data/environments.json?v=devquad-full-45", {
    cache: "no-cache",
  });
  const envs = await response.json();
  $("environments").replaceChildren(
    ...envs.map((env) => {
      const b = document.createElement("button");
      b.dataset.environment = env.id;
      b.setAttribute("role", "tab");
      const strong = document.createElement("strong"),
        small = document.createElement("small");
      strong.textContent = env.label;
      small.textContent = env.name;
      b.append(strong, small);
      b.onclick = () => loadEnvironment(env, record?.variant).catch(fail);
      return b;
    }),
  );
  const params = new URLSearchParams(location.search),
    env = envs.find((e) => e.id === params.get("environment")) || envs[0];
  const variant =
    Object.keys(scenarios).find(
      (v) => scenarios[v].number === Number(params.get("scenario")),
    ) || "method-1";
  await loadEnvironment(env, variant);
  requestAnimationFrame(frame);
}
start().catch(fail);
