import * as THREE from "three";

const maize = 0xffcb05,
  blue = 0x214b91;
function part(parent, size, color, position, material = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...material }),
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function cylinder(parent, radius, height, color, position) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 20),
    new THREE.MeshStandardMaterial({ color, roughness: 0.46, metalness: 0.3 }),
  );
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(...position);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
function panel(parent, width, height, texture, y, z, x = 0) {
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({
      map: texture,
      side: THREE.DoubleSide,
      roughness: 0.84,
    }),
  );
  face.rotation.x = Math.PI / 2;
  face.position.set(x, y, z);
  parent.add(face);
  return face;
}
function gateTexture(kind) {
  const canvas = document.createElement("canvas");
  canvas.width = kind === "side" ? 128 : 1024;
  canvas.height = kind === "side" ? 1024 : 128;
  const ctx = canvas.getContext("2d"),
    w = canvas.width,
    h = canvas.height;
  ctx.fillStyle = kind === "side" ? "#ffcb05" : "#214b91";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#ffcb05";
  if (kind === "side") {
    for (let y = 640; y < h; y += 64)
      for (let x = 0; x < w; x += 64) {
        ctx.fillStyle = (x / 64 + y / 64) % 2 ? "#ffcb05" : "#214b91";
        ctx.fillRect(x, y, 64, 64);
      }
  } else {
    for (let x = 0; x < w; x += 64)
      for (let y = 0; y < h; y += 64) {
        if (kind === "top" && x >= 256 && x < 768) continue;
        ctx.fillStyle = (x / 64 + y / 64) % 2 ? "#ffcb05" : "#214b91";
        ctx.fillRect(x, y, 64, 64);
      }
    if (kind === "top") {
      ctx.fillStyle = "#ffcb05";
      ctx.font = "900 118px Georgia,serif";
      ctx.textAlign = "center";
      ctx.fillText("M", 512, 108);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
export function createGate(g, index, showLabel = false) {
  const group = new THREE.Group();
  group.position.set(...g.center);
  group.rotation.z = Math.atan2(g.lateral[1], g.lateral[0]);
  const w = g.width,
    h = g.height,
    bar = 0.2,
    depth = 0.1;
  for (const sign of [-1, 1]) {
    const z = sign * (h / 2 + bar / 2),
      texture = gateTexture(sign > 0 ? "top" : "bottom");
    part(group, [w + 2 * bar, depth, bar], blue, [0, 0, z]);
    panel(group, w + 2 * bar, bar, texture, -depth / 2 - 0.001, z);
    panel(group, w + 2 * bar, bar, texture, depth / 2 + 0.001, z);
    const x = sign * (w / 2 + bar / 2),
      side = gateTexture("side");
    part(group, [bar, depth, h], maize, [x, 0, 0]);
    panel(group, bar, h, side, -depth / 2 - 0.001, 0, x);
    panel(group, bar, h, side, depth / 2 + 0.001, 0, x);
    if (g.mount !== "suspended") {
      const length = Math.max(0.1, g.center[2] - h / 2 - bar);
      cylinder(group, 0.022, length, 0xe2dfd4, [
        x,
        0,
        -h / 2 - bar - length / 2,
      ]);
      part(group, [0.22, 0.64, 0.055], 0xcecec5, [x, 0, -g.center[2] + 0.028]);
    }
  }
  if (showLabel) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.font = "500 34px system-ui";
    ctx.fillStyle = "#f0f3fa";
    ctx.shadowColor = "#101217";
    ctx.shadowBlur = 8;
    ctx.fillText(`Gate ${index + 1}`, 12, 44);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map,
        transparent: true,
        depthTest: false,
        toneMapped: false,
      }),
    );
    const labelScale = Math.max(0.6, Math.min(1, w / 2.2));
    label.scale.set(2.7 * labelScale, 0.9 * labelScale, 1);
    label.center.set(0, 0.5);
    label.position.set(w / 2 + 0.2, 0, h / 2 + 0.3);
    group.add(label);
  }
  return group;
}
export { createDrone } from "./devquad.js";
