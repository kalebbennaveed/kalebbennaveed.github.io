import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createGate, createDrone } from './models.js';
import { addPositionBounds, errorColor } from './uncertainty.js';
import { addRejectionBox, rejectionColor } from './rejection.js';

const $=id=>document.getElementById(id);
const colors={candidate:0xedba74,committed:0x71e2db,backup:0x9691ef,trail:0xd2d8e0,nominal:0x7688a7};
let data,time=0,playing=false,view='overview',epochIndex=-1,selectedCandidate=0,lastFrame=0,lastAnchor=null,loadRequest=0;
let renderer,scene,camera,controls,course,paths,drone,rotors=[],trail,missMarkers;
const clock=value=>`${String(Math.floor(value/60)).padStart(2,'0')}:${(value%60).toFixed(2).padStart(5,'0')}`;
const number=(x,suffix='',digits=2)=>x==null||!Number.isFinite(x)?'—':x.toFixed(digits)+suffix;
const dispose=object=>{object.traverse(child=>{if(child.isInstancedMesh)child.dispose();child.geometry?.dispose();const materials=Array.isArray(child.material)?child.material:[child.material];materials.forEach(m=>{m?.map?.dispose();m?.dispose();});});object.parent?.remove(object);};

function initScene(){
  renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  scene=new THREE.Scene();scene.background=new THREE.Color('#1b1d20');scene.fog=new THREE.Fog('#1b1d20',42,90);
  camera=new THREE.PerspectiveCamera(42,1,.05,150);camera.up.set(0,0,1);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=.25;controls.maxDistance=55;controls.maxPolarAngle=Math.PI*.49;
  scene.add(new THREE.HemisphereLight(0xbec7de,0x292b33,1.25));
  const key=new THREE.DirectionalLight(0xe5e6f7,3.2);key.position.set(-8,-9,24);key.castShadow=true;
  Object.assign(key.shadow.camera,{left:-19,right:19,top:19,bottom:-19,near:1,far:60});key.shadow.mapSize.set(2048,2048);key.shadow.bias=-.00015;key.shadow.normalBias=.04;scene.add(key);
  const fill=new THREE.PointLight(0x5759aa,30,40,2);fill.position.set(7,7,8);scene.add(fill);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(170,170),new THREE.MeshStandardMaterial({color:0x292c31,roughness:.95,metalness:.04}));ground.receiveShadow=true;ground.position.z=-.015;scene.add(ground);
  const lightCanvas=document.createElement('canvas');lightCanvas.width=256;lightCanvas.height=256;const ctx=lightCanvas.getContext('2d');
  const gradient=ctx.createRadialGradient(128,128,0,128,128,128);gradient.addColorStop(0,'rgba(135,145,178,0.13)');gradient.addColorStop(.6,'rgba(95,100,122,0.05)');gradient.addColorStop(1,'rgba(40,40,40,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);
  const pool=new THREE.Mesh(new THREE.PlaneGeometry(45,45),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(lightCanvas),transparent:true,depthWrite:false}));pool.position.z=.003;scene.add(pool);
  course=new THREE.Group();paths=new THREE.Group();missMarkers=new THREE.Group();scene.add(course,paths,missMarkers);drone=createDrone();rotors=drone.userData.rotors;scene.add(drone);
  new ResizeObserver(resize).observe($('scene').parentElement);resetCamera();resize();
}
function resetCamera(){
  if(view==='rejection')view='overview';
  const point=drone?.position.clone()||new THREE.Vector3(0,0,3);lastAnchor=null;
  if(view==='follow'||view==='drone'){controls.target.copy(point);camera.position.copy(point).add(new THREE.Vector3(...(view==='drone'?[-.50,-.60,.36]:[-2.7,-3.3,1.8])));lastAnchor=point.clone();}
  else {controls.target.set(0,0,1.8);camera.position.set(...(view==='top'?[0,-.01,31]:[18,-24,23]));}
  fitCameraAspect();
  camera.lookAt(controls.target);controls.update();
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
}
function resize(){
  if(!renderer)return;const r=$('scene').getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;fitCameraAspect();drawChart();drawUncertaintyChart();
}
function fitCameraAspect(){camera.zoom=['overview','top','rejection'].includes(view)?Math.min(1,camera.aspect/1.2):1;camera.updateProjectionMatrix();}
function addLine(points,color,{dashed=false,opacity=1,width=.025}={}){
  if(!points||points.length<2)return null;
  const vectors=points.map(p=>new THREE.Vector3(...p));
  let object;
  if(dashed||width===0){const mat=dashed?new THREE.LineDashedMaterial({color,toneMapped:false,dashSize:.20,gapSize:.14,transparent:true,opacity}):new THREE.LineBasicMaterial({color,toneMapped:false,transparent:true,opacity});object=new THREE.Line(new THREE.BufferGeometry().setFromPoints(vectors),mat);if(dashed)object.computeLineDistances();}
  else{const curve=new THREE.CurvePath();for(let i=1;i<vectors.length;i++)if(vectors[i].distanceTo(vectors[i-1])>1e-7)curve.add(new THREE.LineCurve3(vectors[i-1],vectors[i]));if(!curve.curves.length)return null;object=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(32,points.length*2),width,5,false),new THREE.MeshBasicMaterial({color,toneMapped:false,transparent:true,opacity,depthWrite:false}));}
  paths.add(object);return object;
}
function getEpoch(){
  if(!data?.epochs.length)return null;let i=0;while(i+1<data.epochs.length&&data.epochs[i+1].time<=time+1e-7)i++;
  return {epoch:data.epochs[i],index:i};
}
function updatePaths(force=false){
  const found=getEpoch();if(!found)return;const {epoch,index}=found;
  if(!force&&epochIndex===index)return;const changed=epochIndex!==index;epochIndex=index;
  if(changed){selectedCandidate=Math.min(selectedCandidate,Math.max(0,epoch.candidates.length-1));$('candidate').replaceChildren(...epoch.candidates.map((c,i)=>{const option=document.createElement('option');option.value=i;option.textContent=`${c.switch_seconds.toFixed(2)} s aggressive · ${c.verification.accepted?'passes experimental checks':'rejected'}`;return option;}));$('candidate').value=selectedCandidate;}
  if(!epoch.candidates.length){const option=document.createElement('option');option.textContent='No Gatekeeper candidate in this run';$('candidate').replaceChildren(option);}
  $('candidate').disabled=!epoch.candidates.length;
  while(paths.children.length)dispose(paths.children[0]);
  const candidate=epoch.candidates[selectedCandidate],com=epoch.commitment;
  if($('show-nominal').checked||data.mode==='nominal')addLine(epoch.nominal,colors.nominal,{opacity:.7,width:.024});
  if(candidate&&!($('show-rejected').checked&&!candidate.verification.accepted)){const split=Math.round(candidate.switch_seconds/data.dt);
    if($('show-candidate').checked)addLine(candidate.points.slice(0,split+1),colors.candidate,{dashed:true,opacity:.9});
    if($('show-backup').checked)addLine(candidate.points.slice(split),colors.backup,{dashed:true,opacity:com?.retained ? .45 : .75});
  }
  if(com&&$('show-committed').checked){const refStart=com.reference_start_time??com.start_time;const offset=Math.max(0,Math.floor((time-refStart)/data.dt));const split=Math.max(0,Math.round((com.start_time+com.switch_seconds-refStart)/data.dt));
    addLine(com.points.slice(offset),colors.committed,{width:.035});
    if($('show-backup').checked)addLine(com.points.slice(Math.max(offset,split)),colors.backup,{opacity:.95,dashed:true});
  }
  updateUncertaintyGeometry(epoch,candidate,com);
  updateRejection(epoch,candidate);
  updateInspector(epoch,candidate,com,index);
}
function updateRejection(epoch,candidate){
  const rejected=candidate&&!candidate.verification.accepted,r=candidate?.rejection;
  $('show-rejected').disabled=!rejected;
  $('focus-rejection').disabled=!rejected||!r?.segment||!$('show-rejected').checked;
  if(!rejected){
    $('rejection-title').textContent=candidate?'This candidate passed the experimental checks.':'No Gatekeeper candidate in this run.';
    $('rejection-detail').textContent='';$('rejection-geometry-note').textContent='';return;
  }
  const names={trusted_domain:'Error bound exceeds the trust limit',reachable_tube_boundary:'Reachable set overlaps a boundary',terminal_recovery:'Terminal recovery check failed',backup_invariance_unestablished:'Backup invariance is unestablished',flow_enclosure_failed:'Flow enclosure failed'};
  $('rejection-title').textContent=names[r?.reason||candidate.verification.reason]||'Candidate rejected';
  let detail='',note='Red dashed: rejected proposal. Solid red: failure location. Later steps were not checked.';
  if(r?.segment){
    const offset=number(r.time_offset,' s'),absolute=number(epoch.time+r.time_offset,' s');
    if(data.mode==='strict'){
      detail=`Failed during +${number(r.interval_offsets[0])}–${number(r.interval_offsets[1],' s')}. Only the nominal interval can be located; the failing interval set and error value were not saved.`;
      note='The rejected reference and its failed-check interval are red. No failure box is invented.';
    }else if(r.reason==='trusted_domain'){
      detail=`${number(r.error_bound)} > ${number(r.threshold)} m/s² at +${offset} (predicted time ${absolute}). The state–control uncertainty set exceeds the trusted error threshold here.`;
      note+=' The red box is its position projection; the crosshair only marks its center.';
    }else if(r.reason==='reachable_tube_boundary'){
      detail=`First negative boundary margin: ${number(r.boundary_margin,' m',3)}, during +${number(r.interval_offsets[0])}–${number(r.interval_offsets[1],' s')}. The swept reachable set fails the clearance check.`;
      note+=' Red box: saved endpoint position bound. The larger swept box was not saved.';
    }else{
      detail=`The endpoint at +${offset} (predicted time ${absolute}) fails the combined position, velocity and tilt recovery test.`;
      note='Red box: terminal position projection. The failure may involve velocity or tilt; red does not imply a position collision. The crosshair marks the endpoint.';
    }
  }else{
    detail='The log records the rejection reason but not enough information to locate its failed check.';
    note='The full rejected reference is red; no failure location is invented.';
  }
  $('rejection-detail').textContent=detail;
  $('rejection-geometry-note').textContent=$('show-rejected').checked?note:'Red rejection overlay hidden.';
  if(!$('show-rejected').checked)return;
  addLine(candidate.points,rejectionColor,{dashed:true,opacity:.7});
  if(r?.segment){const [start,end]=r.segment;addLine(candidate.points.slice(start,end+1),rejectionColor,{width:.048});}
  addRejectionBox(paths,r?.position_box);
}
function focusRejection(){
  const candidate=getEpoch()?.epoch.candidates[selectedCandidate],r=candidate?.rejection;
  if(!r?.segment)return;
  const [a,b]=r.segment;
  const center=r.position_box?.center||candidate.points[a].map((v,i)=>(v+candidate.points[b][i])/2);
  const distance=Math.max(1.5,3*Math.hypot(...(r.position_box?.radius||[0,0,0])));
  view='rejection';lastAnchor=null;controls.target.set(...center);
  camera.position.copy(controls.target).add(new THREE.Vector3(1,-1,.7).normalize().multiplyScalar(distance));
  fitCameraAspect();camera.lookAt(controls.target);controls.update();
  document.querySelectorAll('[data-view]').forEach(button=>button.classList.remove('active'));
}
function updateInspector(epoch,candidate,com,index){
  $('epoch-label').textContent=`EPOCH ${String(index).padStart(3,'0')}`;
  $('model-value').textContent=`v${epoch.model_version}`;
  $('switch-value').textContent=com?number(com.switch_seconds,' s'):candidate?number(candidate.switch_seconds,' s'):'—';
  const verification=candidate?.verification||com?.verification;
  $('margin-value').textContent=number(verification?.min_margin,' m');
  $('margin-value').style.color=verification?.min_margin<0?'#e99c92':'';
  if(data.mode==='nominal'){
    $('decision-label').textContent='NOMINAL PERFORMANCE TEST';$('decision-title').textContent='Nominal MPPI trajectory';
    $('decision-detail').textContent='Optimized thrust and body-rate commands are executed on the nominal plant. Gatekeeper is not active in this diagnostic.';
  }else if(!com){
    $('decision-label').textContent='INITIALIZATION REJECTED';$('decision-title').textContent='No commitment. Flight is refused.';
    $('decision-detail').textContent=`The initial backup failed verification: ${humanReason(verification?.reason)}. This is a static audit, not executed motion.`;
  }else if(com.retained){
    $('decision-label').textContent='PROPOSAL REJECTED';$('decision-title').textContent='The previous commitment stays active.';
    $('decision-detail').textContent=`${humanReason(verification?.reason)}. Commitment ${com.id} retains model v${com.model_version} and its original error envelope.`;
    if(com.verification_end_time!=null&&time>=com.verification_end_time){
      $('decision-detail').textContent+=` It now follows the frozen backup beyond its ${com.verification_end_time.toFixed(1)} s finite check; this continuation has no certified tube.`;
    }
  }else if(candidate&&!candidate.verification.accepted){
    $('decision-label').textContent='LONGER CANDIDATE REJECTED';$('decision-title').textContent='A shorter candidate was committed.';
    $('decision-detail').textContent=`The inspected ${candidate.switch_seconds.toFixed(2)} s proposal failed: ${humanReason(verification.reason).toLowerCase()}. Active commitment ${com.id} switches to backup after ${com.switch_seconds.toFixed(2)} s.`;
  }else{
    $('decision-label').textContent='EXPERIMENTAL COMMITMENT';$('decision-title').textContent='Candidate accepted for experimental tracking.';
    $('decision-detail').textContent=`Commitment ${com.id}: ${com.switch_seconds.toFixed(2)} s of racing-reference tracking, then centerline recovery. These development checks are not a safety certificate.`;
  }
}
function updateUncertaintyGeometry(epoch,candidate,com){
  const select=$('uncertainty-source');select.options[0].disabled=!com;select.options[1].disabled=!candidate;select.disabled=!com&&!candidate;
  if(select.value==='committed'&&!com)select.value='candidate';
  const source=select.value==='committed'?com:candidate,name=select.value==='committed'?'Committed':'Candidate';
  const bounds=source?.position_bounds,available=bounds?.radii.length||0;
  const until=available?bounds.start_time+(available-1)*data.dt:null;
  const maxRadius=available?Math.max(...bounds.radii.flat()):null;
  if($('show-uncertainty').checked&&source&&available)addPositionBounds(paths,source.points,bounds,epoch.time,data.dt);
  $('uncertainty-badge').classList.toggle('unavailable',!available);
  $('bounds-label').textContent=!$('show-uncertainty').checked?'POSITION BOUNDS HIDDEN':available?`EXPERIMENTAL BOUNDS · ${name.toUpperCase()}`:'NO POSITION BOUND';
  $('bounds-caption').textContent=available?`${number(maxRadius,' m')} max half-width · through ${until.toFixed(2)} s`:'No envelope is drawn for unbounded time.';
  if(available){
    const partial=name==='Candidate'&&available<source.points.length-1;
    $('tube-detail').textContent=`${available} sampled position boxes, at true scale, through ${until.toFixed(2)} s. Maximum axis half-width ${number(maxRadius,' m')}. ${partial?'Verification stopped; the remaining candidate has no recorded bound.':'No bound is extrapolated beyond this horizon.'}`;
  }else if(data.mode==='nominal'){
    $('tube-detail').textContent='The nominal diagnostic has no reachable-tube verifier or model-error bound.';
  }else if(data.mode==='strict'){
    $('tube-detail').textContent='This strict recording has interval radii but no interval centers. A position envelope cannot be reconstructed safely.';
  }else if(com&&name==='Committed'){
    $('tube-detail').textContent=`The committed tube ends at ${com.verification_end_time.toFixed(2)} s. The frozen backup continues beyond it without a recorded enclosure.`;
    $('bounds-caption').textContent=`Committed tube ended at ${com.verification_end_time.toFixed(2)} s`;
  }else{
    $('tube-detail').textContent='Verification stopped before recording a position-bound node for this candidate.';
  }
}
function updateUncertaintyValues(sample){
  const hasError=data.mode==='experimental'&&data.samples.length>1;
  $('error-bound-value').textContent=hasError?number(sample.local_error_bound):'—';
  $('error-value').textContent=hasError?number(sample.residual_error_diagnostic):'—';
  $('spread-value').textContent=hasError?number(sample.ensemble_disagreement):'—';
  $('error-model-caption').textContent=`Planner model v${sample.model_version} · acceleration error, m/s²`;
  $('coverage-detail').textContent=sample.finite_tube_coverage?'Executed step has a finite tube':hasError&&time>0?'No finite tube for this step':'No executed bound to compare';
  $('bound-miss-detail').hidden=!sample.state_bound_exceeded;
  $('bound-miss-detail').textContent=sample.state_bound_exceeded?`The step ending at ${sample.time.toFixed(2)} s exceeded its previous committed state bound: ${sample.exceeded_components.join(', ')}. The 3D boxes show position only.`:'';
}
function drawUncertaintyChart(){
  if(!data)return;
  const canvas=$('uncertainty-chart'),r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,2);
  canvas.width=Math.max(1,r.width*dpr);canvas.height=Math.max(1,r.height*dpr);
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);const w=r.width,h=r.height,bottom=h-17;
  const samples=data.samples,end=samples.at(-1)?.time||1;
  if(data.mode!=='experimental'||samples.length<2){ctx.fillStyle='#8b829a';ctx.font='10px system-ui';ctx.fillText('No executed uncertainty series in this run.',2,35);return;}
  const maximum=Math.max(data.trust_threshold,...samples.map(s=>s.local_error_bound||0)) *1.08;
  // Gray bands are missing finite-horizon coverage, not zero uncertainty.
  for(let i=1;i<samples.length;i++)if(!samples[i].finite_tube_coverage){ctx.fillStyle='#88848f17';ctx.fillRect(samples[i-1].time/end*w,0,Math.max(1,(samples[i].time-samples[i-1].time)/end*w),bottom);}
  const y=v=>bottom-v/maximum*(bottom-10);
  ctx.strokeStyle='#3a363f';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(0,y(data.trust_threshold));ctx.lineTo(w,y(data.trust_threshold));ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#77717f';ctx.font='7px system-ui';ctx.fillText(`Trust limit ${data.trust_threshold.toFixed(1)}`,2,y(data.trust_threshold)-3);
  for(const [key,color] of [['local_error_bound','#edba74'],['residual_error_diagnostic','#e1e4e9'],['ensemble_disagreement','#b4a0fb']]){
    ctx.beginPath();let started=false;for(const s of samples){const value=s[key];if(value==null){started=false;continue;}const x=s.time/end*w;if(started)ctx.lineTo(x,y(value));else ctx.moveTo(x,y(value));started=true;}
    ctx.strokeStyle=color;ctx.lineWidth=1.3;ctx.stroke();
  }
  ctx.strokeStyle='#f0796d';ctx.lineWidth=2;for(const s of samples)if(s.state_bound_exceeded){const x=s.time/end*w;ctx.beginPath();ctx.moveTo(x,bottom-7);ctx.lineTo(x,bottom+1);ctx.stroke();}
  ctx.strokeStyle='#ede8f4aa';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(time/end*w,2);ctx.lineTo(time/end*w,bottom);ctx.stroke();
  ctx.fillStyle='#797381';ctx.font='8px system-ui';ctx.fillText('0 s',0,h-2);ctx.textAlign='right';ctx.fillText(`${end.toFixed(1)} s`,w,h-2);
}
function humanReason(reason){return ({trusted_domain:'The reachable state-control region exceeds the trusted error threshold',reachable_tube_boundary:'The predicted tube overlaps a gate or track boundary',terminal_recovery:'Recovery cannot reach the required backup envelope',backup_invariance_unestablished:'Indefinite backup safety has not been proved',flow_enclosure_failed:'The nonlinear flow could not be enclosed',experimental_checks_passed:'Finite-horizon experimental checks passed'})[reason]||reason||'No candidate available';}
function sampleAt(t){
  const samples=data.samples;if(!samples.length)return null;let lo=0,hi=samples.length-1;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(samples[mid].time<=t+1e-7)lo=mid;else hi=mid-1;}
  const a=samples[lo],b=samples[Math.min(lo+1,samples.length-1)],f=b.time>a.time?THREE.MathUtils.clamp((t-a.time)/(b.time-a.time),0,1):0;
  const qa=new THREE.Quaternion(a.state[7],a.state[8],a.state[9],a.state[6]),qb=new THREE.Quaternion(b.state[7],b.state[8],b.state[9],b.state[6]);qa.slerp(qb,f);
  return {...a,index:lo,p:a.state.slice(0,3).map((v,i)=>v+(b.state[i]-v)*f),q:qa,speed:a.speed+(b.speed-a.speed)*f};
}
function updateTime(){
  if(!data)return;const end=data.samples.at(-1)?.time||0;time=THREE.MathUtils.clamp(time,0,end);
  $('timeline').value=time;$('clock').innerHTML=`${clock(time)} <em>/ ${clock(end)}</em>`;
  const sample=sampleAt(time);if(sample){drone.position.set(...sample.p);drone.quaternion.copy(sample.q);$('speed-value').textContent=sample.speed.toFixed(1);$('gates-value').textContent=String(sample.gates).padStart(2,'0');
    if(view==='follow'||view==='drone'){if(lastAnchor){const delta=drone.position.clone().sub(lastAnchor);camera.position.add(delta);controls.target.add(delta);}lastAnchor=drone.position.clone();}
    if(trail)dispose(trail);
    const past=data.samples.slice(0,sample.index+1).map(s=>new THREE.Vector3(...s.state.slice(0,3)));past.push(drone.position.clone());
    const geometry=new THREE.BufferGeometry().setFromPoints(past),colored=$('color-uncertainty').checked&&data.mode==='experimental';
    if(colored){const values=data.samples.slice(0,sample.index+1).map(s=>s.local_error_bound);values.push(sample.local_error_bound);geometry.setAttribute('color',new THREE.Float32BufferAttribute(values.flatMap(value=>errorColor(value,data.trust_threshold).toArray()),3));}
    trail=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:colored?0xffffff:colors.trail,vertexColors:colored,transparent:true,opacity:colored ? .95 : .42,toneMapped:false}));trail.visible=$('show-trail').checked;scene.add(trail);
    missMarkers.children.forEach(marker=>marker.visible=marker.userData.time<=time+1e-7);
    updateUncertaintyValues(sample);
  }
  updatePaths();drawChart();drawUncertaintyChart();
}
function drawChart(){
  if(!data)return;const canvas=$('speed-chart'),r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,2);canvas.width=Math.max(1,r.width*dpr);canvas.height=Math.max(1,r.height*dpr);const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);const w=r.width,h=r.height;ctx.clearRect(0,0,w,h);
  const samples=data.samples,peak=Math.max(1,...samples.map(s=>s.speed)),end=samples.at(-1)?.time||1;
  ctx.strokeStyle='#30353b';ctx.lineWidth=.5;for(const f of [.3,.65,1]){ctx.beginPath();ctx.moveTo(0,h*f-12);ctx.lineTo(w,h*f-12);ctx.stroke();}
  ctx.beginPath();samples.forEach((s,i)=>{const x=s.time/end*w,y=h-15-s.speed/peak*(h-25);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.strokeStyle='#71e2db';ctx.lineWidth=1.3;ctx.stroke();
  ctx.beginPath();ctx.moveTo(time/end*w,4);ctx.lineTo(time/end*w,h-12);ctx.strokeStyle='#dfe4ed80';ctx.lineWidth=1;ctx.stroke();
  ctx.font='8px system-ui';ctx.fillStyle='#68727e';ctx.fillText('0 s',0,h-1);ctx.textAlign='right';ctx.fillText(end.toFixed(1)+' s',w,h-1);
}
async function loadRun(filename){
  const request=++loadRequest;setPlaying(false);const response=await fetch(`./data/${filename}`);if(!response.ok)throw new Error(`Recording could not be loaded (${response.status}).`);const recording=await response.json();if(request!==loadRequest)return;data=recording;time=0;epochIndex=-1;selectedCandidate=0;
  $('scene-error').hidden=true;if(trail){dispose(trail);trail=null;}
  while(missMarkers.children.length)dispose(missMarkers.children[0]);
  data.samples.filter(s=>s.state_bound_exceeded).forEach(s=>{const marker=new THREE.Mesh(new THREE.SphereGeometry(.065,12,10),new THREE.MeshBasicMaterial({color:0xf0796d,toneMapped:false}));marker.position.set(...s.state.slice(0,3));marker.userData.time=s.time;missMarkers.add(marker);});
  $('uncertainty-source').value=data.epochs[0]?.commitment?'committed':'candidate';
  $('uncertainty-mode').textContent=data.mode.toUpperCase();
  $('color-uncertainty').disabled=data.mode!=='experimental'||data.samples.length<2;
  $('next-bound-miss').disabled=!data.samples.some(s=>s.state_bound_exceeded);
  $('error-scale-max').textContent=number(data.trust_threshold,' m/s²',1);
  while(course.children.length)dispose(course.children[0]);data.track.gates.forEach((g,i)=>course.add(createGate(g,i)));
  $('timeline').max=data.samples.at(-1)?.time||0;$('timeline').disabled=data.samples.length<2;$('play').disabled=data.samples.length<2;
  $('peak-value').textContent=number(data.metrics.max_speed,' m/s peak',1);
  $('assurance-text').textContent=data.mode==='nominal'?'Nominal-model diagnostic. No uncertain-dynamics safety claim. Planning runs offline; the browser replays the recording.':data.mode==='strict'?'Strict verification fails closed. The nonlinear enclosure and a robustly invariant backup must be established before flight can be authorized.':'Experimental simulation. The linearized tube and terminal recovery envelope have not established a formal nonlinear safety guarantee.';
  if(data.mode==='experimental'&&data.metrics.duration){
    $('assurance-text').textContent+=` ${data.metrics.full_state_tube_violations} full-state enclosure misses in ${data.metrics.tube_covered_steps} checked steps; ${data.metrics.continuation_steps} steps beyond the finite check.`;
  }
  $('recording-note').textContent=`Seed ${data.seed} · ${data.status.replaceAll('_',' ')} · ${number(data.metrics.median_solver_ms,' ms planning',0)}`;
  updateTime();resetCamera();
}
function setPlaying(value){playing=value;$('play').textContent=playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',playing?'Pause replay':'Play replay');}
$('play').onclick=()=>{if(time>=(data.samples.at(-1)?.time||0))time=0;setPlaying(!playing);updateTime();};
$('restart').onclick=()=>{time=0;setPlaying(false);epochIndex=-1;updateTime();};
$('timeline').oninput=e=>{time=Number(e.target.value);setPlaying(false);updateTime();};
$('candidate').onchange=e=>{selectedCandidate=Number(e.target.value);updatePaths(true);};
$('next-decision').onclick=()=>{const next=data.epochs.find(e=>e.time>time+.0001);if(next){time=next.time;setPlaying(false);updateTime();}};
$('reset-camera').onclick=resetCamera;
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{view=button.dataset.view;resetCamera();});
['candidate','committed','backup','nominal','trail'].forEach(key=>$(`show-${key}`).onchange=()=>{updatePaths(true);if(trail)trail.visible=$('show-trail').checked;});
$('run').onchange=e=>loadRun(e.target.value).catch(showError);
$('show-uncertainty').onchange=()=>updatePaths(true);
$('show-rejected').onchange=()=>updatePaths(true);
$('focus-rejection').onclick=focusRejection;
$('uncertainty-source').onchange=()=>updatePaths(true);
$('color-uncertainty').onchange=updateTime;
$('next-bound-miss').onclick=()=>{const misses=data.samples.filter(s=>s.state_bound_exceeded);const next=misses.find(s=>s.time>time+1e-6)||misses[0];if(next){time=next.time;setPlaying(false);updateTime();}};
function showError(error){console.error(error);$('scene-error').hidden=false;$('scene-error').textContent=error.message;$('decision-label').textContent='REPLAY UNAVAILABLE';}
function frame(now){requestAnimationFrame(frame);const delta=Math.min((now-lastFrame)/1000,.1);lastFrame=now;if(data&&playing){time+=delta*Number($('playback-speed').value);if(time>=data.samples.at(-1).time)setPlaying(false);updateTime();}if(playing)rotors.forEach((r,i)=>r.rotation.z+=(i%2?1:-1)*delta*60);controls?.update();if(renderer)renderer.render(scene,camera);}
try{initScene();requestAnimationFrame(frame);const response=await fetch('./data/index.json');if(!response.ok)throw new Error('No recordings found. Run the simulation and export the demo data first.');const runs=await response.json();$('run').replaceChildren(...runs.map(run=>{const option=document.createElement('option');option.value=run.file;option.textContent=run.label;return option;}));if(!runs.length)throw new Error('The recording index is empty.');await loadRun(runs[0].file);}catch(error){showError(error);}
