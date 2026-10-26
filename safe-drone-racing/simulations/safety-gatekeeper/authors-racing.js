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
let data=null,index=0,playing=false,elapsed=0,request=0,view='tube',cases=[],course='oval';
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
function fit(points){
  const valid=points.filter(finite);if(!valid.length)return;
  const bounds=new THREE.Box3().setFromPoints(valid.map(p=>new THREE.Vector3(...p)));
  const target=bounds.getCenter(new THREE.Vector3());
  const radius=Math.max(bounds.getSize(new THREE.Vector3()).length()/2,.015);
  const vertical=THREE.MathUtils.degToRad(camera.fov/2),horizontal=Math.atan(Math.tan(vertical)*camera.aspect);
  const distance=1.18*radius/Math.sin(Math.min(vertical,horizontal));
  orbit.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(1,-1.6,1.1).normalize().multiplyScalar(distance));
  camera.near=Math.max(.00001,distance/10000);camera.far=Math.max(100,distance*100);
  camera.updateProjectionMatrix();orbit.update();
}
function candidate(){return data.candidates[index];}
function context(mode){
  view=mode;courseGroup.visible=ground.visible=mode!=='set';drone.visible=mode!=='set'&&$('show-drone').checked;
  courseGroup.traverse(object=>{
    if(object.isSprite){object.visible=mode==='course';return;}
    for(const material of (Array.isArray(object.material)?object.material:[object.material])){
      if(!material)continue;
      material.transparent=mode!=='course';material.opacity=mode==='course'?1:.12;
      material.depthWrite=mode==='course';
    }
  });
  ['course','tube','set'].forEach(name=>$(name+'-view').setAttribute('aria-pressed',String(mode===name)));
}
function showCourse(){context('course');fit(data.track.gates.flatMap(g=>[g.center.map((v,i)=>v-(i===2?g.height:g.width)/2),g.center.map((v,i)=>v+(i===2?g.height:g.width)/2)]));}
function showTube(){context('tube');const c=candidate();fit([...c.slab_lower,...c.slab_upper,...c.lower,...c.upper,...c.points]);}
function showSet(){context('set');const c=candidate(),k=Math.round(Number($('time').value)/data.dt);fit([c.lower[k],c.upper[k]]);}
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
  const endWidth=c.upper.at(-1).map((v,i)=>(v-c.lower.at(-1)[i])*1000);
  const pathLength=c.points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(...p.map((v,j)=>v-c.points[i][j])),0);
  $('width-summary').textContent=`At ${data.horizon.toFixed(1)} s: x ${endWidth[0].toFixed(2)}, y ${endWidth[1].toFixed(2)}, z ${endWidth[2].toFixed(2)} mm. The predicted path covers ${pathLength.toFixed(2)} m. Tube length in seconds and uncertainty width in millimetres are different quantities.`;
  $('case-note').textContent=`Initial speed ${data.initial_speed.toFixed(1)} m/s · gate width ${data.case.width.toFixed(2)} m · ${data.case.scale===0?'no residual':`${data.case.kind} velocity residual, ${data.case.scale}× strength`}.`;
  if(data.geometry_recheck_of)$('case-note').textContent=data.geometry_recheck_description;
  $('bound-data').textContent=`These controlled tests use an exact starting state and ${data.residual.samples_per_component} noiseless residual measurements per velocity component, collected before the candidate. The training velocities span ${data.residual.sample_range[0]} to ${data.residual.sample_range[1]} m/s. This is why these tests can have small model-error bounds; they do not represent the start of an untrained flight.`;
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
  crossSection(c,k);widthChart(c,k);
  if(view==='set')showSet();
}
function widthChart(c,k){
  const canvas=$('width-chart'),ratio=Math.min(devicePixelRatio,2),w=canvas.clientWidth,h=200;
  canvas.width=w*ratio;canvas.height=h*ratio;const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);
  const widths=c.upper.map((p,i)=>p.map((v,j)=>(v-c.lower[i][j])*1000));
  const max=Math.max(.001,...widths.flat().filter(Number.isFinite))*1.12;
  const left=48,right=w-14,top=24,bottom=170;
  const x=i=>left+(right-left)*i/(widths.length-1),y=v=>bottom-(bottom-top)*v/max;
  ctx.font='11px system-ui';ctx.textAlign='right';ctx.fillStyle='#b5c0d2';ctx.strokeStyle='#303949';
  for(let i=0;i<=4;i++){const v=max*i/4;ctx.beginPath();ctx.moveTo(left,y(v));ctx.lineTo(right,y(v));ctx.stroke();ctx.fillText(v.toFixed(max<1?3:1),left-7,y(v)+4);}
  ctx.fillText('mm',left-7,13);ctx.textAlign='center';
  for(let i=0;i<=5;i++)ctx.fillText(`${(data.horizon*i/5).toFixed(1)} s`,left+(right-left)*i/5,192);
  ['#64d8df','#b69ae7','#efb75f'].forEach((color,j)=>{ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();let drawing=false;widths.forEach((row,i)=>{if(!Number.isFinite(row[j])){drawing=false;return;}if(drawing)ctx.lineTo(x(i),y(row[j]));else ctx.moveTo(x(i),y(row[j]));drawing=true;});ctx.stroke();});
  if(c.first_failure){const px=left+(right-left)*c.first_failure.end/data.horizon;ctx.strokeStyle='#ff6372';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(px,top);ctx.lineTo(px,bottom);ctx.stroke();ctx.setLineDash([]);}
  ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x(k),top);ctx.lineTo(x(k),bottom);ctx.stroke();
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
    const url=new URL(location.href);url.searchParams.set('case',data.case.id);url.searchParams.delete('scenario');url.searchParams.set('environment',data.case.course==='stacked'?'environment-2':'oval');history.replaceState(null,'',url);
  }catch(e){if(current!==request)return;$('error').textContent=e.message;$('error').hidden=false;}
}
$('switch').addEventListener('change',()=>{index=Number($('switch').value);redraw();if(view==='tube')showTube();});
$('time').addEventListener('input',updateTime);
$('show-drone').addEventListener('change',()=>{drone.visible=view!=='set'&&$('show-drone').checked;});
$('width-chart').addEventListener('click',event=>{const rect=$('width-chart').getBoundingClientRect();$('time').value=Math.max(0,Math.min(data.horizon,(event.clientX-rect.left-48)/(rect.width-62)*data.horizon));playing=false;$('play').textContent='▶ Evolve sets';updateTime();});
$('slabs').addEventListener('change',redraw);$('samples').addEventListener('change',()=>{sampleGroup.visible=$('samples').checked;});
$('course-view').addEventListener('click',showCourse);$('tube-view').addEventListener('click',showTube);$('set-view').addEventListener('click',showSet);
$('show-startup').addEventListener('click',()=>{index=data.startup.index;$('switch').value=index;redraw();});
$('failure').addEventListener('click',()=>{const f=candidate().first_failure;if(f){$('time').value=f.end;updateTime();context('failure');drone.visible=false;const r=data.body_radius??.16;fit([f.position_lower.map(v=>v-r),f.position_upper.map(v=>v+r)]);}});
$('play').addEventListener('click',()=>{playing=!playing;if(playing&&Number($('time').value)>=data.horizon)$('time').value=0;$('play').textContent=playing?'Ⅱ Pause':'▶ Evolve sets';});
new ResizeObserver(()=>{const w=$('scene').clientWidth,h=$('scene').clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(data)updateTime();}).observe($('scene'));
let last=performance.now();function animate(now){requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.1);last=now;if(playing&&data){elapsed+=dt;if(elapsed>.025){$('time').value=Math.min(data.horizon,Number($('time').value)+elapsed*.4);elapsed=0;updateTime();if(Number($('time').value)>=data.horizon){playing=false;$('play').textContent='▶ Evolve sets';}}}orbit.update();renderer.render(scene,camera);}requestAnimationFrame(animate);
const caseCourse=c=>c.id.startsWith('oval-')?'oval':'stacked';
async function chooseCourse(next,preferred){
  course=next;const available=cases.filter(c=>caseCourse(c)===course),chosen=available.find(c=>c.id===preferred)||available.find(c=>c.id===(course==='oval'?'oval-learned':'stacked-linear'))||available[0];
  $('case').replaceChildren(...available.map((c,i)=>new Option(`Scenario ${i+1} · ${c.title.split(' · ').at(-1)}`,c.file)));
  $('case').value=chosen.file;
  document.querySelectorAll('[data-course]').forEach(button=>{button.setAttribute('aria-selected',String(button.dataset.course===course));button.tabIndex=button.dataset.course===course?0:-1;});
  $('course-note').textContent=course==='oval'?'An oval course for controlled candidate tests. The chicane flight environment is in the main replay.':'Seven stacked and crossing gates. Each scenario below uses this layout; narrow-opening tests change the gate width explicitly.';
  $('replays').href=`index.html?scenario=4&environment=${course==='oval'?'environment-1':'environment-2'}`;
  await load(chosen.file);
}
$('case').addEventListener('change',()=>load($('case').value));
document.querySelectorAll('[data-course]').forEach(button=>button.addEventListener('click',()=>chooseCourse(button.dataset.course)));
$('courses').addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?'oval':event.key==='End'?'stacked':course==='oval'?'stacked':'oval';$(next+'-tab').focus();chooseCourse(next);}});
try{const response=await fetch(root+'index.json');if(!response.ok)throw new Error('Candidate recordings unavailable.');cases=await response.json();const params=new URLSearchParams(location.search),requested=cases.find(c=>c.id===params.get('case'));await chooseCourse(requested?caseCourse(requested):params.get('environment')==='environment-2'?'stacked':'oval',requested?.id);$('case').disabled=false;}catch(e){$('error').textContent=e.message;$('error').hidden=false;}
