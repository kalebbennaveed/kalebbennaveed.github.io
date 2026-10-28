import * as THREE from "three";

export function addPositionBounds(parent, points, bounds, time, dt) {
  if (!bounds?.radii.length) return null;
  const first = Math.max(0, Math.ceil((time - bounds.start_time) / dt - 1e-7));
  const radii = bounds.radii.slice(first),
    centers = bounds.centers
      ? bounds.centers.slice(first, first + radii.length)
      : points.slice(first + 1, first + 1 + radii.length);
  if (!radii.length || centers.length !== radii.length) return null;
  addBoxes(parent, centers, radii);
  return {
    count: radii.length,
    until: bounds.start_time + (bounds.radii.length - 1) * dt,
    maxRadius: Math.max(...radii.flat()),
    currentRadius: radii[0],
  };
}
export function addSweptBounds(parent, bounds, time) {
  const intervals = (bounds?.swept || []).filter(
    (box) => box.end_time > time + 1e-7,
  );
  if (!intervals.length) return null;
  addBoxes(
    parent,
    intervals.map((box) => box.center),
    intervals.map((box) => box.radius),
    { swept: true },
  );
  return { count: intervals.length, until: intervals.at(-1).end_time };
}
export function addCurrentBound(parent, box) {
  if (!box) return;
  const geometry = new THREE.BoxGeometry(
    ...box.radius.map((value) => 2 * value),
  );
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: 0xe7f1ff,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  mesh.position.set(...box.center);
  mesh.renderOrder = 3;
  parent.add(mesh);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({
      color: 0xe7f1ff,
      depthTest: false,
      toneMapped: false,
    }),
  );
  edges.position.copy(mesh.position);
  edges.renderOrder = 4;
  parent.add(edges);
}
export function addDroneEnvelope(parent, intervals, radius) {
  // Display an outer box for each position set + the collision sphere. This
  // changes neither the saved position uncertainty nor the separation test.
  if (!intervals.length || !(radius > 0)) return;
  addBoxes(
    parent,
    intervals.map((b) => b.center),
    intervals.map((b) => b.radius.map((r) => r + radius)),
    { body: true },
  );
}
function addBoxes(
  parent,
  centers,
  radii,
  { swept = false, body = false } = {},
) {
  // World-axis recorded boxes, or explicitly labelled body envelopes. No
  // spatial extrapolation or invented intersample enclosure.
  const material = new THREE.MeshBasicMaterial({
    color: 0xb4a0fb,
    transparent: true,
    opacity:
      (body ? 0.018 : swept ? 0.2 : 0.1) /
      Math.max(1, Math.sqrt(radii.length / 32)),
    depthWrite: false,
    toneMapped: false,
  });
  const boxes = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      material,
      radii.length,
    ),
    dummy = new THREE.Object3D();
  boxes.frustumCulled = false;
  boxes.renderOrder = 1;
  const edgePoints = [];
  const signs = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1],
  ];
  const edges = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];
  radii.forEach((r, i) => {
    dummy.position.set(...centers[i]);
    dummy.scale.set(...r.map((v) => 2 * v));
    dummy.updateMatrix();
    boxes.setMatrixAt(i, dummy.matrix);
    if (i % (body ? 10 : 5) === 0 || i === radii.length - 1) {
      const corners = signs.map(
        (s) => new THREE.Vector3(...s.map((v, k) => centers[i][k] + v * r[k])),
      );
      for (const [a, b] of edges) edgePoints.push(corners[a], corners[b]);
    }
  });
  parent.add(boxes);
  const outline = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(edgePoints),
    new THREE.LineBasicMaterial({
      color: 0xc6b4ff,
      transparent: true,
      opacity: body ? 0.22 : swept ? 0.65 : 0.55,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  outline.renderOrder = 2;
  parent.add(outline);
}
