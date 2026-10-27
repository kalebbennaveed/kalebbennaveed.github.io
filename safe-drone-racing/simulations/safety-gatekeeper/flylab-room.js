// Render the copied Fly Lab room schema. The same solids are checked in Python.
import * as THREE from 'three';

export function createFlyLabRoom(room){
  const group=new THREE.Group();group.name='Fly Lab room';
  function polygon(points,color=0xa4abb5,opacity=1,edges=true){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
    // Ear clipping also handles the concave room outline, unlike a triangle fan.
    const normal=new THREE.Vector3().subVectors(new THREE.Vector3(...points[1]),new THREE.Vector3(...points[0]))
      .cross(new THREE.Vector3().subVectors(new THREE.Vector3(...points[2]),new THREE.Vector3(...points[0])));
    const drop=[Math.abs(normal.x),Math.abs(normal.y),Math.abs(normal.z)].indexOf(Math.max(Math.abs(normal.x),Math.abs(normal.y),Math.abs(normal.z)));
    const axes=[0,1,2].filter(i=>i!==drop),contour=points.map(p=>new THREE.Vector2(p[axes[0]],p[axes[1]]));
    geometry.setIndex(THREE.ShapeUtils.triangulateShape(contour,[]).flat());geometry.computeVertexNormals();
    const material=new THREE.MeshStandardMaterial({color,side:THREE.DoubleSide,
      transparent:opacity<1,opacity,depthWrite:opacity>=1,roughness:.9});
    const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;group.add(mesh);
    if(edges){const outline=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),
      new THREE.LineBasicMaterial({color:0x8c9aa9,transparent:true,opacity:.4}));group.add(outline);}
  }
  function pipe(a,b,r,color=0x9da6b2){
    const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),d=to.clone().sub(from);
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),10),new THREE.MeshStandardMaterial({color,roughness:.65}));
    mesh.position.copy(from.add(to).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());group.add(mesh);
  }
  polygon(room.outline.map(p=>[...p,.002]),0x303b45,1);
  room.outline.forEach((a,i)=>{const b=room.outline[(i+1)%room.outline.length];
    polygon([[...a,0],[...b,0],[...b,room.height],[...a,room.height]],0x9caabd,.055);});
  // Outline the ceiling so the flight remains visible from above.
  group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(room.outline.map(p=>new THREE.Vector3(...p,room.height))),
    new THREE.LineBasicMaterial({color:0xa5b1c0,transparent:true,opacity:.35})));
  for(const box of room.boxes||[]){
    if(box.kind==='zone')continue;
    const low=box.poly.map(p=>[...p,box.z[0]]),high=box.poly.map(p=>[...p,box.z[1]]);
    polygon(low,box.color,box.opacity??.7);polygon(high,box.color,box.opacity??.7);
    low.forEach((a,i)=>{const j=(i+1)%low.length;polygon([a,low[j],high[j],high[i]],box.color,box.opacity??.7);});
  }
  for(const q of room.panels||[])polygon(q.pts,q.color,q.opacity??1,q.edge!==false);
  for(const p of room.pipes||[])pipe(p.a,p.b,p.r,p.color);
  for(const line of room.lines||[]){
    if(line.solid){for(let i=1;i<line.pts.length;i++)pipe(line.pts[i-1],line.pts[i],.01,line.color);}
    else group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(line.pts.map(p=>new THREE.Vector3(...p))),
      new THREE.LineBasicMaterial({color:line.color??0xa5b1c0,transparent:true,opacity:line.opacity??.5})));
  }
  for(const point of room.points||[]){
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(point.r,8,6),new THREE.MeshBasicMaterial({color:point.color??0xffffff}));
    mesh.position.set(...point.p);group.add(mesh);
  }
  return group;
}
