import * as THREE from './vendor/three.module.js';
import {createDrone} from './vendor/devquad.js';

// Illustrative geometry, not a simulation or a computed reachable set.
// One WebGL context is shared by every slide. Motion depends only on the slider.
const WORLD = new Set(['course','intro','start','planner','propagate','tube','swept','collision',
  'retry','commit','guarantee','clock','switches','geometry','failure-types','sources','evidence','candidate','taylor','mppi','devquad','physics','contouring','proof-tube']);
const HEADINGS = {
  course:'Predicted flight through the gate openings',
  'proof-tube':'Contain every admissible flight over the complete horizon',
  intro:'A reference becomes a verified commitment', start:'One exact start · several possible futures',
  planner:'Fast motion proposed by the planner', propagate:'Model error changes future motion',
  tube:'Reachable position sets along the candidate', swept:'Include motion between consecutive endpoints',
  collision:'First failed clearance · the full tube remains visible', retry:'Earlier backup · a different complete candidate',
  commit:'Rejected proposal · current commitment continues', guarantee:'Verified coverage has a finite horizon',
  clock:'Held command: 0.05 s · propagation step: 0.01 s', switches:'Six switching times · complete 2.5 s horizons',
  geometry:'Check the entire quad against solid geometry', 'failure-types':'Only the established prefix has a containment claim',
  sources:'Propose a reference · verify a tube · commit', evidence:'Sampled flights are finite numerical evidence',
  candidate:'Racing reference → backup reference', taylor:'Polynomial shape + bounded remainder',
  mppi:'Search reference schedules through feedback rollouts',
  devquad:'Level rotor plane · thrust follows the body-up axis',
  physics:'Tilting the quad tilts thrust · gravity remains vertical',
  contouring:'Resolve displacement along and across the route'
};
const BLUE=0x4389df, GOLD=0xe7af25, TEAL=0x009b9b, RED=0xe34e62;
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const worldPoint=(t)=>V(-2.2+4.4*t+1.25*Math.sin(Math.PI*t),-2.25+5*t-.55*Math.sin(Math.PI*t),1.12+.13*Math.sin(Math.PI*2*t));
function point(t,kind='fast') {return worldPoint(kind==='safe'?t*.84:t);}
function tangent(t,kind='fast') {return point(t+.001,kind).sub(point(t-.001,kind)).normalize();}
function side(t,kind='fast') {const d=tangent(t,kind);return V(-d.y,d.x,0).normalize();}
const material=(color,roughness=.58,metalness=.15)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function vectorArrow(direction,origin,length,color,radius=.006){
  const arrow=new THREE.Group(),head=Math.min(.075,length*.2);
  const mat=new THREE.MeshBasicMaterial({color,toneMapped:false});
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length-head,12),mat);
  shaft.position.y=(length-head)/2;
  const tip=new THREE.Mesh(new THREE.ConeGeometry(radius*3.4,head,16),mat);
  tip.position.y=length-head/2;arrow.add(shaft,tip);
  arrow.position.copy(origin);arrow.quaternion.setFromUnitVectors(V(0,1,0),direction.clone().normalize());
  return arrow;
}
function line(points,color,width=1,opacity=1) {
  // World-space cylinders keep important paths legible on WebGL implementations with 1px lines.
  if(width>1) return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),100,.0045*width,6,false),new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity}));
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity}));
}
function pathPoints(kind='fast',end=1,offset=0) {
  return Array.from({length:81},(_,i)=>{const t=i/80*end;return point(t,kind).addScaledVector(side(t,kind),offset*Math.sin(t*Math.PI));});
}
function disposeTree(group) {
  group.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});
  group.clear();
}
function gate(t,failed=false) {
  const g=new THREE.Group(),p=worldPoint(t),n=side(t);
  p.addScaledVector(n,.2);g.position.copy(p);
  const d=tangent(t);g.rotation.z=Math.atan2(d.y,d.x)-Math.PI/2;
  const navy=material(failed?0xc2384d:0x193b6f),maize=material(failed?RED:0xf7bf25),steel=material(0xaab7c2,.35,.6);
  function box(w,h,depth,x,z,mat,y=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,depth,h),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);}
  // 1.2m clear aperture; the 0.38m body envelope uses the same world units.
  for(const x of [-.64,.64])box(.08,1.36,.075,x,0,maize);
  for(const z of [-.64,.64]){
    box(1.36,.08,.075,0,z,navy);
    for(let j=0;j<12;j++)if(j%2===0)box(.106,.081,.078,-.585+j*.106,z,maize);
  }
  for(const x of [-.64,.64]){
    for(const z of [-.48,-.32,.32,.48])box(.081,.08,.079,x,z,navy);
    const height=p.z-.66;
    box(.022,height,.025,x,-.66-height/2,steel);
    box(.34,.026,.2,x,-p.z+.013,steel);
  }
  return g;
}
function makeTube(kind,{wide=true,end=1,redAt=-1,faint=false}={}) {
  const g=new THREE.Group(),vertices=[],rings=[];
  const count=Math.max(1,Math.ceil(end*50));
  for(let i=0;i<=count;i++){
    const t=end*i/count,p=point(t,kind),n=side(t,kind);
    const r=.003+(wide?.64:.16)*t*t,rz=.003+(wide?.32:.11)*t*t;
    const ring=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>p.clone().addScaledVector(n,a*r).add(V(0,0,b*rz)));
    rings.push(ring);
    if(i%2===0||i===count){const c=Math.abs(t-redAt)<.026?RED:BLUE;g.add(line([...ring,ring[0]],c,1,faint?.07:.38));}
    if(i){for(let k=0;k<4;k++){const j=(k+1)%4;for(const q of [rings[i-1][k],ring[k],ring[j],rings[i-1][k],ring[j],rings[i-1][j]])vertices.push(q.x,q.y,q.z);}}
  }
  if(count){
    const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geom.computeVertexNormals();
    const mesh=new THREE.Mesh(geom,new THREE.MeshStandardMaterial({color:BLUE,transparent:true,opacity:faint?.025:.14,side:THREE.DoubleSide,depthWrite:false,roughness:.4}));
    mesh.renderOrder=2;g.add(mesh);
    for(let k=0;k<4;k++)g.add(line(rings.map(r=>r[k]),BLUE,1,faint?.08:.55));
  }
  return g;
}

export async function createMethod3D(){
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(800,600,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const canvas=renderer.domElement;canvas.className='method-three-canvas';canvas.setAttribute('aria-label','Three-dimensional quad illustration');
  const scene=new THREE.Scene(),world=new THREE.Group(),dynamic=new THREE.Group(),drones=new THREE.Group(),diagram=new THREE.Group();
  scene.add(world,dynamic,drones,diagram);
  scene.add(new THREE.HemisphereLight(0xe7f3ff,0x7c8796,2.5));
  const key=new THREE.DirectionalLight(0xfff3e3,4.2);key.position.set(-3,-4,9);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:.1,far:30});key.shadow.bias=-.0002;key.shadow.normalBias=.015;scene.add(key);
  const fill=new THREE.DirectionalLight(0xb5d9ff,2.2);fill.position.set(5,4,5);scene.add(fill);
  const rim=new THREE.DirectionalLight(0xffffff,1.7);rim.position.set(-5,6,3);scene.add(rim);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),material(0xe6edf1,.9,0));floor.receiveShadow=true;world.add(floor);
  // Faint floor seams provide depth cues without turning the explanation into a plot.
  for(let i=-6;i<=6;i++)world.add(line([V(i,-7,.002),V(i,7,.002)],0xd5dfe5,1,.34),line([V(-7,i,.002),V(7,i,.002)],0xd5dfe5,1,.34));
  const camera=new THREE.PerspectiveCamera(36,4/3,.03,150);camera.up.set(0,0,1);
  const flatCamera=new THREE.OrthographicCamera(-400,400,300,-300,.1,5000);flatCamera.up.set(0,0,1);flatCamera.position.set(700,-1100,850);flatCamera.lookAt(0,0,0);flatCamera.updateMatrixWorld();
  const model=createDrone();await model.userData.ready;
  const worldModels=[],diagramModels=[];
  function instance(pool,parent,index){
    if(!pool[index]){
      const q=model.clone(true);q.userData.rotors=q.children.filter(c=>c.type==='Group');
      // Each instance has independent materials for uncertainty ghosts.
      q.traverse(m=>{if(m.isMesh)m.material=m.material.clone();});parent.add(q);pool.push(q);
    }
    return pool[index];
  }
  function styleQuad(q,opacity=1,tint=null){q.traverse(m=>{if(!m.isMesh)return;const mat=m.material;if(!mat.userData.original)mat.userData.original=mat.color.clone();mat.color.copy(mat.userData.original);if(tint)mat.color.set(tint);mat.opacity=opacity;mat.transparent=opacity<1;mat.depthWrite=opacity===1;m.castShadow=opacity===1;});}
  function rotors(q,p){q.userData.rotors.forEach((r,i)=>r.rotation.z=p*Math.PI*46*(i%2?1:-1)+i*.8);}
  const overlay=document.createElement('div');overlay.className='three-world-labels';
  const toolbar=document.createElement('div');toolbar.className='three-view-tools';
  toolbar.innerHTML='<span>3D · drag to orbit</span><button type="button" aria-label="Reset 3D camera">Reset view</button>';
  let currentScene='',currentPhase=0,currentHost=null,azimuth=0,elevation=0,drag=null,lastTubeKey='',lastWorld='';
  function setCamera(){
    camera.fov=currentScene==='intro'?44:36;camera.updateProjectionMatrix();
    const vehicle=['devquad','physics'].includes(currentScene);
    const target=vehicle?V(0,0,.5):V(.1,.65,.8),position=vehicle?V(.85,-1.15,1.18):V(-4.5,-6.8,5.2);
    if(currentScene==='contouring'){
      target.copy(point(.44)).add(V(0,0,-.08));
      position.copy(target).add(V(3.4,-4.2,2.5));
    }
    if(currentScene==='intro'&&currentPhase<.42){
      const a=currentPhase/.42,k=a*a*(3-2*a),q=point(currentPhase*.86,'safe');
      position.lerp(q.clone().add(V(-1.15,-1.65,.95)),1-k);
      target.lerp(q.clone().add(V(.3,.85,.12)),1-k);
    }
    const offset=position.sub(target),s=new THREE.Spherical().setFromVector3(V(offset.x,offset.z,offset.y));
    s.theta+=azimuth;s.phi=Math.max(.3,Math.min(1.45,s.phi+elevation));
    const o=new THREE.Vector3().setFromSpherical(s);camera.position.copy(target).add(V(o.x,o.z,o.y));
    camera.lookAt(target);camera.updateMatrixWorld();
  }
  function label(p,text,color=''){
    const q=p.clone().project(camera);const e=document.createElement('div');e.className='three-label';e.textContent=text;e.style.left=`${Math.max(15,Math.min(85,(q.x+1)*50))}%`;e.style.top=`${Math.max(18,Math.min(87,(1-q.y)*50))}%`;if(color)e.style.color=color;overlay.append(e);
  }
  function rebuildWorld(name){
    // Static gate and route meshes are rebuilt only when the explanation changes.
    for(const child of [...world.children])if(child.userData.explanation){world.remove(child);disposeTree(child);}
    const group=new THREE.Group();group.userData.explanation=true;world.add(group);
    if(['devquad','physics'].includes(name)){lastWorld=name;lastTubeKey='';return;}
    if(name==='contouring'){
      group.add(gate(.8),line(pathPoints().slice(8,72),GOLD,2.5));
      lastWorld=name;lastTubeKey='';return;
    }
    const collision=['collision','geometry'].includes(name),safe=['intro','retry','commit','guarantee','clock','switches','sources','evidence','candidate','taylor'].includes(name);
    const kind=safe?'safe':'fast';
    group.add(gate(.58,collision),gate(.96));
    if(name==='candidate'){
      const a=pathPoints('safe').slice(0,40),b=pathPoints('safe').slice(39);group.add(line(a,GOLD,2.2),line(b,TEAL,2.2));
    }else group.add(line(pathPoints(kind),safe?TEAL:GOLD,1.7));
    if(['retry','commit'].includes(name))group.add(line(pathPoints('fast',1,.15),RED,1,.5));
    if(['planner','mppi'].includes(name))for(let i=0;i<14;i++)group.add(line(pathPoints('fast',1,Math.sin(i*2.2)*.5),BLUE,1,.14));
    lastWorld=name;lastTubeKey='';
  }
  function drawWorld(name,p){
    if(lastWorld!==name)rebuildWorld(name);
    if(['devquad','physics'].includes(name)){drawVehicle(name,p);return;}
    world.visible=dynamic.visible=drones.visible=true;diagram.visible=false;key.castShadow=true;
    canvas.style.pointerEvents='auto';toolbar.hidden=false;overlay.hidden=false;
    const safe=['intro','retry','commit','guarantee','clock','switches','sources','evidence','candidate','taylor'].includes(name),kind=safe?'safe':'fast';
    const growing=['propagate','tube'].includes(name),showTube=!['course','start','planner','candidate','mppi','contouring'].includes(name),failed=name==='failure-types',collision=['collision','geometry'].includes(name);
    const end=failed?.55:growing?Math.max(.005,p):1;
    const tubeKey=[name,Math.round(end*1000),name==='contouring'?Math.round(p*1000):0].join(':');
    if(lastTubeKey!==tubeKey){
      disposeTree(dynamic);
      if(showTube)dynamic.add(makeTube(kind,{wide:!safe,end,redAt:collision?.58:-1}));
      if(failed)dynamic.add(makeTube(kind,{wide:true,end:1,faint:true}));
      if(collision){
        const n=side(.58),edge=point(.58).addScaledVector(n,-(.003+.64*.58*.58));
        const c=edge.clone().addScaledVector(n,-.19);
        const marker=new THREE.Mesh(new THREE.SphereGeometry(.047,20,12),new THREE.MeshBasicMaterial({color:RED}));marker.position.copy(c);dynamic.add(marker);
        const body=new THREE.Mesh(new THREE.SphereGeometry(.19,20,14),new THREE.MeshBasicMaterial({color:RED,transparent:true,opacity:.18,wireframe:true}));body.position.copy(edge);dynamic.add(body);
      }
      if(name==='geometry'){
        const body=new THREE.Mesh(new THREE.SphereGeometry(.19,24,16),new THREE.MeshBasicMaterial({color:0x183f5a,transparent:true,opacity:.13,wireframe:true}));body.position.copy(point(.58));dynamic.add(body);
      }
      if(name==='swept')dynamic.add(line(pathPoints(kind).slice(18,30),TEAL,4,.7));
      if(name==='contouring'){
        const r=point(.4),d=tangent(.4),n=side(.4),a=r.clone().addScaledVector(d,.6);
        dynamic.add(vectorArrow(d,r,.6,TEAL,.009),vectorArrow(n,a,.5+.45*p,BLUE,.009));
        dynamic.add(line([r.clone().addScaledVector(d,-1.1),r.clone().addScaledVector(d,1.1)],0x8aa1ae,1,.6));
        const dot=new THREE.Mesh(new THREE.SphereGeometry(.035,16,10),new THREE.MeshBasicMaterial({color:0x23495e}));dot.position.copy(r);dynamic.add(dot);
      }
      lastTubeKey=tubeKey;
    }
    worldModels.forEach(m=>m.visible=false);
    const t=name==='course'?p:p*.86,q=instance(worldModels,drones,0),d=tangent(t,kind);q.visible=true;q.scale.setScalar(1);
    q.position.copy(point(t,kind));q.rotation.set(.12*Math.sin(p*4),-.09,Math.atan2(d.y,d.x),'ZYX');styleQuad(q);rotors(q,p);
    if(name==='contouring'){
      q.position.copy(point(.4)).addScaledVector(tangent(.4),.6).addScaledVector(side(.4),.5+.45*p);
      const heading=tangent(.4);q.rotation.set(0,0,Math.atan2(heading.y,heading.x));
    }
    if(['start','propagate','tube','proof-tube','evidence'].includes(name))for(let i=0;i<4;i++){
      const ghost=instance(worldModels,drones,i+1);ghost.visible=true;ghost.scale.setScalar(1);ghost.position.copy(point(t,kind)).addScaledVector(side(t,kind),(i-1.5)*.09*p).add(V(0,0,Math.sin(i*2)*.055*p));ghost.rotation.copy(q.rotation);styleQuad(ghost,.2,BLUE);rotors(ghost,p);
    }
    setCamera();scene.background=new THREE.Color(0xe9eff3);scene.fog=new THREE.Fog(0xe9eff3,17,36);
    renderer.render(scene,camera);
    overlay.replaceChildren();const title=document.createElement('div');title.className='three-scene-title';title.textContent=HEADINGS[name];overlay.append(title);
    if(name==='contouring'){
      const r=point(.4),d=tangent(.4),n=side(.4),a=r.clone().addScaledVector(d,.6);
      label(r.clone().addScaledVector(d,-.6).add(V(0,0,.2)),'Selected route point','#ac7c15');
      label(r.clone().addScaledVector(d,.35).addScaledVector(n,-.6),'Along tangent','#007b7d');
      label(a.clone().addScaledVector(n,.32+.225*p).add(V(0,0,.65)),'Across route','#326bc0');
    }
    else if(collision)label(point(.58).add(V(0,0,.8)),'First failed clearance','#c43951');
    else if(name==='candidate')label(point(.49,'safe').add(V(0,0,.35)),'Switch to backup','#007b7d');
    else if(name==='failure-types')label(point(.55).add(V(0,0,.45)),'Last established step','#306bc0');
    else if(name==='switches'){const times=[2,1.5,1,.5,.2,0],k=Math.min(5,Math.floor(p*6));label(point(times[k]/2.5,'safe').add(V(0,0,.35)),`Switch: ${times[k]} s`,'#007b7d');}
    else if(name!=='course'&&p<.07)label(point(0).add(V(0,0,-.3)),'Exact starting state');
    if(showTube)label(point(.9,kind).add(V(0,0,.58)),failed?'Unproved continuation':'Position enclosure','#326bc0');
  }
  function drawVehicle(name,p){
    world.visible=dynamic.visible=drones.visible=true;diagram.visible=false;key.castShadow=true;
    canvas.style.pointerEvents='auto';toolbar.hidden=false;overlay.hidden=false;
    disposeTree(dynamic);worldModels.forEach(m=>m.visible=false);
    const q=instance(worldModels,drones,0);q.visible=true;q.scale.setScalar(1);q.position.set(0,0,.5);
    const pitch=name==='physics'?.24*Math.sin(p*Math.PI*1.3):0;
    q.rotation.set(0,pitch,0,'ZYX');styleQuad(q);rotors(q,p);
    const up=V(0,0,1).applyQuaternion(q.quaternion),origin=q.position.clone();
    dynamic.add(vectorArrow(up,origin,.43,TEAL,.004));
    dynamic.add(vectorArrow(V(0,0,-1),origin,.37,GOLD,.004));
    setCamera();scene.background=new THREE.Color(0xe9eff3);scene.fog=new THREE.Fog(0xe9eff3,17,36);renderer.render(scene,camera);
    overlay.replaceChildren();const title=document.createElement('div');title.className='three-scene-title';title.textContent=HEADINGS[name];overlay.append(title);
    label(origin.clone().addScaledVector(up,.48),'Collective thrust','#007b7d');
    label(origin.clone().add(V(0,0,-.4)),'Gravity','#a77b15');
  }
  function drawDiagram(host,name,p){
    world.visible=dynamic.visible=drones.visible=false;diagram.visible=true;key.castShadow=false;canvas.style.pointerEvents='none';toolbar.hidden=true;overlay.hidden=true;
    diagramModels.forEach(m=>m.visible=false);
    const slots=host.querySelectorAll('.quad-slot');
    slots.forEach((slot,i)=>{
      const q=instance(diagramModels,diagram,i),a=slot.dataset;q.visible=true;
      q.position.copy(V(Number(a.x)-400,300-Number(a.y),0).applyQuaternion(flatCamera.quaternion));
      q.scale.setScalar(300*Number(a.scale));
      // Keep every diagram quad level in the same world-up frame as the camera.
      // Solve the projection of a horizontal heading onto the two screen axes.
      const right=V(1,0,0).applyQuaternion(flatCamera.quaternion),up=V(0,1,0).applyQuaternion(flatCamera.quaternion);
      const angle=Number(a.angle)*Math.PI/180,sx=Math.cos(angle),sy=-Math.sin(angle),det=right.x*up.y-right.y*up.x;
      const hx=(sx*up.y-sy*right.y)/det,hy=(right.x*sy-up.x*sx)/det;
      q.rotation.set(0,0,Math.atan2(hy,hx));
      styleQuad(q,Number(a.opacity),a.tint||null);rotors(q,p);
    });
    scene.background=null;scene.fog=null;renderer.render(scene,flatCamera);
  }
  function render(host,name,p){
    if(currentScene!==name){azimuth=elevation=0;}
    currentScene=name;currentPhase=p;currentHost=host;
    host.append(canvas,overlay,toolbar);host.classList.toggle('has-3d-world',WORLD.has(name));
    if(WORLD.has(name))drawWorld(name,p);else drawDiagram(host,name,p);
  }
  canvas.addEventListener('pointerdown',e=>{if(!WORLD.has(currentScene))return;drag={x:e.clientX,y:e.clientY,a:azimuth,e:elevation};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;azimuth=drag.a-(e.clientX-drag.x)*.008;elevation=drag.e+(e.clientY-drag.y)*.006;drawWorld(currentScene,currentPhase);});
  const release=()=>{drag=null;};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
  toolbar.querySelector('button').addEventListener('click',()=>{azimuth=elevation=0;drawWorld(currentScene,currentPhase);});
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();currentHost?.classList.add('webgl-lost');});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{currentHost?.classList.remove('webgl-lost');if(currentHost)render(currentHost,currentScene,currentPhase);});
  return {render,isWorld:name=>WORLD.has(name),snapshot:()=>canvas.toDataURL('image/png')};
}
