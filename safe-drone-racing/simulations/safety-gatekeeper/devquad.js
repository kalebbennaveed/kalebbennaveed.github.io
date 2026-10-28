import * as THREE from "three";

// Metres, z up, x forward. See assets/devquad-v2/provenance.json.
export const DEVQUAD_RADIUS = 0.19;
const material = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.22 });
const carbon = material(0x181b20),
  silver = material(0x8d949b),
  dark = material(0x292e36);
function mesh(parent, geometry, mat, position) {
  const object = new THREE.Mesh(geometry, mat);
  object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}
function box(parent, size, mat, p) {
  return mesh(parent, new THREE.BoxGeometry(...size), mat, p);
}
function cylinder(parent, r, h, mat, p) {
  const m = mesh(parent, new THREE.CylinderGeometry(r, r, h, 20), mat, p);
  m.rotation.x = Math.PI / 2;
  return m;
}
async function cadPart(parent, name, position, rotation = 0) {
  const response = await fetch(
    new URL(`./assets/devquad-v2/${name}`, import.meta.url),
  );
  if (!response.ok) throw new Error(`DevQuad component unavailable: ${name}`);
  const bytes = await response.arrayBuffer(),
    view = new DataView(bytes),
    count = view.getUint32(80, true);
  if (bytes.byteLength !== 84 + count * 50)
    throw new Error(`Invalid STL component: ${name}`);
  const vertices = new Float32Array(count * 9);
  for (let i = 0; i < count; i++)
    for (let j = 0; j < 9; j++)
      vertices[i * 9 + j] =
        view.getFloat32(84 + i * 50 + 12 + j * 4, true) * 0.001;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.computeBoundingBox();
  const b = geometry.boundingBox;
  geometry.translate(
    -(b.min.x + b.max.x) / 2,
    -(b.min.y + b.max.y) / 2,
    -b.min.z,
  );
  geometry.computeVertexNormals();
  const m = mesh(parent, geometry, dark, position);
  m.rotation.z = rotation;
  return m;
}
export function createDrone() {
  const group = new THREE.Group(),
    rotors = [];
  group.name = "DevQuad v2";
  group.userData.rotors = rotors;
  group.userData.collisionRadius = DEVQUAD_RADIUS;
  // Source Two frame and vertical battery/computer arrangement in the CAD assembly.
  box(group, [0.095, 0.043, 0.004], carbon, [0, 0, 0]);
  box(group, [0.085, 0.04, 0.003], carbon, [0, 0, 0.023]);
  for (const x of [-0.035, 0.035])
    for (const y of [-0.016, 0.016])
      cylinder(group, 0.0025, 0.024, silver, [x, y, 0.012]);
  for (const [x, y] of [
    [0.07, 0.085],
    [0.07, -0.085],
    [-0.07, 0.085],
    [-0.07, -0.085],
  ]) {
    const root = new THREE.Vector3(
      Math.sign(x) * 0.025,
      Math.sign(y) * 0.012,
      0,
    );
    const end = new THREE.Vector3(x, y, 0),
      delta = end.clone().sub(root);
    const arm = box(
      group,
      [delta.length() + 0.012, 0.012, 0.005],
      carbon,
      root.clone().add(end).multiplyScalar(0.5).toArray(),
    );
    arm.rotation.z = Math.atan2(delta.y, delta.x);
    cylinder(group, 0.014, 0.018, carbon, [x, y, 0.01]);
    cylinder(group, 0.0141, 0.007, material(0x9f2337), [x, y, 0.006]);
    const rotor = new THREE.Group();
    rotor.position.set(x, y, 0.024);
    group.add(rotor);
    rotors.push(rotor);
    const shape = new THREE.Shape();
    shape.moveTo(0.006, -0.003);
    shape.bezierCurveTo(0.026, -0.01, 0.052, -0.012, 0.0635, -0.003);
    shape.bezierCurveTo(0.0635, 0.006, 0.043, 0.008, 0.026, 0.006);
    shape.lineTo(0.006, 0.003);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.0012,
      bevelEnabled: false,
    });
    const color = material(x > 0 ? 0xd8253f : 0x17191d);
    for (let n = 0; n < 3; n++) {
      const blade = mesh(rotor, geometry, color, [0, 0, 0]);
      blade.rotation.z = (n * Math.PI * 2) / 3;
    }
    cylinder(rotor, 0.004, 0.005, silver, [0, 0, 0.003]);
  }
  box(group, [0.035, 0.035, 0.014], carbon, [0, 0, 0.03]);
  box(group, [0.04, 0.04, 0.063], carbon, [0, 0, -0.034]);
  box(group, [0.088, 0.058, 0.003], material(0x21382c), [0, 0, 0.078]);
  box(group, [0.067, 0.05, 0.02], carbon, [0, 0, 0.089]);
  cylinder(group, 0.022, 0.003, dark, [0, 0, 0.101]);
  cylinder(group, 0.019, 0.003, carbon, [0, 0, 0.103]);
  for (let n = 0; n < 7; n++) {
    const fin = box(group, [0.031, 0.005, 0.001], dark, [0, 0, 0.105]);
    fin.rotation.z = (n * Math.PI * 2) / 7;
  }
  // D455 camera; blank shell, no logos, no motion-capture markers or cable.
  box(group, [0.025, 0.124, 0.026], dark, [0.049, 0, 0.068]);
  for (const y of [-0.047, 0, 0.047]) {
    const lens = mesh(
      group,
      new THREE.CylinderGeometry(0.006, 0.006, 0.002, 24),
      carbon,
      [0.063, y, 0.068],
    );
    lens.rotation.z = Math.PI / 2;
  }
  group.userData.ready = Promise.all([
    cadPart(group, "flight-controller-stand.stl", [0, 0, 0.004]),
    cadPart(group, "battery-case.stl", [0, 0, -0.067]),
    cadPart(group, "computer-mount.stl", [0, 0, 0.049], Math.PI / 2),
  ]);
  return group;
}
