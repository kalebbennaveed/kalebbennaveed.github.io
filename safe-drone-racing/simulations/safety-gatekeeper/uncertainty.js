import * as THREE from 'three';

export function errorColor(value,threshold){
  if(value==null||!Number.isFinite(value))return new THREE.Color(0x6b707b);
  const fraction=THREE.MathUtils.clamp(value/threshold,0,1);
  return fraction<.55?new THREE.Color(0x6dacf7).lerp(new THREE.Color(0xe1bd69),fraction/.55):new THREE.Color(0xe1bd69).lerp(new THREE.Color(0xec665e),(fraction-.55)/.45);
}
export function addPositionBounds(parent,points,bounds,time,dt){
  if(!bounds?.radii.length)return null;
  const first=Math.max(0,Math.ceil((time-bounds.start_time)/dt-1e-7));
  const radii=bounds.radii.slice(first),centers=points.slice(first+1,first+1+radii.length);
  if(!radii.length||centers.length!==radii.length)return null;
  // Exact, world-axis-aligned recorded boxes. No inscribed ellipsoids, spatial
  // extrapolation, radius inflation, or invented intersample enclosure.
  const material=new THREE.MeshBasicMaterial({color:0xb4a0fb,transparent:true,opacity:.055,depthWrite:false,toneMapped:false});
  const boxes=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),material,radii.length),dummy=new THREE.Object3D();
  boxes.frustumCulled=false;boxes.renderOrder=1;
  const edgePoints=[];
  const signs=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  const edges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  radii.forEach((r,i)=>{
    dummy.position.set(...centers[i]);dummy.scale.set(...r.map(v=>2*v));dummy.updateMatrix();boxes.setMatrixAt(i,dummy.matrix);
    if(i%5===0||i===radii.length-1){const corners=signs.map(s=>new THREE.Vector3(...s.map((v,k)=>centers[i][k]+v*r[k])));for(const [a,b] of edges)edgePoints.push(corners[a],corners[b]);}
  });
  parent.add(boxes);
  const outline=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(edgePoints),new THREE.LineBasicMaterial({color:0xc6b4ff,transparent:true,opacity:.38,depthWrite:false,toneMapped:false}));outline.renderOrder=2;parent.add(outline);
  return {count:radii.length,until:bounds.start_time+(bounds.radii.length-1)*dt,maxRadius:Math.max(...radii.flat()),currentRadius:radii[0]};
}
