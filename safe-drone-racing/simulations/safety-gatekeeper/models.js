import * as THREE from 'three';

const maize=0xffcb05,blue=0x214b91;
function part(parent,size,color,position,material={}){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({color,roughness:.7,...material}));
  mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function cylinder(parent,radius,height,color,position){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,20),new THREE.MeshStandardMaterial({color,roughness:.46,metalness:.3}));
  mesh.rotation.x=Math.PI/2;mesh.position.set(...position);mesh.castShadow=true;parent.add(mesh);return mesh;
}
function panel(parent,width,height,texture,y,z,x=0){
  const face=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshStandardMaterial({map:texture,side:THREE.DoubleSide,roughness:.84}));
  face.rotation.x=Math.PI/2;face.position.set(x,y,z);parent.add(face);return face;
}
function gateTexture(kind){
  const canvas=document.createElement('canvas');canvas.width=kind==='side'?128:1024;canvas.height=kind==='side'?1024:128;
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  ctx.fillStyle=kind==='side'?'#ffcb05':'#214b91';ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#ffcb05';
  if(kind==='side'){
    for(let y=640;y<h;y+=64)for(let x=0;x<w;x+=64){ctx.fillStyle=(x/64+y/64)%2?'#ffcb05':'#214b91';ctx.fillRect(x,y,64,64);}
  }else{
    for(let x=0;x<w;x+=64)for(let y=0;y<h;y+=64){if(kind==='top'&&x>=256&&x<768)continue;ctx.fillStyle=(x/64+y/64)%2?'#ffcb05':'#214b91';ctx.fillRect(x,y,64,64);}
    if(kind==='top'){ctx.fillStyle='#ffcb05';ctx.font='900 118px Georgia,serif';ctx.textAlign='center';ctx.fillText('M',512,108);}
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}
export function createGate(g,index,showLabel=false){
  const group=new THREE.Group();group.position.set(...g.center);group.rotation.z=Math.atan2(g.lateral[1],g.lateral[0]);
  const w=g.width,h=g.height,bar=.20,depth=.10;
  for(const sign of [-1,1]){
    const z=sign*(h/2+bar/2),texture=gateTexture(sign>0?'top':'bottom');
    part(group,[w+2*bar,depth,bar],blue,[0,0,z]);
    panel(group,w+2*bar,bar,texture,-depth/2-.001,z);panel(group,w+2*bar,bar,texture,depth/2+.001,z);
    const x=sign*(w/2+bar/2),side=gateTexture('side');
    part(group,[bar,depth,h],maize,[x,0,0]);
    panel(group,bar,h,side,-depth/2-.001,0,x);panel(group,bar,h,side,depth/2+.001,0,x);
    const length=Math.max(.1,g.center[2]-h/2-bar);
    cylinder(group,.022,length,0xe2dfd4,[x,0,-h/2-bar-length/2]);
    part(group,[.22,.64,.055],0xcecec5,[x,0,-g.center[2]+.028]);
  }
  if(showLabel){
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;
    const ctx=canvas.getContext('2d');ctx.font='500 34px system-ui';ctx.fillStyle='#f0f3fa';ctx.shadowColor='#101217';ctx.shadowBlur=8;ctx.fillText(`Gate ${index+1}`,12,44);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
    const label=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthTest:false,toneMapped:false}));label.scale.set(2.7,.9,1);label.center.set(0,.5);label.position.set(w/2+.2,0,h/2+.3);group.add(label);
  }
  return group;
}
function wire(parent,points,color,radius=.002){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,20,radius,6,false),new THREE.MeshStandardMaterial({color,roughness:.6}));parent.add(mesh);
}
export function createDrone(){
  const drone=new THREE.Group(),rotors=[];
  const carbonCanvas=document.createElement('canvas');carbonCanvas.width=32;carbonCanvas.height=32;
  const ctx=carbonCanvas.getContext('2d');ctx.fillStyle='#151719';ctx.fillRect(0,0,32,32);
  for(let y=0;y<32;y+=8)for(let x=0;x<32;x+=8){ctx.fillStyle=(x+y)%16?'#303338':'#212429';ctx.fillRect(x,y,7,7);}
  const carbon=new THREE.CanvasTexture(carbonCanvas);carbon.colorSpace=THREE.SRGBColorSpace;carbon.wrapS=carbon.wrapT=THREE.RepeatWrapping;carbon.repeat.set(5,2);
  for(const sign of [-1,1]){const arm=part(drone,[.49,.035,.014],0xffffff,[0,0,0],{map:carbon});arm.rotation.z=sign*Math.PI/4;}
  for(const z of [.017,.063,.128])part(drone,[.19,.125,.009],0x23282b,[0,0,z]);
  for(const x of [-.079,.079])for(const y of [-.052,.052])cylinder(drone,.005,.12,0x8d959b,[x,y,.071]);
  // White battery/computer cradle and visible stack, following the reference.
  part(drone,[.167,.112,.053],0xe1e0d9,[0,0,.094]);
  for(const sign of [-1,1])part(drone,[.196,.009,.044],0xb7bdc0,[0,sign*.066,.104],{metalness:.5});
  part(drone,[.175,.109,.034],0x1d2226,[0,0,.150]);
  part(drone,[.15,.106,.045],0x101215,[-.004,0,.190]);
  cylinder(drone,.043,.006,0x4b5156,[0,0,.216]);cylinder(drone,.037,.008,0x101214,[0,0,.220]);
  for(let i=0;i<5;i++){const fin=part(drone,[.055,.012,.003],0x2b3033,[0,0,.225]);fin.rotation.z=i*2*Math.PI/5;}
  for(const x of [-.071,.071])for(const y of [-.043,.043])cylinder(drone,.003,.005,0xa7adb2,[x,y,.216]);
  const bladeShape=new THREE.Shape();bladeShape.moveTo(.012,-.004);bladeShape.bezierCurveTo(.034,-.017,.085,-.020,.108,-.004);bladeShape.bezierCurveTo(.115,.010,.085,.015,.065,.012);bladeShape.lineTo(.014,.006);bladeShape.closePath();
  const bladeGeometry=new THREE.ExtrudeGeometry(bladeShape,{depth:.002,bevelEnabled:false});
  for(const [x,y] of [[.17,.17],[.17,-.17],[-.17,.17],[-.17,-.17]]){
    cylinder(drone,.024,.030,0x17191c,[x,y,.018]);cylinder(drone,.0245,.012,0xb71f32,[x,y,.016]);
    cylinder(drone,.025,.008,0x17191c,[x,y,.036]);
    const rotor=new THREE.Group();rotor.position.set(x,y,.044);rotor.rotation.z=x+y;
    const color=x>0?0xd7253e:0x17191e;
    for(let i=0;i<3;i++){const blade=new THREE.Mesh(bladeGeometry,new THREE.MeshStandardMaterial({color,roughness:.42,metalness:.12}));blade.rotation.z=i*2*Math.PI/3;blade.castShadow=true;rotor.add(blade);}
    cylinder(rotor,.008,.007,0x777d82,[0,0,.006]);drone.add(rotor);rotors.push(rotor);
  }
  wire(drone,[[.03,.066,.10],[.12,.08,.095],[.12,.1,.055],[.05,.069,.025]],0xda2935,.003);
  wire(drone,[[-.05,-.06,.19],[-.13,-.09,.17],[-.14,-.08,.09],[-.075,-.06,.065]],0x111317);
  part(drone,[.018,.014,.012],maize,[.12,.10,.055]);
  for(const y of [-.066,.066])part(drone,[.16,.008,.025],0xd9dbd7,[0,y,-.022]);
  drone.scale.setScalar(.90); // The matched recordings use a 0.33 m sphere enclosing this enlarged mesh.
  // Legacy recordings keep their documented 0.16 m collision radius.
  drone.userData.rotors=rotors;return drone;
}
