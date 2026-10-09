import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';
const {runs,track,scenario={}}=window.RACING_DATA;
const names={proposed:'Proposed',passive:'Passive',robust:'No learning'};
for(const [key,run] of Object.entries(runs))if(run.summary.method==='weighted')names[key]=`Weighted · λ = ${run.config.information_weight}`;
const colors={proposed:'#16936b',passive:'#518ad0',weighted:'#ca9640',weighted_tuned:'#7654b2',weighted_fast:'#cb6254',robust:'#ad768a'};
const isWeighted=key=>runs[key]?.summary.method==='weighted';
const $=id=>document.getElementById(id),keys=Object.keys(runs);
if(scenario.traction){
 $('circuit-name').textContent='AUTONOMOUS RACING / '+scenario.title.toUpperCase();
 $('scenario-description').textContent=scenario.description;
 $('experiment').hidden=false;
 $('experiment').innerHTML=`<span>Racing target <strong>${scenario.racing_speed} m/s · ${Math.round(scenario.racing_speed*3.6)} km/h</strong></span><span>Backup <strong>8 m/s</strong></span><span>Track <strong>${(track.length/1000).toFixed(2)} km</strong></span><span>Information weights <strong>λ = ${keys.filter(isWeighted).map(k=>runs[k].config.information_weight).join(', ')}</strong></span><span>Candidate risk <strong>ε = ${(100*scenario.epsilon).toFixed(0)}%</strong></span>`;
}
let selected=keys[0],time=0,playing=false,previous=0,lastPlot=-1,lastEvent=-1;
const end=Math.max(...keys.map(k=>runs[k].summary.time));$('time').max=end;
const scene=new THREE.Scene();scene.background=new THREE.Color('#c7d5c7');scene.fog=new THREE.Fog('#c7d5c7',180,650);
const camera=new THREE.PerspectiveCamera(48,1,.1,6000);camera.up.set(0,0,1);
const renderer=new THREE.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
$('scene').appendChild(renderer.domElement);
const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.minDistance=4;orbit.maxDistance=2800;orbit.maxPolarAngle=Math.PI*.48;
scene.add(new THREE.HemisphereLight(0xf5f6eb,0x537052,2.4));const sun=new THREE.DirectionalLight(0xfff4db,2.5);sun.position.set(50,-20,90);scene.add(sun);
function mesh(g,color){return new THREE.Mesh(g,new THREE.MeshStandardMaterial({color,roughness:.85,metalness:0}));}
const ground=mesh(new THREE.PlaneGeometry(6000,6000),'#73996b');ground.position.z=-.05;scene.add(ground);
function strip(a,b,z,color){const pos=[],idx=[];track.xy.forEach(([x,y],i)=>{const h=track.heading[i];for(const w of[a,b])pos.push(x-Math.sin(h)*w,y+Math.cos(h)*w,z);if(i<track.xy.length-1){let n=2*i;idx.push(n,n+3,n+1,n,n+2,n+3);}});const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();scene.add(mesh(g,color));}
strip(-9.3,9.3,0,'#adb7a0');strip(-8,8,.025,'#383e43');strip(7.77,7.96,.04,'#e3e5db');strip(-7.96,-7.77,.04,'#e3e5db');
strip(8.12,8.55,.035,'#b0453b');strip(-8.55,-8.12,.035,'#b0453b');
const dashMat=new THREE.LineDashedMaterial({color:'#c7c8b2',dashSize:2,gapSize:6,transparent:true,opacity:.45});
const centerGeom=new THREE.BufferGeometry().setFromPoints(track.xy.map(([x,y])=>new THREE.Vector3(x,y,.055)));
const centerLine=new THREE.Line(centerGeom,dashMat);centerLine.computeLineDistances();scene.add(centerLine);
const cars={},trails={},plans={},backupPlans={};
function car(color){const g=new THREE.Group();g.add(mesh(new THREE.BoxGeometry(2.4,1.1,.28),color));g.children[0].position.z=.37;
 const cabin=mesh(new THREE.BoxGeometry(.85,.85,.25),'#283b43');cabin.position.set(-.1,0,.58);g.add(cabin);
 const wheels=[];for(const x of [-.92,.92])for(const y of [-.5,.5]){const w=new THREE.Group();w.position.set(x,y,.34);const tyre=mesh(new THREE.CylinderGeometry(.16,.16,.14,16),'#141a1b');w.add(tyre);g.add(w);wheels.push(w);}g.scale.setScalar(3.05/1.84);g.children.forEach(c=>c.position.x-=.075/(3.05/1.84));g.userData.wheels=wheels;return g;}
keys.forEach(k=>{cars[k]=car(colors[k]);scene.add(cars[k]);const pts=runs[k].frames.map(f=>new THREE.Vector3(f.pose[0],f.pose[1],.085));trails[k]=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:colors[k]}));scene.add(trails[k]);plans[k]=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:colors[k],dashSize:1,gapSize:.8}));scene.add(plans[k]);backupPlans[k]=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:0x63b7e4,dashSize:1,gapSize:.8}));scene.add(backupPlans[k]);});
new GLTFLoader().load('./racecar.glb',gltf=>{keys.forEach(k=>{const group=new THREE.Group(),visual=gltf.scene.clone(true);
 // The supplied Kenney asset uses Y up and faces +Z. Map forward to world +X.
 visual.rotation.set(Math.PI/2,Math.PI/2,0);group.add(visual);group.updateMatrixWorld(true);
 const b=new THREE.Box3().setFromObject(group),size=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3());
 const scale=3.98/size.x;visual.scale.setScalar(scale);group.scale.y=1.82/(size.y*scale);visual.position.set(-center.x*scale-.075,-center.y*scale,-b.min.z*scale+.04);
 visual.traverse(n=>{if(n.isMesh){n.material=n.material.clone();if(n.material.name==='red')n.material.color.set(colors[k]);}});
 const old=cars[k];group.position.copy(old.position);group.rotation.copy(old.rotation);group.userData.wheels=[];scene.remove(old);cars[k]=group;scene.add(group);
 });draw();},undefined,error=>console.error('Racecar asset could not load',error));
function active(){return selected==='comparison'?keys:[selected];}
function focusKey(){return selected==='comparison'?(runs.proposed?'proposed':keys[0]):selected;}
function frame(k,t){const fs=runs[k].frames,i=Math.min(fs.length-1,Math.floor(t/runs[k].dt+1e-7));return {f:fs[i],i};}
const lastTarget=new THREE.Vector3();let lastYaw=0;
function resetCamera(){const f=frame(focusKey(),time).f,p=new THREE.Vector3(f.pose[0],f.pose[1],.3),yaw=f.pose[2];orbit.target.copy(p);camera.position.copy(p).add(new THREE.Vector3(-18*Math.cos(yaw)+7*Math.sin(yaw),-18*Math.sin(yaw)-7*Math.cos(yaw),12));lastTarget.copy(p);lastYaw=yaw;orbit.update();}
function wholeTrack(){const box=new THREE.Box3().setFromPoints(track.xy.map(([x,y])=>new THREE.Vector3(x,y,0)));const c=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());const tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),distance=1.12*(Math.max((size.x+28)/(2*tangent*camera.aspect),(size.y+28)/(2*tangent))+.12*(size.y+28));orbit.target.copy(c);camera.position.copy(c).add(new THREE.Vector3(0,-.23,1).normalize().multiplyScalar(distance));scene.fog=null;orbit.update();}
function select(k){selected=k;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.key===k));lastEvent=-1;lastPlot=-1;if(k==='comparison'){$('camera').value='track';$('camera-note').textContent='Whole circuit';}if($('camera').value==='track')wholeTrack();else resetCamera();draw();}
[...keys,'comparison'].forEach(k=>{const b=document.createElement('button');b.dataset.key=k;b.innerHTML=k==='comparison'?'Comparison':`<span class="dot" style="background:${colors[k]}"></span>${names[k]}`;b.onclick=()=>select(k);$('tabs').append(b);});
$('legend').innerHTML=keys.map(k=>`<span><i class="dot" style="background:${colors[k]}"></i>${names[k]}</span>`).join('');
$('results').innerHTML='<table><thead><tr><th>Method</th><th>Lap time</th><th>Cost</th><th>Peak speed</th><th>Final μ width</th><th>Informative driving</th></tr></thead><tbody>'+keys.map(k=>{const s=runs[k].summary,peak=Math.max(...runs[k].frames.map(f=>f.state[3]));return `<tr><td><i class="dot" style="background:${colors[k]}"></i>${names[k]}</td><td>${s.time.toFixed(2)} s${s.lap_complete?' · lap':' · '+s.termination.replaceAll('_',' ')}</td><td>${s.cost.toFixed(3)}</td><td>${peak.toFixed(2)} m/s</td><td>${(s.final_mu[1]-s.final_mu[0]).toFixed(5)}</td><td>${s.informative_seconds===undefined?'—':s.informative_seconds.toFixed(2)+' s'}</td></tr>`;}).join('')+'</tbody></table>';
function plot(id,accessor,range,bounds=false){const canvas=$(id),rect=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1;canvas.width=rect.width*dpr;canvas.height=rect.height*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);const w=rect.width,h=rect.height,L=30,R=w-5,T=5,B=h-16;
 ctx.font='9px system-ui';ctx.fillStyle='#8b9690';ctx.strokeStyle='#edf1ed';ctx.lineWidth=1;
 const horizon=Math.min(end,Math.max(20,Math.ceil(time/20)*20)),xp=t=>L+(R-L)*Math.min(t,horizon)/horizon,yp=v=>B-(B-T)*(v-range[0])/(range[1]-range[0]);
 for(let j=0;j<3;j++){const v=range[0]+(range[1]-range[0])*j/2,y=yp(v);ctx.fillText(v.toFixed(range[1]<=2?2:0),0,y+3);ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(R,y);ctx.stroke();}
 ctx.fillText('0 s',L,B+13);ctx.fillText(horizon.toFixed(0)+' s',R-25,B+13);
 active().forEach(k=>{const fs=runs[k].frames.filter(f=>f.t<=time+.001);ctx.strokeStyle=colors[k];ctx.lineWidth=1.8;ctx.setLineDash(isWeighted(k)?[5,4]:k==='robust'?[2,4]:[]);
 if(bounds&&fs.length){ctx.beginPath();fs.forEach((f,i)=>{const y=yp(f.mu[0]);i?ctx.lineTo(xp(f.t),y):ctx.moveTo(xp(f.t),y)});[...fs].reverse().forEach(f=>ctx.lineTo(xp(f.t),yp(f.mu[1])));ctx.closePath();ctx.fillStyle=colors[k]+'25';ctx.fill();}
 for(const channel of bounds?[0,1]:[null]){ctx.beginPath();fs.forEach((f,i)=>{const y=yp(bounds?f.mu[channel]:accessor(f));i?ctx.lineTo(xp(f.t),y):ctx.moveTo(xp(f.t),y)});ctx.stroke();}});
 if(bounds){const truth=runs[focusKey()].summary.true_mu;ctx.strokeStyle='#202a26';ctx.lineWidth=1.5;ctx.setLineDash([7,3]);ctx.beginPath();ctx.moveTo(L,yp(truth));ctx.lineTo(R,yp(truth));ctx.stroke();const contained=active().every(k=>runs[k].frames.filter(f=>f.t<=time+.001).every(f=>f.mu[0]-1e-9<=runs[k].summary.true_mu&&runs[k].summary.true_mu<=f.mu[1]+1e-9));$('mu-truth').textContent=`Dashed: μ true = ${truth.toFixed(3)} · ${contained?'contained at every recorded step':'CONTAINMENT FAILURE'}`;}
 ctx.setLineDash([]);ctx.strokeStyle='#9faea5';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(xp(time),T);ctx.lineTo(xp(time),B);ctx.stroke();}
const box=new THREE.Box3().setFromPoints(track.xy.map(([x,y])=>new THREE.Vector3(x,y,0))),ext=box.getSize(new THREE.Vector3());
function minimap(){const c=$('map'),g=c.getContext('2d'),w=c.width,h=c.height,scale=Math.min((w-24)/ext.x,(h-20)/ext.y);const point=([x,y])=>[12+(x-box.min.x)*scale,h-10-(y-box.min.y)*scale];g.clearRect(0,0,w,h);g.strokeStyle='#b6c2b3';g.lineWidth=2;g.beginPath();track.xy.forEach((p,i)=>{const q=point(p);i?g.lineTo(...q):g.moveTo(...q)});g.stroke();active().forEach(k=>{const p=point(frame(k,time).f.pose);g.fillStyle=colors[k];g.beginPath();g.arc(...p,4,0,Math.PI*2);g.fill();});}
function draw(){const visible=active();keys.forEach(k=>{const {f,i}=frame(k,time);cars[k].visible=trails[k].visible=visible.includes(k);cars[k].position.set(f.pose[0],f.pose[1],0);cars[k].rotation.z=f.pose[2];cars[k].userData.wheels.forEach(w=>{if(w.position.x>0)w.rotation.z=f.state[6];w.children[0].rotation.y=-f.state[0]/.16;});trails[k].geometry.setDrawRange(0,i+1);plans[k].visible=backupPlans[k].visible=visible.includes(k)&&$('plan').checked;
 const event=runs[k].events.findLast(e=>e.time<=time&&e.plan);if(event){const pts=event.plan.map(p=>new THREE.Vector3(p[0],p[1],.13));if(plans[k].userData.event!==event.time){plans[k].geometry.dispose();const cut=Math.round(event.policy.duration/.15);plans[k].geometry=new THREE.BufferGeometry().setFromPoints(pts.slice(0,cut+1));backupPlans[k].geometry.dispose();backupPlans[k].geometry=new THREE.BufferGeometry().setFromPoints(pts.slice(cut));plans[k].computeLineDistances();backupPlans[k].computeLineDistances();plans[k].userData.event=event.time;}}});
 const f=frame(focusKey(),time).f;$('clock').textContent=time.toFixed(2)+' s';$('speed').textContent=f.state[3].toFixed(1);$('position').textContent=(f.state[0]-runs[focusKey()].frames[0].state[0]).toFixed(1)+' m travelled';$('mode').textContent=selected==='comparison'?'COMPARISON':(time>=runs[focusKey()].summary.time?(runs[focusKey()].summary.lap_complete?'LAP COMPLETE':'RECORDING END'):f.mode.toUpperCase());$('clearance').textContent=f.clearance.toFixed(2)+' m';$('mu-value').textContent=`[${f.mu[0].toFixed(3)}, ${f.mu[1].toFixed(3)}]`;$('time').value=time;
 if($('camera').value==='follow'){const p=new THREE.Vector3(f.pose[0],f.pose[1],.3),axis=new THREE.Vector3(0,0,1),yawDelta=f.pose[2]-lastYaw;camera.position.sub(lastTarget).applyAxisAngle(axis,yawDelta).add(p);orbit.target.sub(lastTarget).applyAxisAngle(axis,yawDelta).add(p);lastTarget.copy(p);lastYaw=f.pose[2];}
 if(scenario.traction){const event=runs[focusKey()].events.findLast(e=>e.time<=time&&(e.nominal_attempts||e.weighted_attempts)),attempts=event&&(event.nominal_attempts||event.weighted_attempts),blocked=attempts&&attempts.every(a=>!a.certificate.accepted);let status=time>=runs[focusKey()].summary.time?(runs[focusKey()].summary.lap_complete?'Lap complete':runs[focusKey()].summary.termination.replaceAll('_',' ')):f.mode==='informative'?(isWeighted(focusKey())?'Persistent weighted excitation · the information reward remains active':'Certified steering probe · learning from yaw acceleration'):f.mode==='backup'?(blocked?'Racing rejected · '+(f.state[3]>9.2?'braking toward the 8 m/s backup':'following the 8 m/s centerline backup'):'Following the committed centerline backup'):'Racing accepted · sampled risk bound meets the selected tolerance';if(isWeighted(focusKey())&&blocked&&time<runs[focusKey()].summary.time){const force=attempts.every(a=>a.certificate.reason==='violating_tire_force');status=`${attempts.length} weighted candidates rejected${force?' · insufficient certified tire grip':''} · continuing backup`;}$('decision').textContent=(selected==='comparison'?names[focusKey()]+': ':'')+status;
 const accepted=runs[focusKey()].events.findLast(e=>e.time<=time&&(e.selected?.certificate?.accepted||e.status==='backup_renewal'));
 const cert=accepted?.selected?.certificate||accepted?.certificate||runs[focusKey()].initial_certificate;
 $('certificate').textContent=`Current commitment: upper bound ${(100*cert.failure_upper).toFixed(3)}% ≤ ${(100*scenario.epsilon).toFixed(0)}% tolerance · ${cert.failures}/${cert.samples} sampled failures · 95% confidence per decision`;
 }
 if(Math.abs(time-lastPlot)>.1||!playing){plot('mu-plot',null,[.4,1.1],true);plot('speed-plot',f=>f.state[3],[0,Math.max(30,Math.ceil((scenario.racing_speed||24)/10)*10)]);plot('cost-plot',f=>f.cost,[0,Math.max(20,Math.ceil(Math.max(...keys.map(k=>frame(k,time).f.cost))/20)*20)]);minimap();lastPlot=time;}}
$('play').onclick=()=>{if(time>=end)time=0;playing=!playing;$('play').textContent=playing?'Pause':'Play';};$('reset').onclick=()=>{time=0;if($('camera').value==='track')wholeTrack();else resetCamera();draw();};$('time').oninput=e=>{time=Number(e.target.value);draw();};$('camera').onchange=()=>{$('camera-note').textContent={follow:'Follow camera · drag to orbit',orbit:'Free orbit · drag to explore',track:'Whole circuit'}[$('camera').value];if($('camera').value==='track')wholeTrack();else{scene.fog=new THREE.Fog('#c7d5c7',180,650);resetCamera();}};$('plan').onchange=draw;
new ResizeObserver(()=>{const el=$('scene');camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight);if($('camera').value==='track')wholeTrack();lastPlot=-1;draw();}).observe($('scene'));
const labels=document.createElement('div');labels.className='car-labels';$('scene').append(labels);
function annotateCars(){labels.replaceChildren();if(selected!=='comparison')return;
 const groups=[];for(const k of keys){const f=frame(k,time).f;let group=groups.find(g=>Math.hypot(g.f.pose[0]-f.pose[0],g.f.pose[1]-f.pose[1])<3);if(group)group.keys.push(k);else groups.push({f,keys:[k]});}
 for(const [index,g] of groups.entries()){const p=new THREE.Vector3(g.f.pose[0],g.f.pose[1],1).project(camera);if(p.z>1||p.z<-1||Math.abs(p.x)>1||Math.abs(p.y)>1)continue;const label=document.createElement('div');label.className='car-label'+(index%2?' lower':'');label.style.left=(p.x+1)*50+'%';label.style.top=(1-p.y)*50+'%';label.style.borderColor=colors[g.keys[0]];label.textContent=g.keys.map(k=>names[k]).join(' / ')+' · '+g.f.state[3].toFixed(1)+' m/s';labels.append(label);}}
function animate(now){requestAnimationFrame(animate);if(previous&&playing){time=Math.min(end,time+(now-previous)/1000*Number($('rate').value));if(time>=end){playing=false;$('play').textContent='Play';}draw();}previous=now;orbit.update();renderer.render(scene,camera);annotateCars();}
select(selected);requestAnimationFrame(animate);
