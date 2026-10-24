import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createGate,createDrone} from './models.js';

const $=id=>document.getElementById(id), root='./data/authors-racing/';
const scene=new THREE.Scene();scene.background=new THREE.Color('#292d37');
const renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;
const camera=new THREE.PerspectiveCamera(42,1,.005,1000);camera.up.set(0,0,1);
const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;
scene.add(new THREE.HemisphereLight(0xd6e3ff,0x57564b,2));
const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(-5,-8,20);scene.add(sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(150,150),new THREE.MeshStandardMaterial({color:0x30343f,roughness:1}));ground.position.z=-.05;scene.add(ground);
const courseGroup=new THREE.Group(),tubeGroup=new THREE.Group(),sampleGroup=new THREE.Group(),currentGroup=new THREE.Group();
scene.add(courseGroup,tubeGroup,sampleGroup,currentGroup);
const drone=createDrone();scene.add(drone);
let data=null,index=0,playing=false,elapsed=0,request=0;
const finite=p=>p&&p.length===3&&p.every(Number.isFinite);
function clear(group){while(group.children.length){const child=group.children[0];child.traverse(o=>{o.geometry?.dispose();for(const material of (Array.isArray(o.material)?o.material:[o.material])){if(!material)continue;for(const value of Object.values(material))if(value?.isTexture)value.dispose();material.dispose();}});group.remove(child);}}
function line(parent,points,color,opacity=1){const valid=points.filter(finite);if(valid.length<2)return;const geometry=new THREE.BufferGeometry().setFromPoints(valid.map(p=>new THREE.Vector3(...p)));const mesh=new THREE.Line(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity}));parent.add(mesh);return mesh;}
function box(parent,lo,hi,color,opacity=.35,fill=false){
  if(!finite(lo)||!finite(hi)||hi.some((v,i)=>v<lo[i]))return;
  const size=hi.map((v,i)=>Math.max(v-lo[i],1e-9)),center=hi.map((v,i)=>(v+lo[i])/2);
  const geometry=new THREE.BoxGeometry(...size);
  const wire=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial({color,transparent:true,opacity}));wire.position.set(...center);parent.add(wire);
  if(fill){const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.025,depthWrite:false}));mesh.position.set(...center);parent.add(mesh);}else geometry.dispose();
}
function fit(points){const valid=points.filter(finite);if(!valid.length)return;const bounds=new THREE.Box3().setFromPoints(valid.map(p=>new THREE.Vector3(...p)));const size=bounds.getSize(new THREE.Vector3());const target=bounds.getCenter(new THREE.Vector3());const span=Math.max(size.x,size.y,size.z,.025);orbit.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(1,-1.6,1.1).normalize().multiplyScalar(span*2.2));camera.near=Math.max(.00001,span/10000);camera.far=Math.max(100,span*100);camera.updateProjectionMatrix();orbit.update();}
function candidate(){return data.candidates[index];}
function showCourse(){drone.visible=courseGroup.visible=ground.visible=true;fit(data.track.gates.map(g=>g.center));}
function showTube(){drone.visible=courseGroup.visible=ground.visible=true;const c=candidate();fit([...c.lower,...c.upper,...c.points]);}
function showSet(){drone.visible=courseGroup.visible=ground.visible=false;const c=candidate(),k=Math.round(Number($('time').value)/data.dt);fit([c.lower[k],c.upper[k]]);}
function redraw(){
  if(!data)return;playing=false;$('play').textContent='▶ Evolve sets';
  clear(tubeGroup);clear(sampleGroup);const c=candidate();
  for(let k=0;k<c.lower.length;k+=5)box(tubeGroup,c.lower[k],c.upper[k],k===0||c.inclusion_valid[k-1]?0xb69ae7:0x8d929d,.5);
  if($('slabs').checked)for(let k=0;k<c.slab_lower.length;k++)box(tubeGroup,c.slab_lower[k],c.slab_upper[k],c.inclusion_valid[k]?0x9e80d2:0x8d929d,.18,true);
  line(tubeGroup,c.points,0x64d8df,1);
  for(const points of c.samples)line(sampleGroup,points,0xe9a567,.22);
  line(sampleGroup,c.truth_points,0xffcf91,.9);sampleGroup.visible=$('samples').checked;
  if(c.first_failure){const f=c.first_failure,r=data.body_radius??.16;box(tubeGroup,f.position_lower,f.position_upper,0xff5063,1,true);box(tubeGroup,f.position_lower.map(v=>v-r),f.position_upper.map(v=>v+r),0xff5063,.65);}
  $('decision').textContent=c.passes?'Passes the finite-horizon checks':'Candidate rejected';$('decision').classList.toggle('rejected',!c.passes);
  $('reason').textContent=c.first_failure?`${c.first_failure.reason}. First failure: ${c.first_failure.start.toFixed(2)}–${c.first_failure.end.toFixed(2)} s.`:'All 250 time slabs pass inclusion and separation checks under the stated assumptions.';
  if(c.first_failure)$('reason').textContent+=' The outer red outline includes the 0.16 m body radius; purple boxes bound position only.';
  $('clearance').textContent=`Minimum separation lower bound: ${(1000*c.minimum_separation_bound).toFixed(1)} mm. Recorded true-residual path: ${(1000*c.sampled_truth_minimum_frame_clearance).toFixed(1)} mm minimum gate-frame clearance.`;
  $('failure').disabled=!c.first_failure;
  $('scene-caption').textContent=`${c.switch_seconds.toFixed(1)} s racing + ${(data.horizon-c.switch_seconds).toFixed(1)} s backup`;
  $('case-note').textContent=`Initial speed ${data.initial_speed.toFixed(1)} m/s · gate width ${data.case.width.toFixed(2)} m · ${data.case.scale===0?'no residual':`${data.case.kind} velocity residual, ${data.case.scale}× strength`}.`;
  if(data.geometry_recheck_of)$('case-note').textContent=data.geometry_recheck_description;
  const selected=data.selection.index;
  $('selection').textContent=`Startup uses the zero-switch backup${data.startup.assumed_safe?' by assumption; its numerical check failed':' (it also passes this numerical check)'}. At a later update, ${selected===null?'all six candidates would be rejected and the existing commitment retained.':`the longest passing choice here is ${data.candidates[selected].switch_seconds.toFixed(1)} s before backup.`}`;
  if(data.geometry_recheck_of)$('selection').textContent='Geometry diagnostic only: no startup or commitment is made. The startup-safety assumption from the original course is not transferred to this narrower course. The zero-switch candidate remains available to inspect.';
  $('show-startup').textContent=data.geometry_recheck_of?'Inspect zero-switch candidate':'Inspect zero-switch startup';
  const mc=c.containment;$('containment').textContent=data.case.scale===0?`${mc.samples} simulations coincide in one distinct trajectory because the start and dynamics are exact. ${mc.endpoint_violations} endpoint and ${mc.slab_violations} between-sample containment violations. Repeating this path does not add independent evidence.`:`${mc.samples} independently integrated trajectories: one specified ground-truth residual and ${mc.bounded_error_stress_paths} permitted error signals. ${mc.endpoint_violations} endpoint and ${mc.slab_violations} between-sample containment violations within the checked prefix. RK4 simulation step: 0.5 ms.`;
  $('validity').textContent=`Included prefix: ${c.included_until.toFixed(2)} / ${data.horizon.toFixed(2)} s. All ${c.slab_count} slabs were calculated. Simulation comparison tolerance: ${mc.tolerance} in each state's units. The displayed tube is not enlarged by that tolerance.`;
  $('timing-scope').textContent=data.geometry_recheck_of?'Only the gate-opening check is repeated. Planning, propagation and simulation are reused from the original case.':'One update, including all six candidates. Warm CPU calls; initial compilation is reported separately in the saved report.';
  $('timing').replaceChildren();for(const [key,label] of [['mppi','MPPI search'],['candidate_generation','Six candidate rollouts'],['reachable_tubes','Six complete tubes'],['geometry_checks','Gate and altitude checks'],['total','Complete update']]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=`${data.timing[key].mean_ms.toFixed(1)} ms`;$('timing').append(dt,dd);}
  if(data.geometry_recheck_of){$('timing').replaceChildren();for(const [label,value] of [['Planner and complete tubes','Reused from 0.55 m case'],['Narrower-gate check',`${data.geometry_recheck_ms.toFixed(2)} ms`]]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;$('timing').append(dt,dd);}}
  updateTime();
}
function updateTime(){
  if(!data)return;const c=candidate(),t=Number($('time').value),k=Math.min(c.lower.length-1,Math.round(t/data.dt));
  $('clock').textContent=`+${(k*data.dt).toFixed(2)} s`;clear(currentGroup);box(currentGroup,c.lower[k],c.upper[k],0xffffff,1);
  const p=c.truth_points[k];if(finite(p))drone.position.set(...p);
  const angles=c.truth_angles?.[k];if(finite(angles))drone.rotation.set(...angles,'ZYX');
  const width=c.upper[k]?.map((v,i)=>(v-c.lower[k][i])*1000);
  $('dimensions').textContent=width?.every(Number.isFinite)?`Full width: x ${width[0].toFixed(2)} · y ${width[1].toFixed(2)} · z ${width[2].toFixed(2)} mm`:'No finite position box at this time.';
  crossSection(c,k);
}
function crossSection(c,k){
  const canvas=$('section'),ratio=Math.min(devicePixelRatio,2),w=canvas.clientWidth,h=180;canvas.width=w*ratio;canvas.height=h*ratio;
  const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);ctx.clearRect(0,0,w,h);
  if(!finite(c.lower[k])||!finite(c.upper[k])){ctx.fillStyle='#ddd';ctx.fillText('No finite enclosure',20,40);return;}
  const mid=c.upper[k].map((v,i)=>(v+c.lower[k][i])/2),half=c.upper[k].map((v,i)=>(v-c.lower[k][i])*500);
  const extent=Math.max(half[1],half[2],.01)*1.4,cx=w/2,cy=78,scale=Math.min(w-70,120)/(2*extent);
  ctx.strokeStyle='#354056';ctx.beginPath();ctx.moveTo(25,cy);ctx.lineTo(w-20,cy);ctx.moveTo(cx,15);ctx.lineTo(cx,142);ctx.stroke();
  ctx.fillStyle='#9f82ce44';ctx.strokeStyle='#b69ae7';ctx.fillRect(cx-half[1]*scale,cy-half[2]*scale,half[1]*2*scale,half[2]*2*scale);ctx.strokeRect(cx-half[1]*scale,cy-half[2]*scale,half[1]*2*scale,half[2]*2*scale);
  ctx.fillStyle='#efad6a';for(const p of c.samples.map(path=>path[k])){if(!finite(p))continue;ctx.beginPath();ctx.arc(cx+(p[1]-mid[1])*1000*scale,cy-(p[2]-mid[2])*1000*scale,2,0,2*Math.PI);ctx.fill();}
  ctx.fillStyle='#b5c0d2';ctx.font='10px system-ui';ctx.textAlign='center';ctx.fillText(`y: ±${extent.toFixed(2)} mm`,cx,164);ctx.textAlign='left';ctx.fillText('z',8,20);
  if(k>0&&!c.inclusion_valid[k-1]){ctx.fillStyle='#ff929b';ctx.fillText('Not an established enclosure',12,178);}
}
async function load(file){
  const current=++request;playing=false;$('error').hidden=true;
  document.querySelector('main').inert=true;document.querySelector('main').setAttribute('aria-busy','true');
  $('scene-caption').textContent='Loading benchmark…';$('switch').disabled=true;
  try{const response=await fetch(root+file);if(!response.ok)throw new Error('Benchmark recording unavailable');const next=await response.json();if(current!==request)return;data=next;index=0;clear(courseGroup);
    data.track.gates.forEach((g,i)=>courseGroup.add(createGate(g,i,true)));line(courseGroup,data.track.centerline,0x788396,.25);
    $('switch').replaceChildren(...data.candidates.map((c,i)=>new Option(`${c.switch_seconds.toFixed(1)} s · ${c.passes?'passes':'rejected'}`,i)));
    $('time').max=data.horizon;$('time').value=0;$('switch').disabled=false;redraw();showTube();
    document.querySelector('main').inert=false;document.querySelector('main').setAttribute('aria-busy','false');
    const url=new URL(location.href);url.searchParams.set('case',data.case.id);history.replaceState(null,'',url);
  }catch(e){$('error').textContent=e.message;$('error').hidden=false;}
}
$('switch').addEventListener('change',()=>{index=Number($('switch').value);redraw();});
$('time').addEventListener('input',updateTime);
$('slabs').addEventListener('change',redraw);$('samples').addEventListener('change',()=>{sampleGroup.visible=$('samples').checked;});
$('course-view').addEventListener('click',showCourse);$('tube-view').addEventListener('click',showTube);$('set-view').addEventListener('click',showSet);
$('show-startup').addEventListener('click',()=>{index=data.startup.index;$('switch').value=index;redraw();});
$('failure').addEventListener('click',()=>{const f=candidate().first_failure;if(f){$('time').value=f.end;updateTime();drone.visible=false;courseGroup.visible=ground.visible=true;const r=data.body_radius??.16;fit([f.position_lower.map(v=>v-r),f.position_upper.map(v=>v+r)]);}});
$('play').addEventListener('click',()=>{playing=!playing;if(playing&&Number($('time').value)>=data.horizon)$('time').value=0;$('play').textContent=playing?'Ⅱ Pause':'▶ Evolve sets';});
new ResizeObserver(()=>{const w=$('scene').clientWidth,h=$('scene').clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(data)updateTime();}).observe($('scene'));
let last=performance.now();function animate(now){requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.1);last=now;if(playing&&data){elapsed+=dt;if(elapsed>.025){$('time').value=Math.min(data.horizon,Number($('time').value)+elapsed*.4);elapsed=0;updateTime();if(Number($('time').value)>=data.horizon){playing=false;$('play').textContent='▶ Evolve sets';}}}orbit.update();renderer.render(scene,camera);}requestAnimationFrame(animate);
try{const response=await fetch(root+'index.json');if(!response.ok)throw new Error('Run tools/benchmark_authors_racing.py to generate the local benchmark data.');const cases=await response.json();$('case').replaceChildren(...cases.map(c=>new Option(c.title,c.file)));const requested=new URLSearchParams(location.search).get('case')||'oval-learned';const chosen=cases.find(c=>c.id===requested)||cases[0];$('case').value=chosen.file;$('case').addEventListener('change',()=>load($('case').value));await load(chosen.file);$('case').disabled=false;}catch(e){$('error').textContent=e.message;$('error').hidden=false;}
