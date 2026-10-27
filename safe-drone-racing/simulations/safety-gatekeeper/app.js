import { describeScenario, withDiffReachScenario } from './scenarios.js?v=11';
import { drawTubeProfile } from './tube-profile.js';
import { drawFlightDiagnostics } from './flight-diagnostics.js';
import { updateKnowledge } from './knowledge.js?v=5';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createGate, createDrone } from './models.js?v=3';
import { addPositionBounds, addSweptBounds, addCurrentBound, errorColor } from './uncertainty.js?v=5';
import { reachabilityFrame, splitReference, referenceInterval } from './reachability-view.js';
import { addRejectionBox, rejectionColor } from './rejection.js';
import { FullTubeStore, selectedBounds } from './full-tubes.js';

const $=id=>document.getElementById(id);
const originalMethodText={propagation:$('method-propagation-explanation').textContent,limitations:$('method-limitations').textContent,accepted:$('accepted-trajectory-explanation').textContent,startup:$('startup-explanation').textContent};
const colors={candidate:0xedba74,committed:0x71e2db,backup:0x9691ef,trail:0xd2d8e0,nominal:0x7688a7};
let data,time=0,playing=false,view='overview',epochIndex=-1,selectedCandidate=0,manualCandidate=false,lastFrame=0,lastAnchor=null,loadRequest=0;
let renderer,scene,camera,controls,course,paths,drone,rotors=[],trail,missMarkers;
let environment=null,environmentRequest=0,courseRoute=null;
let reachTime=0,reachPlaying=false,reachKey=null,reachState=null,reachLastDraw=0;
let fullTubeStore=null,fullTubeRow=null,fullTubeRequestKey=null,fullTubeStatus='idle',fullTubeError='';
const clock=value=>`${String(Math.floor(value/60)).padStart(2,'0')}:${(value%60).toFixed(2).padStart(5,'0')}`;
const number=(x,suffix='',digits=2)=>x==null||!Number.isFinite(x)?'—':x.toFixed(digits)+suffix;
const matched=()=>data?.method==='diffreach-robotics-matched';
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
  if(camera){camera.near=.05;camera.far=150;controls.maxDistance=55;scene.fog=new THREE.Fog('#1b1d20',42,90);}
  if(['rejection','event','candidate-tube'].includes(view))view='overview';
  const point=drone?.position.clone()||new THREE.Vector3(0,0,3);lastAnchor=null;
  if(view==='follow'||view==='drone'){controls.target.copy(point);camera.position.copy(point).add(new THREE.Vector3(...(view==='drone'?[-.50,-.60,.36]:[-2.7,-3.3,1.8])));lastAnchor=point.clone();}
  else if(data?.track.layout==='stacked'){controls.target.set(0,0,2.8);camera.position.set(...(view==='top'?[0,-.01,37]:[13,-31,23]));}
  else {controls.target.set(0,0,1.8);camera.position.set(...(view==='top'?[0,-.01,31]:[18,-24,23]));}
  fitCameraAspect();
  camera.lookAt(controls.target);controls.update();
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  sceneContext();
}
function sceneContext(){
  const detail=matched()&&view==='candidate-tube';
  if(drone)drone.visible=!detail;
  document.querySelector('.scene-panel').classList.toggle('tube-focus',Boolean(detail));
  course?.traverse(child=>{if(child.isSprite)child.visible=!detail;const materials=Array.isArray(child.material)?child.material:[child.material];materials.filter(Boolean).forEach(m=>{
    m.userData.originalOpacity??=m.opacity;m.userData.originalTransparent??=m.transparent;
    m.opacity=detail?.18:m.userData.originalOpacity;m.transparent=detail||m.userData.originalTransparent;
  });});
}
function resize(){
  if(!renderer)return;const r=$('scene').getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;fitCameraAspect();drawChart();drawUncertaintyChart();
}
function fitCameraAspect(){camera.zoom=['overview','top','rejection'].includes(view)?Math.min(1,camera.aspect/1.2):1;if(data?.track.layout==='stacked'&&view==='overview')camera.zoom*=1.35;camera.updateProjectionMatrix();}
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
function candidateBounds(candidate){
  if(matched())return candidate?.position_bounds;
  return data.mode==='diffreach'?selectedBounds(candidate,fullTubeRow?.candidates[selectedCandidate],$('tube-extent').value):candidate?.position_bounds;
}
function requestFullTube(epoch,index){
  if(data.mode!=='diffreach'||$('tube-extent').value!=='full'||!fullTubeStore)return;
  const key=`${loadRequest}:${index}`;
  if(fullTubeRequestKey===key)return;
  fullTubeRequestKey=key;fullTubeRow=null;fullTubeStatus='loading';fullTubeError='';
  fullTubeStore.load(index,epoch).then(row=>{
    if(key!==fullTubeRequestKey)return;
    fullTubeRow=row;fullTubeStatus='ready';reachKey=null;updatePaths(true);
    if(view==='candidate-tube')fitCandidateTube(epoch.candidates[selectedCandidate]);
  }).catch(error=>{
    if(key!==fullTubeRequestKey)return;
    fullTubeStatus='error';fullTubeError=error.message;updatePaths(true);
  });
}
function updatePaths(force=false){
  const found=getEpoch();if(!found)return;const {epoch,index}=found;
  if(!force&&epochIndex===index)return;const changed=epochIndex!==index;epochIndex=index;
  if(changed){selectedCandidate=manualCandidate?Math.min(selectedCandidate,Math.max(0,epoch.candidates.length-1)):matched()?(epoch.selection.index??0):Math.max(0,epoch.candidates.findIndex(c=>c.verification.accepted));$('candidate').replaceChildren(...epoch.candidates.map((c,i)=>{const option=document.createElement('option');option.value=i;option.textContent=`${c.switch_seconds===0?'Backup immediately':`${c.switch_seconds.toFixed(2)} s of racing, then backup`} · ${matched()&&epoch.selection.index===i?'committed':c.verification.accepted?(matched()?'passed':'accepted'):'rejected'}`;return option;}));$('candidate').value=selectedCandidate;}
  if(!epoch.candidates.length){const option=document.createElement('option');option.textContent='No Gatekeeper candidate in this run';$('candidate').replaceChildren(option);}
  $('candidate').disabled=!epoch.candidates.length;
  while(paths.children.length)dispose(paths.children[0]);
  const candidate=epoch.candidates[selectedCandidate],com=epoch.commitment;
  requestFullTube(epoch,index);
  if($('show-nominal').checked)addLine(epoch.nominal,colors.nominal,{opacity:.7,width:.024});
  if(candidate){const split=Math.round(candidate.switch_seconds/data.dt);
    const checked=data.mode==='diffreach'?splitReference(candidate.points,Math.max(0,(candidateBounds(candidate)?.validated_until??epoch.time)-epoch.time),data.dt):null;
    const points=checked?checked.checked:candidate.points;
    if($('show-candidate').checked)addLine(points.slice(0,split+1),colors.candidate,{dashed:true,opacity:.9});
    if($('show-backup').checked)addLine(points.slice(split),colors.backup,{dashed:true,opacity:.85});
    if(checked&&($('show-candidate').checked||$('show-backup').checked))addLine(checked.remaining,0x747d8c,{dashed:true,opacity:.45});
  }
  if(com&&$('show-committed').checked){const refStart=com.reference_start_time??com.start_time;const offset=Math.max(0,Math.floor((time-refStart)/data.dt));const split=Math.max(0,Math.round((com.start_time+com.switch_seconds-refStart)/data.dt));
    addLine(com.points.slice(offset),colors.committed,{width:matched()?0:data.mode==='diffreach'?.012:.035});
    if($('show-backup').checked)addLine(com.points.slice(Math.max(offset,split)),colors.backup,{opacity:.95,dashed:true});
  }
  updateUncertaintyGeometry(epoch,candidate,com);
  updateRejection(epoch,candidate);
  updateInspector(epoch,candidate,com,index);
  if((changed||reachPlaying)&&view==='candidate-tube')fitCandidateTube(candidate);
}
function updateRejection(epoch,candidate){
  const rejected=candidate&&!candidate.verification.accepted,r=candidate?.rejection;
  $('show-rejected').disabled=!rejected;
  $('focus-rejection').disabled=!rejected||!r?.segment||!$('show-rejected').checked;
  if(!rejected){
    $('rejection-title').textContent=candidate?'This candidate passed the trajectory checks.':'No Gatekeeper candidate in this run.';
    $('rejection-detail').textContent='';$('rejection-geometry-note').textContent='';return;
  }
  const names={trusted_domain:'Acceleration-error bound exceeds the allowed limit',reachable_tube_boundary:'Position uncertainty overlaps a gate or course boundary',terminal_recovery:'Position, velocity or tilt error is too large at the end',backup_invariance_unestablished:'Continued backup safety has not been proved',neural_policy_interval_bound_unimplemented:'No validated enclosure for the neural controller',flow_enclosure_failed:'A bound on the predicted motion could not be computed',picard_remainder_inclusion_failed:'A nonlinear flow enclosure could not be established',invalid_model_error_bound:'The model-error allowance was not finite or valid',finite_horizon_checks_passed:'The finite-horizon nonlinear checks passed'};
  $('rejection-title').textContent=names[r?.reason||candidate.verification.reason]||'Candidate rejected';
  let detail='',note='Red marks the first failed check. Later steps were not checked.';
  if(r?.segment){
    const offset=number(r.time_offset,' s'),absolute=number(epoch.time+r.time_offset,' s');
    if(data.mode==='diffreach'){
      detail=`The check failed during +${number(r.interval_offsets[0],'',4)}–${number(r.interval_offsets[1],' s',4)} of this candidate. ${humanReason(r.reason)}.`;
      const failedBound=candidate.verification.reachability?.failure?.error;
      if(r.reason==='trusted_domain'&&Number.isFinite(failedBound))detail+=` Queried-region bound: ${number(failedBound,'',3)} > ${number(data.trust_threshold,' m/s²',3)} allowed.`;
      if(r.boundary_margin!=null)detail+=` Boundary margin: ${number(r.boundary_margin,' m',3)}.`;
      note=r.position_box?'Red box: the position projection of the saved failed-check region, at its computed center. The crosshair marks that center; it is not an uncertainty radius.':'The saved failure interval is red. No failure box was saved, so no spatial region is invented.';
      if(r.position_box&&r.region_validated===false)note='Red box: the attempted region at which enclosure construction failed. This region is not a validated bound. The crosshair marks its center.';
    }else if(data.mode==='strict'){
      detail=`Failed during +${number(r.interval_offsets[0])}–${number(r.interval_offsets[1],' s')}. Only the predicted segment can be located; the uncertainty set and error value were not saved.`;
      note='Only the first failed-check interval is red. No failure box is invented.';
    }else if(r.reason==='trusted_domain'){
      detail=`${number(r.error_bound)} > ${number(r.threshold)} m/s² at +${offset} (predicted time ${absolute}). The bound on acceleration prediction error is too large here, after accounting for uncertainty in states and commands.`;
      note+=' The red box is its position projection; the crosshair only marks its center.';
    }else if(r.reason==='reachable_tube_boundary'){
      detail=`First negative boundary margin: ${number(r.boundary_margin,' m',3)}, during +${number(r.interval_offsets[0])}–${number(r.interval_offsets[1],' s')}. The predicted motion between these samples, including position uncertainty, does not leave enough clearance.`;
      note+=' Red box: saved endpoint position bound. The larger swept box was not saved.';
    }else{
      const failed=Object.entries(candidate.verification.terminal_checks||{}).filter(([,check])=>!check.passed);
      detail=failed.length?`At +${offset}: ${failed.map(([name,check])=>`${name==='velocity'?'velocity error':name} including uncertainty ${number(check.value,'',3)} > ${number(check.limit,'',3)} ${check.unit}`).join('; ')}.`:
        `The endpoint at +${offset} (predicted time ${absolute}) fails the combined terminal position, velocity and tilt limits.`;
      note='Red box: terminal position projection. The failure may involve velocity or tilt; red does not imply a position collision. The crosshair marks the endpoint.';
    }
  }else{
    detail='The log records the rejection reason but not enough information to locate its failed check.';
    note='No failure location is recorded, so no red region is drawn.';
  }
  $('rejection-detail').textContent=detail;
  if(matched())note+=r.region_validated===false?' Later steps were attempted, but no enclosure is established after this failure.':' Propagation continues after this geometry failure; only the first failed interval is red.';
  $('rejection-geometry-note').textContent=$('show-rejected').checked?note:'Red rejection overlay hidden.';
  if(!$('show-rejected').checked)return;
  const failedReference=r?.segment?(data.mode==='diffreach'&&r.interval_offsets
    ?referenceInterval(candidate.points,...r.interval_offsets,data.dt)
    :candidate.points.slice(r.segment[0],r.segment[1]+1)):null;
  if(data.mode==='diffreach'&&reachState&&$('uncertainty-source').value==='candidate'){
    if(reachState.failureVisible){
      if(failedReference)addLine(failedReference,rejectionColor,{width:.048});
      addRejectionBox(paths,r?.position_box);
    }else $('rejection-geometry-note').textContent=note+' Move the reachable-set cursor to the failed interval, or use Focus rejection, to display this region.';
    return;
  }
  if(failedReference)addLine(failedReference,rejectionColor,{width:.048});
  addRejectionBox(paths,r?.position_box);
}
function focusRejection(){
  const candidate=getEpoch()?.epoch.candidates[selectedCandidate],r=candidate?.rejection;
  if(!r?.segment)return;
  if(data.mode==='diffreach'){
    $('uncertainty-source').value='candidate';updatePaths(true);
    if(reachState){reachTime=r.interval_offsets?.[1]??reachState.inspectionEnd;setReachPlaying(false);updatePaths(true);}
  }
  const [a,b]=r.segment;
  const center=r.position_box?.center||candidate.points[a].map((v,i)=>(v+candidate.points[b][i])/2);
  const distance=Math.max(1.5,3*Math.hypot(...(r.position_box?.radius||[0,0,0])));
  view='rejection';lastAnchor=null;controls.target.set(...center);
  camera.position.copy(controls.target).add(new THREE.Vector3(1,-1,.7).normalize().multiplyScalar(distance));
  fitCameraAspect();camera.lookAt(controls.target);controls.update();
  document.querySelectorAll('[data-view]').forEach(button=>button.classList.remove('active'));
}
function focusCandidateTube(){
  const candidate=getEpoch()?.epoch.candidates[selectedCandidate];
  if(!candidate)return;
  $('uncertainty-source').value='candidate';$('show-uncertainty').checked=true;$('show-swept').checked=true;
  reachTime=Number.POSITIVE_INFINITY;setReachPlaying(false);updatePaths(true);
  view='candidate-tube';lastAnchor=null;fitCandidateTube(candidate);
}
function fitCandidateTube(candidate){
  if(!candidate)return;
  const bounds=$('uncertainty-source').value==='candidate'&&reachState?{...reachState.endpoints,swept:reachState.swept}:candidateBounds(candidate),extent=new THREE.Box3();
  const boxes=[...(bounds?.centers||[]).map((center,i)=>({center,radius:bounds.radii[i]})),...(bounds?.swept||[])];
  if(candidate.rejection?.position_box&&(!reachState||reachState.failureVisible))boxes.push(candidate.rejection.position_box);
  if(reachState?.current)boxes.push(reachState.current);
  for(const box of boxes)for(const sign of [-1,1])extent.expandByPoint(new THREE.Vector3(...box.center.map((v,i)=>v+sign*box.radius[i])));
  if(extent.isEmpty())return;
  extent.getCenter(controls.target);
  const diameter=extent.getSize(new THREE.Vector3()).length();
  const distance=Math.max(.8,diameter/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*1.35/Math.min(1,camera.aspect));
  camera.near=Math.max(.01,distance/10000);camera.far=Math.max(150,distance*10);controls.maxDistance=Math.max(55,distance*2);scene.fog=null;
  camera.position.copy(controls.target).add(new THREE.Vector3(1,-1,.65).normalize().multiplyScalar(distance));
  fitCameraAspect();camera.lookAt(controls.target);controls.update();
  document.querySelectorAll('[data-view]').forEach(button=>button.classList.remove('active'));
  sceneContext();
}
function updateInspector(epoch,candidate,com,index){
  const timing=candidate?.verification.timing;
  $('decision-timing').hidden=!timing;
  $('decision-timing').textContent=timing?`Complete planning update: ${number(epoch.computation?.total_ms,' ms',1)}. Generation + verification of all ${timing.batch_size} switching candidates: ${number(timing.generation_and_verification_ms,' ms',1)}. Batch times, not per-candidate times.`:'';
  $('computation-details').hidden=!timing;
  const components=timing?[
    ['MPPI racing plan',epoch.computation?.planner_ms],
    ['Generate all switching candidates',timing.candidate_generation_ms],
    ['Prepare inputs and shared prefixes',timing.pack_ms],
    ['Propagate reachable sets',timing.kernel_ms],
    ['Read JAX results',timing.transfer_ms],
    ['Course checks and result assembly',timing.unpack_and_geometry_ms],
    ['Decision results / terminal checks',timing.terminal_checks_ms],
    ['Select / retain commitment',timing.selection_ms],
    ['Verification subtotal',timing.verification_total_ms],
    ['Complete planning update',epoch.computation?.total_ms],
  ]:[];
  if(matched())components.splice(0,components.length,
    ['MPPI: 256 samples × 3 iterations',epoch.computation.planner_ms],
    ['Generate all six candidates',epoch.computation.candidate_generation_ms],
    ['Attempt all six full candidate tubes',epoch.computation.reachable_tubes_ms],
    ['Check every time interval',epoch.computation.geometry_checks_ms],
    ['Select and dispatch',epoch.computation.selection_and_dispatch_ms],
    ['Complete planning update',epoch.computation.total_ms]);
  $('computation-values').replaceChildren(...components.flatMap(([label,value])=>{const term=document.createElement('dt'),numberCell=document.createElement('dd');term.textContent=label;numberCell.textContent=number(value,' ms',1);return [term,numberCell];}));
  $('computation-switches').textContent=timing?`Switch to backup after ${(timing.switch_seconds||epoch.candidates.map(c=>c.switch_seconds)).map(t=>number(t,'',1)).join(', ')} s. This candidate then has ${number((candidate.points.length-1)*data.dt-candidate.switch_seconds,' s',1)} of backup. The propagation time includes the feedback policy, model-error queries and nonlinear flow bounds in one compiled computation. Learning and simulated flight are outside this planning-update total. First use may include compilation.`:'';
  $('epoch-label').textContent=`UPDATE ${index+1}`;
  $('model-value').textContent=epoch.model_version;
  $('switch-value').textContent=com?number(com.switch_seconds,' s'):candidate?number(candidate.switch_seconds,' s'):'—';
  const verification=candidate?.verification||com?.verification;
  $('margin-value').textContent=number(verification?.min_margin,' m');
  $('margin-value').style.color=verification?.min_margin<0?'#e99c92':'';
  $('switch-value').previousElementSibling.textContent=data.mode==='unfiltered'?'TRACKER':'TIME TO BACKUP';
  if(data.mode==='unfiltered')$('switch-value').textContent='Neural';
  if(data.mode==='nominal'){
    $('decision-label').textContent='DIRECT PLANNER COMMANDS';$('decision-title').textContent='MPPI racing plan';
    $('decision-detail').textContent='The simulator matches the base model and directly receives the planner’s thrust and body-rate commands. Gatekeeper is off.';
  }else if(data.mode==='unfiltered'){
    $('decision-label').textContent='NEURAL CONTROLLER · NO GATEKEEPER';
    $('decision-title').textContent=data.plant_mode==='base'?'Ground truth matches the base model.':'Ground truth has hidden drag and bias.';
    $('decision-detail').textContent=`MPPI supplies the reference; the neural policy supplies the applied commands. Dynamics learning and policy adaptation are enabled. No candidate is checked or rejected.`;
  }else if(!com){
    $('decision-label').textContent='NEURAL TRACKER · INITIAL BACKUP CHECK';$('decision-title').textContent='The backup candidate did not pass.';
    $('decision-detail').textContent=`No racing segment: the predicted trajectory follows the moving backup immediately at 2 m/s. ${humanReason(verification?.reason)}. Zero racing steps were executed; the red line is a prediction. Preliminary data collection is a separate simulation.`;
    if(data.mode==='diffreach')$('decision-detail').textContent=`${humanReason(verification?.reason)}. The initial candidate was rejected, so no flight was executed. The displayed route is the proposed motion; the boxes and red failed-check region are recorded calculations.`;
  }else if(com.verification.assumed_initial_backup){
    $('decision-label').textContent='INITIAL BACKUP ASSUMED SAFE';
    $('decision-title').textContent='The drone follows the initial backup.';
    $('decision-detail').textContent=`The zero-switch backup was committed under the stated startup assumption. The selected new candidate is ${candidate?.verification.accepted?'accepted':'rejected'}: ${humanReason(verification?.reason)}. Its reachable tube and failure location are shown independently of the flown backup.`;
  }else if(com.retained){
    $('decision-label').textContent='NEURAL TRACKER · PROPOSAL REJECTED';$('decision-title').textContent='The drone continues along its accepted trajectory.';
    $('decision-detail').textContent=`${humanReason(verification?.reason)}. The neural controller keeps following the previously accepted trajectory, using the controller and model used to check it.`;
    if(com.verification_end_time!=null&&time>=com.verification_end_time){
      $('decision-detail').textContent+=data.mode==='diffreach'?` The accepted finite horizon ends at ${com.verification_end_time.toFixed(2)} s. Execution stops rather than continuing beyond that horizon.`:` It continues along the backup after the position bounds end at ${com.verification_end_time.toFixed(1)} s. No position bound has been established for this continuation.`;
    }
  }else if(candidate&&!candidate.verification.accepted){
    $('decision-label').textContent='LONGER CANDIDATE REJECTED';$('decision-title').textContent='A shorter racing segment was accepted.';
    $('decision-detail').textContent=`The inspected ${candidate.switch_seconds.toFixed(2)} s proposal failed: ${humanReason(verification.reason).toLowerCase()}. The accepted trajectory switches to backup after ${com.switch_seconds.toFixed(2)} s.`;
  }else{
    $('decision-label').textContent='NEURAL TRACKER · GATEKEEPER';$('decision-title').textContent='Candidate accepted; the neural tracker follows it.';
    $('decision-detail').textContent=`The neural controller follows ${com.switch_seconds.toFixed(2)} s of the racing plan, then the moving backup at 2 m/s. The uncertainty calculation uses a local linear approximation of the dynamics and controller.`;
    if(data.mode==='diffreach')$('decision-detail').textContent=`The neural controller follows the accepted reference. DiffReach computed nonlinear state enclosures over the recorded finite horizon, subject to the stated uncertainty assumptions and numerical limitations.`;
  }
  if(time<data.dt&&data.initialization?.verification.accepted&&!data.initialization.verification.assumed_initial_backup&&!matched())$('decision-detail').textContent+=' At startup, Gatekeeper first accepted a trajectory that used backup immediately. The first planner update then produced the proposal shown here.';
  if(matched()&&index===0)$('decision-detail').textContent='The initial commitment uses backup immediately (zero switching time). Its complete tube is checked and displayed. The other five candidates remain available for inspection; they do not drive this initial flight interval.';
}
function updateUncertaintyGeometry(epoch,candidate,com){
  const select=$('uncertainty-source');select.options[0].disabled=!com;select.options[1].disabled=!candidate;select.disabled=!com&&!candidate;
  if(select.value==='committed'&&!com)select.value='candidate';
  const source=select.value==='committed'?com:candidate,name=select.value==='committed'?'Accepted':'Candidate';
  const isFull=data.mode==='diffreach'&&select.value==='candidate'&&$('tube-extent').value==='full';
  const bounds=select.value==='candidate'?candidateBounds(candidate):source?.position_bounds,available=bounds?.radii.length||0;
  $('tube-extent').disabled=select.value!=='candidate';
  if(matched())$('tube-extent').disabled=true;
  $('retry-full-tube').hidden=!isFull||fullTubeStatus!=='error';
  $('full-tube-note').textContent=isFull?(fullTubeStatus==='loading'?'Loading the full candidate tube…':fullTubeStatus==='error'?fullTubeError:`Full-horizon bounds computed offline after the recorded rejection. All six candidates took ${number(fullTubeRow?.wall_seconds,' s',2)} for this display calculation, separate from the online timing above. The original acceptance decision is unchanged.`):'Showing only the bounds computed before the online check stopped.';
  if(matched())$('full-tube-note').textContent='Each candidate lasts 2.5 s. Propagation continues after a geometry failure. If nonlinear enclosure construction fails, the remaining reference is gray and has no established tube. Tube view hides the enlarged drone illustration and fades the gates so millimetre-scale bounds remain visible.';
  const swept=bounds?.swept||[];
  const until=available?bounds.start_time+(available-1)*data.dt:null;
  const maxRadius=available?Math.max(...bounds.radii.flat()):null;
  $('reachability-evolution').hidden=data.mode!=='diffreach';
  $('focus-tube').disabled=!candidateBounds(candidate)?.swept?.length&&!candidateBounds(candidate)?.radii?.length;
  $('camera-tube').disabled=$('focus-tube').disabled;
  if(data.mode==='diffreach'&&source){
    const key=`${loadRequest}:${epoch.time}:${selectedCandidate}:${select.value}:${$('tube-extent').value}:${isFull?fullTubeStatus:'online'}`;
    if(key!==reachKey){reachKey=key;reachTime=Number.POSITIVE_INFINITY;setReachPlaying(false);}
    const referenceStart=source.reference_start_time??(select.value==='committed'?source.start_time:epoch.time);
    const originalStart=select.value==='committed'?source.start_time:epoch.time;
    const trace=source.verification.reachability;
    const initialIndex=Math.round((referenceStart-originalStart)/data.dt)-1;
    const initialLow=initialIndex<0?trace?.initial_lower:trace?.endpoint_lower?.[initialIndex];
    const initialHigh=initialIndex<0?trace?.initial_upper:trace?.endpoint_upper?.[initialIndex];
    const initialBox=initialLow&&initialHigh?{center:initialLow.slice(0,3).map((v,i)=>(v+initialHigh[i])/2),radius:initialLow.slice(0,3).map((v,i)=>(initialHigh[i]-v)/2)}:null;
    const failure=source.rejection?{...source.rejection,interval_offsets:source.rejection.interval_offsets?.map(t=>t+originalStart-referenceStart)}:null;
    reachState=reachabilityFrame({bounds,initialBox,failure,referenceStart,candidateDuration:(source.points.length-1)*data.dt,elapsed:reachTime,dt:data.dt});
    reachTime=reachState.selected;
    $('reachability-time').max=reachState.inspectionEnd||0;
    $('reachability-time').value=reachTime;
    $('reachability-time').disabled=!reachState.inspectionEnd;
    $('play-reachability').disabled=!reachState.inspectionEnd;
    $('reachability-clock').textContent=`+${reachTime.toFixed(4)} s / ${reachState.inspectionEnd.toFixed(4)} s`;
    const current=reachState.current;
    const currentText=current?current.kind==='initial'?'Initial-state set.':current.kind==='endpoint'?`Current endpoint at +${current.end.toFixed(4)} s.`:`${reachTime>reachState.validated+1e-9?'Last validated':'Current'} swept interval: +${current.start.toFixed(4)}–${current.end.toFixed(4)} s.`:'No completed set at this cursor time.';
    $('reachability-status').textContent=isFull&&fullTubeStatus!=='ready'?$('full-tube-note').textContent:`${currentText} ${isFull?'Offline enclosure':'Online enclosure'}: ${reachState.validated.toFixed(4)} s of the ${reachState.candidateDuration.toFixed(2)} s candidate. ${reachState.uncheckedSeconds>1e-8?`${reachState.uncheckedSeconds.toFixed(4)} s have no computed enclosure.`:'The entire candidate has a computed enclosure.'}${reachState.failureVisible?' Red marks the first failed check in the original Gatekeeper calculation.':''}`;
    if(matched())$('reachability-status').textContent=`${currentText} Enclosure established through +${reachState.validated.toFixed(2)} s of the ${reachState.candidateDuration.toFixed(2)} s candidate. ${reachState.failureVisible?'Red marks the first failed check; the rest of the established tube stays purple.':''}`;
    drawTubeProfile(bounds,reachTime,data.dt);
    $('show-two-seconds').disabled=!bounds?.swept?.length;
    $('show-all-reachability').disabled=!bounds?.swept?.length;
    if($('show-uncertainty').checked&&reachState.endpoints.radii.length)addPositionBounds(paths,source.points,reachState.endpoints,-Infinity,data.dt);
    if($('show-swept').checked)addSweptBounds(paths,{swept:reachState.swept},-Infinity);
    if($('show-uncertainty').checked||$('show-swept').checked)addCurrentBound(paths,reachState.current);
  }else{
    reachState=null;reachKey=null;setReachPlaying(false);
    if($('show-uncertainty').checked&&source&&available)addPositionBounds(paths,source.points,bounds,epoch.time,data.dt);
  }
  $('swept-control').hidden=data.mode!=='diffreach';
  $('show-swept').disabled=!swept.length;
  const hasBounds=available||swept.length;
  const visibleBounds=$('show-uncertainty').checked||(data.mode==='diffreach'&&$('show-swept').checked);
  const shown=data.mode==='diffreach'&&reachState?{radii:reachState.endpoints.radii,swept:reachState.swept}:bounds;
  const maxTubeRadius=hasBounds?Math.max(0,...(shown?.radii||[]).flat(),...(shown?.swept||[]).flatMap(box=>box.radius)):null;
  const tubeUntil=data.mode==='diffreach'&&reachState?Math.min(reachState.selected,reachState.validated):Math.max(until||0,bounds?.validated_until||0);
  $('uncertainty-badge').classList.toggle('unavailable',!hasBounds);
  $('bounds-label').textContent=!visibleBounds?'POSITION BOUNDS HIDDEN':hasBounds?`POSITION BOUNDS · ${name.toUpperCase()}`:'NO POSITION BOUND';
  $('bounds-caption').textContent=hasBounds?`${matched()?number(maxTubeRadius*1000,' mm',2):number(maxTubeRadius,' m')} shown half-width · through ${data.mode==='diffreach'?'+':''}${tubeUntil.toFixed(2)} s`:'No position bound is available at this time.';
  if(available){
    const partial=name==='Candidate'&&available<source.points.length-1;
    $('tube-detail').textContent=`${available} sampled position boxes, at true scale, through ${until.toFixed(2)} s. Maximum axis half-width ${number(maxRadius,' m')}. ${partial?'Verification stopped; the remaining candidate has no recorded bound.':'No bound is extrapolated beyond this horizon.'}`;
    if(data.mode==='diffreach')$('tube-detail').textContent=`${available} endpoint position boxes and ${swept.length} between-sample boxes. Endpoint bounds end at flight time ${until.toFixed(2)} s; maximum endpoint half-width ${matched()?number(maxRadius*1000,' mm',2):number(maxRadius,' m')}. Centers are computed from the absolute bounds, not placed on the candidate. ${partial?'No enclosure is drawn beyond the computed horizon.':matched()?'The entire tube was used in the decision. The collision check adds the 0.16 m drone radius to these position-center bounds.':isFull?'The bound continues after rejection; it does not mean Gatekeeper accepted the candidate.':'No bound is extrapolated beyond this horizon.'}`;
  }else if(data.mode==='diffreach'){
    $('tube-detail').textContent=swept.length?`${swept.length} recorded between-sample boxes; no completed endpoint bound. The red region identifies the saved failed check. No flight is implied by this prediction.`:'No position enclosure was completed. Inspect the red failed-check region if the log contains one.';
    if(!swept.length)$('bounds-caption').textContent='No completed endpoint bound';
  }else if(data.mode==='nominal'){
    $('tube-detail').textContent='This direct-command recording has no trajectory uncertainty calculation.';
  }else if(data.mode==='unfiltered'){
    $('tube-detail').textContent='Gatekeeper is off. Acceleration-error bounds are plotted below, but no position uncertainty is propagated along the plan.';
    $('bounds-caption').textContent='No Gatekeeper checks in this run';
  }else if(data.mode==='strict'){
    $('tube-detail').textContent='The recording does not contain enough information to draw position bounds.';
  }else if(com&&name==='Accepted'){
    $('tube-detail').textContent=`The recorded position bounds end at ${com.verification_end_time.toFixed(2)} s. The accepted backup continues beyond that time without recorded position bounds.`;
    $('bounds-caption').textContent=`Position bounds ended at ${com.verification_end_time.toFixed(2)} s`;
  }else{
    $('tube-detail').textContent='The candidate was rejected before a position bound was recorded.';
  }
}
function updateUncertaintyValues(sample){
  const hasError=['experimental','unfiltered','diffreach'].includes(data.mode)&&data.samples.length>1;
  $('error-bound-value').textContent=hasError?number(sample.local_error_bound,'',matched()?4:2):'—';
  $('error-value').textContent=hasError?number(sample.residual_error_diagnostic,'',matched()?4:2):'—';
  $('spread-value').textContent=hasError?number(sample.ensemble_disagreement):'—';
  $('error-model-caption').textContent=`Acceleration prediction error · m/s²`;
  $('coverage-detail').textContent=sample.finite_tube_coverage?'This flight step has recorded state bounds':hasError&&time>0?'No recorded state bounds for this step':'Flight has not started';
  $('bound-miss-detail').hidden=!sample.state_bound_exceeded;
  $('bound-miss-detail').textContent=sample.state_bound_exceeded?`The step ending at ${sample.time.toFixed(2)} s exceeded its previously accepted state bound: ${sample.exceeded_components.join(', ')}. The 3D boxes show position only.`:'';
}
function drawUncertaintyChart(){
  if(!data)return;
  const canvas=$('uncertainty-chart'),r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,2);
  canvas.width=Math.max(1,r.width*dpr);canvas.height=Math.max(1,r.height*dpr);
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);const w=r.width,h=r.height,bottom=h-17;
  const samples=data.samples,end=samples.at(-1)?.time||1;
  if(!['experimental','unfiltered','diffreach'].includes(data.mode)||samples.length<2){ctx.fillStyle='#8b829a';ctx.font='10px system-ui';ctx.fillText('No executed uncertainty series in this run.',2,35);return;}
  const maximum=Math.max(data.trust_threshold,...samples.map(s=>s.local_error_bound||0)) *1.08;
  // Gray bands are missing finite-horizon coverage, not zero uncertainty.
  for(let i=1;i<samples.length;i++)if(!samples[i].finite_tube_coverage){ctx.fillStyle='#88848f17';ctx.fillRect(samples[i-1].time/end*w,0,Math.max(1,(samples[i].time-samples[i-1].time)/end*w),bottom);}
  const y=v=>bottom-v/maximum*(bottom-10);
  if(!matched()){
    ctx.strokeStyle='#3a363f';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(0,y(data.trust_threshold));ctx.lineTo(w,y(data.trust_threshold));ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#77717f';ctx.font='7px system-ui';ctx.fillText(`Error limit ${data.trust_threshold.toFixed(1)}`,2,y(data.trust_threshold)-3);
  }
  for(const [key,color] of [['local_error_bound','#edba74'],['residual_error_diagnostic','#e1e4e9'],['ensemble_disagreement','#b4a0fb']]){
    ctx.beginPath();let started=false;for(const s of samples){const value=s[key];if(value==null){started=false;continue;}const x=s.time/end*w;if(started)ctx.lineTo(x,y(value));else ctx.moveTo(x,y(value));started=true;}
    ctx.strokeStyle=color;ctx.lineWidth=1.3;ctx.stroke();
  }
  ctx.strokeStyle='#f0796d';ctx.lineWidth=2;for(const s of samples)if(s.state_bound_exceeded){const x=s.time/end*w;ctx.beginPath();ctx.moveTo(x,bottom-7);ctx.lineTo(x,bottom+1);ctx.stroke();}
  ctx.strokeStyle='#ede8f4aa';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(time/end*w,2);ctx.lineTo(time/end*w,bottom);ctx.stroke();
  ctx.fillStyle='#797381';ctx.font='8px system-ui';ctx.fillText('0 s',0,h-2);ctx.textAlign='right';ctx.fillText(`${end.toFixed(1)} s`,w,h-2);
}
function humanReason(reason){return ({trusted_domain:'The acceleration-error bound exceeds the allowed limit',reachable_tube_boundary:'The predicted position uncertainty overlaps a gate or course boundary',terminal_recovery:'The position, velocity or tilt error at the end of the candidate exceeds its allowed limit',backup_invariance_unestablished:'Indefinite backup safety has not been proved',flow_enclosure_failed:'A bound on the predicted motion could not be computed',picard_remainder_inclusion_failed:'A nonlinear flow enclosure could not be established',invalid_model_error_bound:'The model-error allowance was not finite or valid',finite_horizon_checks_passed:'The finite-horizon nonlinear checks passed',experimental_checks_passed:'The trajectory checks passed over the checked time interval'})[reason]||reason||'No candidate available';}
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
    if(matched()){
      const epoch=data.epochs.findLast(e=>e.time<=time)||data.epochs[0];
      $('flight-readout').textContent=`Altitude ${sample.p[2].toFixed(2)} m · Requested ${number(sample.desired_velocity?Math.hypot(...sample.desired_velocity):null,' m/s',2)} · MPPI planned peak ${number(epoch.nominal_peak_speed,' m/s',2)}`;
      drawFlightDiagnostics(data,time);
    }
    if(view==='follow'||view==='drone'){if(lastAnchor){const delta=drone.position.clone().sub(lastAnchor);camera.position.add(delta);controls.target.add(delta);}lastAnchor=drone.position.clone();}
    if(trail)dispose(trail);
    const past=data.samples.slice(0,sample.index+1).map(s=>new THREE.Vector3(...s.state.slice(0,3)));past.push(drone.position.clone());
    const geometry=new THREE.BufferGeometry().setFromPoints(past),colored=$('color-uncertainty').checked&&['experimental','unfiltered','diffreach'].includes(data.mode);
    if(colored){const values=data.samples.slice(0,sample.index+1).map(s=>s.local_error_bound);values.push(sample.local_error_bound);geometry.setAttribute('color',new THREE.Float32BufferAttribute(values.flatMap(value=>errorColor(value,data.trust_threshold).toArray()),3));}
    trail=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:colored?0xffffff:colors.trail,vertexColors:colored,transparent:true,opacity:colored ? .95 : .42,toneMapped:false}));trail.visible=$('show-trail').checked;scene.add(trail);
    missMarkers.children.forEach(marker=>marker.visible=marker.userData.time<=time+1e-7);
    const contact=data.outcome?.kind==='gate_contact'&&time>=data.outcome.time-1e-7;
    $('contact-badge').hidden=!contact;
    if(contact)$('contact-badge').textContent=`Gate ${data.outcome.gate} contact · ${data.outcome.time.toFixed(2)} s · Red sphere = collision radius`;
    updateUncertaintyValues(sample);
  }
  updatePaths();drawChart();drawUncertaintyChart();updateKnowledge(data,time);
}
function drawChart(){
  if(!data)return;const canvas=$('speed-chart'),r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,2);canvas.width=Math.max(1,r.width*dpr);canvas.height=Math.max(1,r.height*dpr);const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);const w=r.width,h=r.height;ctx.clearRect(0,0,w,h);
  const samples=data.samples,peak=Math.max(1,...samples.map(s=>s.speed)),end=samples.at(-1)?.time||1;
  ctx.strokeStyle='#30353b';ctx.lineWidth=.5;for(const f of [.3,.65,1]){ctx.beginPath();ctx.moveTo(0,h*f-12);ctx.lineTo(w,h*f-12);ctx.stroke();}
  ctx.beginPath();samples.forEach((s,i)=>{const x=s.time/end*w,y=h-15-s.speed/peak*(h-25);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.strokeStyle='#71e2db';ctx.lineWidth=1.3;ctx.stroke();
  ctx.beginPath();ctx.moveTo(time/end*w,4);ctx.lineTo(time/end*w,h-12);ctx.strokeStyle='#dfe4ed80';ctx.lineWidth=1;ctx.stroke();
  ctx.font='8px system-ui';ctx.fillStyle='#68727e';ctx.fillText('0 s',0,h-1);ctx.textAlign='right';ctx.fillText(end.toFixed(1)+' s',w,h-1);
}
async function loadRun(filename,directory=environment?.directory||''){
  $('environment-content').setAttribute('aria-busy','true');$('environment-content').inert=true;
  $('recording-loading').hidden=false;$('recording-loading').textContent=`Loading ${environment?.label||'the environment'} · ${$('run').selectedOptions[0]?.textContent||'selected scenario'}…`;
  const request=++loadRequest;setPlaying(false);setReachPlaying(false);$('knowledge-time').disabled=true;$('knowledge-view').disabled=true;const response=await fetch(`./data/${directory}${filename}?v=13`,{cache:'no-cache'});if(!response.ok)throw new Error(`Recording could not be loaded (${response.status}).`);const recording=await response.json();if(request!==loadRequest)return;data=recording;time=0;epochIndex=-1;selectedCandidate=0;manualCandidate=false;
  $('scene-error').hidden=true;if(trail){dispose(trail);trail=null;}
  while(missMarkers.children.length)dispose(missMarkers.children[0]);
  data.samples.filter(s=>s.state_bound_exceeded).forEach(s=>{const marker=new THREE.Mesh(new THREE.SphereGeometry(.065,12,10),new THREE.MeshBasicMaterial({color:0xf0796d,toneMapped:false}));marker.position.set(...s.state.slice(0,3));marker.userData.time=s.time;missMarkers.add(marker);});
  if(data.outcome?.kind==='gate_contact'){
    const event=data.outcome,marker=new THREE.Group();marker.userData.time=event.time;
    const sphere=new THREE.Mesh(new THREE.SphereGeometry(event.drone_radius,16,12),new THREE.MeshBasicMaterial({color:0xff4b55,wireframe:true,transparent:true,opacity:.65,depthTest:false,toneMapped:false}));sphere.position.set(...event.position);marker.add(sphere);
    const point=new THREE.Mesh(new THREE.SphereGeometry(.06,16,12),new THREE.MeshBasicMaterial({color:0xff4b55,depthTest:false,toneMapped:false}));point.position.set(...event.contact_point);marker.add(point);
    const approach=data.samples.filter(s=>s.time>=event.time-.8&&s.time<=event.time).map(s=>new THREE.Vector3(...s.state.slice(0,3)));
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(approach),new THREE.LineBasicMaterial({color:0xff4b55,depthTest:false,toneMapped:false}));marker.add(line);missMarkers.add(marker);
  }
  $('uncertainty-source').value=data.epochs[0]?.commitment?'committed':'candidate';
  $('uncertainty-mode').textContent=data.mode==='diffreach'?'CONDITIONAL NONLINEAR BOUNDS':data.gatekeeper_enabled?'APPROXIMATE BOUNDS':'MODEL ERROR ONLY';
  $('camera-tube').hidden=data.mode!=='diffreach';
  $('color-uncertainty').disabled=!['experimental','unfiltered','diffreach'].includes(data.mode)||data.samples.length<2;
  $('next-bound-miss').disabled=!data.samples.some(s=>s.state_bound_exceeded);
  $('error-scale-max').textContent=number(data.trust_threshold,' m/s²',matched()?3:1);
  while(course.children.length)dispose(course.children[0]);data.track.gates.forEach((g,i)=>course.add(createGate(g,i,data.track.layout==='stacked')));
  courseRoute=new THREE.Line(new THREE.BufferGeometry().setFromPoints(data.track.centerline.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color:0xa0aebe,transparent:true,opacity:.6,toneMapped:false}));
  course.add(courseRoute);courseRoute.visible=$('show-course').checked;
  $('timeline').max=data.samples.at(-1)?.time||0;$('timeline').disabled=data.samples.length<2;$('play').disabled=data.samples.length<2;
  $('peak-value').textContent=number(data.metrics.max_speed,' m/s peak',1);
  const hasGatekeeper=!['nominal','unfiltered'].includes(data.mode);
  ['candidate','committed','backup'].forEach(name=>$(`show-${name}`).parentElement.hidden=!hasGatekeeper);
  $('show-nominal').checked=!hasGatekeeper;
  document.querySelector('.trajectory-help').hidden=!hasGatekeeper;
  document.querySelector('.bounds-controls').hidden=!hasGatekeeper;
  const scenario=describeScenario(data);
  const scenarioUrl=new URL(location.href);scenarioUrl.searchParams.set('scenario',String(scenario.number));history.replaceState(null,'',scenarioUrl);
  const isDiffReach=data.mode==='diffreach';
  fullTubeStore=isDiffReach&&!matched()?new FullTubeStore(`./data/${directory}full-tubes`,undefined,data.source_recording_sha256):null;fullTubeRow=null;fullTubeRequestKey=null;fullTubeStatus=matched()?'ready':'idle';
  $('tube-extent').options[0].textContent=matched()?'Full candidate · used by Gatekeeper':'Full candidate · offline continuation';
  $('tube-extent').value='full';reachKey=null;
  const timedUpdates=data.epochs.filter(epoch=>Number.isFinite(epoch.computation?.total_ms));
  const measured=timedUpdates.slice(1);
  const mean=read=>measured.reduce((sum,epoch)=>sum+read(epoch),0)/measured.length;
  const info=data.recording_info;
  $('recording-compute-summary').textContent=isDiffReach&&measured.length&&info?
    `Recorded ${new Date(info.generated_at).toLocaleDateString(undefined,{dateStyle:'medium'})} using JAX on ${info.backend.toUpperCase()}. After the first update, the mean across ${measured.length} updates is ${number(mean(e=>e.computation.total_ms),' ms',1)}: MPPI ${number(mean(e=>e.computation.planner_ms),' ms',1)}, generate six candidates ${number(mean(e=>e.candidates[0].verification.timing.candidate_generation_ms),' ms',1)}, and verify all six ${number(mean(e=>e.candidates[0].verification.timing.verification_total_ms),' ms',1)}. First update: ${number(timedUpdates[0].computation.total_ms,' ms',1)}. These are measured computation times; playback does not simulate processing delays. The target is 100 ms per complete update.`:'';
  const assumedStartup=Boolean(data.initialization?.verification.assumed_initial_backup);
  if(isDiffReach)$('uncertainty-source').value='candidate';
  $('diffreach-explanation').hidden=!isDiffReach;
  $('diffreach-outcome-note').textContent=data.samples.length<2?'The initial check rejected this candidate. The viewer displays its computed bounds and the saved failure region; the drone did not fly.':assumedStartup?'The initial zero-switch backup is assumed safe and committed at startup. Later candidates are checked with DiffReach. Select a switching time to inspect its tube and the red rejection location.':'This recording contains executed motion. Inspect each accepted interval and its bounds; regions outside the recorded horizon have no claimed enclosure.';
  $('method-propagation-explanation').textContent=isDiffReach?'DiffReach encloses the nonlinear dynamics and neural feedback policy over the candidate, using the model-error allowance on each queried region. Gatekeeper checks the computed sets against the course and endpoint requirements. The initial backup may be committed under the explicitly stated startup assumption. Later rejection retains the previously committed reference; the displayed bounds cover only the computed portion.':originalMethodText.propagation;
  $('method-limitations').textContent=isDiffReach?'The construction has a conditional finite-horizon enclosure argument in real arithmetic. It assumes that the error allowance, initial-state limits and measurement-error limits hold. Floating-point rounding is not formally certified, and no indefinite backup-safety guarantee is established. The simulator remains the existing 14-state body-rate/actuator model.':originalMethodText.limitations;
  $('startup-explanation').textContent=assumedStartup?'Startup assumption: the zero-switch moving backup and its continuation are safe. It is committed immediately. The numerical DiffReach result is retained as a diagnostic; later candidates must pass verification before replacing it.':originalMethodText.startup;
  $('accepted-trajectory-explanation').textContent=assumedStartup?'The trajectory currently followed by the drone. The initial backup is committed by assumption. A later candidate replaces it only after passing verification.':isDiffReach?'An accepted reference can remain active when a later proposal is rejected, but only through its checked finite horizon. Execution stops if that horizon expires without a new accepted candidate. No accepted trajectory exists when the initial check rejects.':originalMethodText.accepted;
  $('assurance-text').textContent=scenario.limitation;
  if(assumedStartup)$('assurance-text').textContent+=' The initial backup is assumed safe; its acceptance is not a successful numerical verification.';
  else if(data.initialization?.verification.accepted)$('assurance-text').textContent+=' Startup accepted a moving-backup trajectory using assumed force limits before collecting measurements.';
  if(hasGatekeeper&&data.metrics.duration){
    $('assurance-text').textContent+=isDiffReach&&!assumedStartup?` Recorded state bounds cover ${(data.metrics.tube_covered_steps*data.dt).toFixed(2)} s of this flight. Execution stops when the accepted finite horizon expires; it does not continue an unchecked backup.`:` Recorded state bounds cover ${(data.metrics.tube_covered_steps*data.dt).toFixed(2)} s of this flight; the backup continues for ${(data.metrics.continuation_steps*data.dt).toFixed(2)} s beyond the checked horizons.`;
    if(data.metrics.continuation_terminal_violations)$('assurance-text').textContent+=` In that continuation, ${data.metrics.continuation_terminal_violations} recorded steps exceeded the position, velocity or tilt limits used at candidate endpoints.`;
  }
  document.querySelector('.rejection-panel').hidden=!hasGatekeeper;
  $('recording-note').textContent=`${environment?.label||''} · Scenario ${scenario.number} · ${data.samples.length<2?'No flight: the initial trajectory did not pass the checks':`${number(data.metrics.duration,' s',1)} recorded flight`} · Simulation replay`;
  $('method').hidden=matched();$('matched-method').hidden=!matched();
  $('tube-profile-panel').hidden=!matched();
  $('flight-diagnostics').hidden=!matched();$('flight-readout').hidden=!matched();
  $('performance').hidden=matched();$('model-knowledge').hidden=matched();
  document.querySelectorAll('a[href="#performance"],a[href="#model-knowledge"],.spread-key').forEach(node=>node.hidden=matched());
  $('spread-value').parentElement.hidden=matched();
  document.querySelector('.uncertainty-note').textContent=matched()?'Flight-history colors show the acceleration-error bound at the recorded velocity. This residual depends only on velocity. The color scale is for display, not a rejection threshold. Geometry checks use the propagated full-state sets; gray chart regions have no recorded set.':'Flight-history colors show the acceleration-error bound at each recorded state and command. Gray chart bands mark steps without recorded position bounds. Red ticks mark steps that exceeded a recorded state bound. Network spread measures disagreement between the three dynamics networks; it is not an error bound.';
  document.querySelector('footer span').textContent=matched()?'JAX MPPI · LEARNED RESIDUAL · DIFFREACH · GATEKEEPER':'JAX MPPI · ONLINE RESIDUAL LEARNING · GATEKEEPER';
  if(matched()){
    $('diffreach-explanation').hidden=true;
    $('accepted-trajectory-explanation').textContent='The command schedule selected by Gatekeeper and executed by the same neural feedback controller used in the tube calculation.';
    $('assurance-text').textContent=scenario.limitation+` The recorded sets cover ${(data.metrics.tube_covered_steps*data.dt).toFixed(2)} s of this flight. No unchecked continuation was executed.`;
    $('recording-compute-summary').textContent=measured.length?`Matched 12-state method · ${number(data.metrics.duration,' s',0)} flight · ${data.epochs.length} planning updates. Mean after the first call: ${number(mean(e=>e.computation.total_ms),' ms',1)} per update on ${info.backend.toUpperCase()}. Every update attempts all six 2.5 s candidate tubes. Acceptance requires a complete enclosure. The first calls include compilation. Computation delay is measured separately; this replay does not establish real-time operation. The model and controller were trained before the flight.`:'';
    $('matched-run-summary').textContent=$('recording-compute-summary').textContent;
    const metrics=data.metrics;
    $('matched-run-summary').textContent+=` Actual speed: mean ${number(metrics.mean_speed,' m/s',2)}, peak ${number(metrics.max_speed,' m/s',2)}. Altitude: ${number(metrics.min_altitude,'',2)}–${number(metrics.max_altitude,' m',2)}. ${metrics.passed_candidates??'—'} of ${metrics.total_candidates??'—'} candidates passed. ${metrics.passed_candidates===metrics.total_candidates?'Gatekeeper rejected none of these candidates; this recording does not demonstrate a safety-induced speed reduction.':''}`;
  }
  $('matched-run-summary').hidden=!matched();
  updateTime();if(matched())view='overview';resetCamera();if(isDiffReach&&!matched()){view='candidate-tube';focusCandidateTube();}
  $('environment-content').setAttribute('aria-busy','false');$('environment-content').inert=false;$('recording-loading').hidden=true;
}
async function loadEnvironment(next){
  const request=++environmentRequest;++loadRequest;setPlaying(false);setReachPlaying(false);$('run').disabled=true;
  $('environment-content').setAttribute('aria-busy','true');
  $('environment-content').inert=true;$('recording-loading').hidden=false;$('recording-loading').textContent=`Loading ${next.label}…`;
  $('recording-note').textContent=`Loading ${next.label}…`;
  const response=await fetch(`./data/${next.directory}${next.index}?v=13`,{cache:'no-cache'});
  if(!response.ok)throw new Error(`${next.label} recordings could not be loaded (${response.status}).`);
  const runs=withDiffReachScenario(await response.json());if(request!==environmentRequest)return;
  if(!runs.length)throw new Error(`${next.label} has no recordings.`);
  environment=next;
  $('run').replaceChildren(...runs.map(run=>{const option=document.createElement('option');option.value=run.file;option.textContent=run.label;return option;}));
  $('show-course').checked=next.id==='environment-2';
  const requestedScenario=new URLSearchParams(location.search).get('scenario');
  const selectedRun=runs.find(run=>run.label.startsWith(`Scenario ${requestedScenario} ·`))||runs.find(run=>run.file==='diffreach-matched.json')||runs[0];
  $('run').value=selectedRun.file;
  await loadRun(selectedRun.file,next.directory);if(request!==environmentRequest)return;
  $('run').disabled=false;$('environment-description').textContent=next.description;
  $('environment-content').setAttribute('aria-labelledby',`${next.id}-tab`);$('environment-content').setAttribute('aria-busy','false');
  document.querySelectorAll('[data-environment]').forEach(button=>{const active=button.dataset.environment===next.id;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
  const url=new URL(location.href);url.searchParams.set('environment',next.id);history.replaceState(null,'',url);
  window.dispatchEvent(new CustomEvent('environment-change',{detail:next}));
}
function setPlaying(value){playing=value;$('play').textContent=playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',playing?'Pause replay':'Play replay');}
function setReachPlaying(value){reachPlaying=value;$('play-reachability').textContent=value?'Ⅱ Pause sets':'▶ Evolve sets';$('play-reachability').setAttribute('aria-label',value?'Pause reachable-set evolution':'Play reachable-set evolution');}
$('play').onclick=()=>{if(time>=(data.samples.at(-1)?.time||0))time=0;setPlaying(!playing);updateTime();};
$('restart').onclick=()=>{time=0;setPlaying(false);epochIndex=-1;updateTime();};
$('timeline').oninput=e=>{time=Number(e.target.value);setPlaying(false);updateTime();};
$('candidate').onchange=e=>{manualCandidate=true;selectedCandidate=Number(e.target.value);updatePaths(true);if(view==='candidate-tube')focusCandidateTube();};
$('next-decision').onclick=()=>{const next=data.epochs.find(e=>e.time>time+.0001);if(next){time=next.time;setPlaying(false);updateTime();}};
$('reset-camera').onclick=resetCamera;
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{view=button.dataset.view;resetCamera();});
['candidate','committed','backup','nominal','trail'].forEach(key=>$(`show-${key}`).onchange=()=>{updatePaths(true);if(trail)trail.visible=$('show-trail').checked;});
window.addEventListener('knowledge-seek',event=>{if(!data)return;time=Math.max(0,Math.min(event.detail,data.samples.at(-1).time));setPlaying(false);updateTime();});
$('run').onchange=e=>loadRun(e.target.value).catch(showError);
$('show-course').onchange=()=>{if(courseRoute)courseRoute.visible=$('show-course').checked;};
$('jump-outcome').onclick=()=>{
  const event=data?.outcome;if(event?.kind!=='gate_contact')return;
  time=event.time;setPlaying(false);updateTime();view='event';lastAnchor=null;
  const gate=data.track.gates[event.gate-1],target=new THREE.Vector3(...event.position);
  controls.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(...gate.normal).multiplyScalar(-3.4)).add(new THREE.Vector3(...gate.lateral).multiplyScalar(-1.6)).add(new THREE.Vector3(0,0,1.4));camera.lookAt(target);controls.update();
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.remove('active'));
  $('scene').scrollIntoView({behavior:'smooth',block:'center'});
};
$('show-uncertainty').onchange=()=>updatePaths(true);
$('show-swept').onchange=()=>updatePaths(true);
$('reachability-time').oninput=event=>{reachTime=Number(event.target.value);setReachPlaying(false);updatePaths(true);if(view==='candidate-tube')fitCandidateTube(getEpoch()?.epoch.candidates[selectedCandidate]);};
$('play-reachability').onclick=()=>{if(!reachState)return;if(reachTime>=reachState.inspectionEnd)reachTime=0;setReachPlaying(!reachPlaying);updatePaths(true);};
$('show-all-reachability').onclick=()=>{reachTime=Number.POSITIVE_INFINITY;setReachPlaying(false);updatePaths(true);view='candidate-tube';fitCandidateTube(getEpoch()?.epoch.candidates[selectedCandidate]);};
$('show-two-seconds').onclick=()=>{reachTime=2;setReachPlaying(false);updatePaths(true);view='candidate-tube';fitCandidateTube(getEpoch()?.epoch.candidates[selectedCandidate]);};
$('retry-full-tube').onclick=()=>{fullTubeStore=new FullTubeStore(fullTubeStore.base,undefined,data.source_recording_sha256);fullTubeRequestKey=null;updatePaths(true);};
$('tube-extent').onchange=()=>{reachKey=null;setReachPlaying(false);updatePaths(true);if(view==='candidate-tube')fitCandidateTube(getEpoch()?.epoch.candidates[selectedCandidate]);};
$('restart-reachability').onclick=()=>{reachTime=0;setReachPlaying(false);updatePaths(true);if(view==='candidate-tube')fitCandidateTube(getEpoch()?.epoch.candidates[selectedCandidate]);};
$('show-rejected').onchange=()=>updatePaths(true);
$('focus-rejection').onclick=focusRejection;
$('focus-tube').onclick=focusCandidateTube;
$('camera-tube').onclick=focusCandidateTube;
$('uncertainty-source').onchange=()=>updatePaths(true);
$('color-uncertainty').onchange=updateTime;
$('next-bound-miss').onclick=()=>{const misses=data.samples.filter(s=>s.state_bound_exceeded);const next=misses.find(s=>s.time>time+1e-6)||misses[0];if(next){time=next.time;setPlaying(false);updateTime();}};
function showError(error){console.error(error);$('environment-content').setAttribute('aria-busy','false');$('environment-content').inert=false;$('recording-loading').hidden=true;$('scene-error').hidden=false;$('scene-error').textContent=error.message;$('decision-label').textContent='REPLAY UNAVAILABLE';}
function frame(now){requestAnimationFrame(frame);const delta=Math.min((now-lastFrame)/1000,.1);lastFrame=now;if(data&&playing){time+=delta*Number($('playback-speed').value);if(time>=data.samples.at(-1).time)setPlaying(false);updateTime();}if(data&&reachPlaying&&reachState){reachTime=Math.min(reachState.inspectionEnd,reachTime+delta*Number($('reachability-speed').value));const ended=reachTime>=reachState.inspectionEnd;if(ended)setReachPlaying(false);if(ended||now-reachLastDraw>=50){reachLastDraw=now;updatePaths(true);}}if(playing)rotors.forEach((r,i)=>r.rotation.z+=(i%2?1:-1)*delta*60);controls?.update();if(renderer)renderer.render(scene,camera);}
try{
  initScene();requestAnimationFrame(frame);
  const response=await fetch('./data/environments.json?v=13',{cache:'no-cache'});if(!response.ok)throw new Error('Environment recordings are unavailable.');
  const environments=await response.json();
  $('environments').replaceChildren(...environments.map(item=>{
    const button=document.createElement('button');button.type='button';button.id=`${item.id}-tab`;button.dataset.environment=item.id;button.setAttribute('role','tab');button.setAttribute('aria-controls','environment-content');button.setAttribute('aria-selected','false');button.tabIndex=-1;
    const title=document.createElement('strong'),name=document.createElement('span');title.textContent=item.label;name.textContent=item.name;button.append(title,name);
    button.onclick=()=>loadEnvironment(item).catch(showError);return button;
  }));
  $('environments').onkeydown=event=>{
    const buttons=[...$('environments').children],index=buttons.indexOf(document.activeElement);let next;
    if(event.key==='ArrowRight')next=(index+1)%buttons.length;
    if(event.key==='ArrowLeft')next=(index+buttons.length-1)%buttons.length;
    if(event.key==='Home')next=0;if(event.key==='End')next=buttons.length-1;
    if(next!=null){event.preventDefault();buttons[next].focus();buttons[next].click();}
  };
  const requestedEnvironment=new URLSearchParams(location.search).get('environment');
  await loadEnvironment(environments.find(item=>item.id===requestedEnvironment)||environments[0]);
}catch(error){showError(error);}
