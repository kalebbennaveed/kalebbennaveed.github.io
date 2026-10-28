import * as THREE from "three";

export const rejectionColor = 0xff5e65;

export function addEventMarker(parent, position, size = 0.14) {
  if (!position) return;
  const points = [];
  for (let axis = 0; axis < 3; axis++)
    for (const sign of [-1, 1]) {
      const p = new THREE.Vector3(...position);
      p.setComponent(axis, p.getComponent(axis) + sign * size);
      points.push(p);
    }
  const marker = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({
      color: rejectionColor,
      toneMapped: false,
      depthTest: false,
    }),
  );
  marker.renderOrder = 5;
  parent.add(marker);
}

export function addRejectionBox(parent, box) {
  if (!box) return;
  // Position projection of the saved state set, not the full state/control
  // domain or a reconstructed swept volume. Never enlarge small bounds.
  const geometry = new THREE.BoxGeometry(...box.radius.map((r) => 2 * r));
  const fill = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: rejectionColor,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  fill.position.set(...box.center);
  fill.renderOrder = 3;
  parent.add(fill);
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({
      color: rejectionColor,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  outline.position.copy(fill.position);
  outline.renderOrder = 4;
  parent.add(outline);
  // A fixed-size crosshair locates even millimeter-scale boxes; it is a marker,
  // not an uncertainty radius, and is labeled separately in the inspector.
  addEventMarker(parent, box.center);
}
