const $=id=>document.getElementById(id);
let recording, replayTime=0, live=null, lastKey='', timer=null;
const color=(value,max)=>{
  if(value==null)return '#414650';
  const f=Math.min(1,Math.max(0,value/max)),a=f<.5?[78,155,225]:[229,186,94],b=f<.5?[229,186,94]:[231,87,88],t=f<.5?f*2:(f-.5)*2;
  return `rgb(${a.map((c,i)=>Math.round(c+(b[i]-c)*t)).join(',')})`;
};
const tick=value=>Number(value.toFixed(1)).toString();
function selectedSlice(frame){
  if(!frame)return null;
  if(frame.slices)return frame.slices.find(s=>s.id===$('knowledge-view').value);
  // Older local streams can still display their recorded velocity view.
  return {...frame,id:'velocity_xy',label:'Velocity · x and y',keys:['vx','vy'],x_axis:frame.axis,y_axis:frame.axis,
    axes:[{label:'Velocity x',units:'m/s'},{label:'Velocity y',units:'m/s'}]};
}
function draw(canvas,frame){
  const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,2);
  canvas.width=Math.max(1,rect.width*dpr);canvas.height=Math.max(1,rect.height*dpr);canvas._geometry=null;
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  const w=rect.width,h=rect.height,p={left:64,top:15,right:18,bottom:48},slice=selectedSlice(frame);
  ctx.fillStyle='#161c26';ctx.fillRect(0,0,w,h);
  if(!slice){ctx.fillStyle='#b5bdca';ctx.font='13px system-ui';ctx.fillText('No recorded model data for this view.',18,35);return;}
  const nx=slice.x_axis.length,ny=slice.y_axis.length,pw=w-p.left-p.right,ph=h-p.top-p.bottom;
  const values=$('knowledge-bound').value==='data'?slice.data_bound:slice.values;
  const xmin=slice.x_axis[0],xmax=slice.x_axis.at(-1),ymin=slice.y_axis[0],ymax=slice.y_axis.at(-1);
  const X=x=>p.left+(x-xmin)/(xmax-xmin)*pw,Y=y=>p.top+(ymax-y)/(ymax-ymin)*ph;
  ctx.save();ctx.beginPath();ctx.rect(p.left,p.top,pw,ph);ctx.clip();
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    ctx.fillStyle=color(values[y*nx+x],frame.threshold);
    ctx.fillRect(X(slice.x_axis[x])-pw/(nx-1)/2,Y(slice.y_axis[y])-ph/(ny-1)/2,pw/(nx-1)+.5,ph/(ny-1)+.5);
  }
  ctx.fillStyle='#ffffffc0';ctx.strokeStyle='#162a40';ctx.lineWidth=.6;
  for(const [x,y] of slice.nearby_samples){ctx.beginPath();ctx.arc(X(x),Y(y),2.3,0,2*Math.PI);ctx.fill();ctx.stroke();}
  if(frame.observations===0&&values.every(v=>v==null)){
    ctx.fillStyle='#e2e8f2';ctx.font='14px system-ui';ctx.textAlign='center';
    ctx.fillText('No measurements collected yet',p.left+pw/2,p.top+ph/2);
  }
  ctx.restore();ctx.font='11px system-ui';ctx.fillStyle='#b5bdca';
  for(let i=0;i<=4;i++){
    const vx=xmin+(xmax-xmin)*i/4,vy=ymin+(ymax-ymin)*i/4;
    ctx.textAlign='center';ctx.fillText(tick(vx),X(vx),h-29);
    ctx.textAlign='right';ctx.fillText(tick(vy),p.left-9,Y(vy)+4);
  }
  ctx.textAlign='center';ctx.fillText(`${slice.axes[0].label} · ${slice.axes[0].units}`,p.left+pw/2,h-8);
  ctx.save();ctx.translate(16,p.top+ph/2);ctx.rotate(-Math.PI/2);ctx.fillText(`${slice.axes[1].label} · ${slice.axes[1].units}`,0,0);ctx.restore();
  canvas.setAttribute('aria-label',`Acceleration-error bound across ${slice.axes[0].label} and ${slice.axes[1].label}, at ${frame.time.toFixed(1)} seconds`);
  canvas._geometry={p,pw,ph,nx,ny,slice,values};
}
function render(force=false){
  const isLive=$('knowledge-source').value==='live',frames=recording?.knowledge||[];
  const frame=isLive?live?.frame:frames.filter(f=>f.time<=replayTime+1e-6).at(-1),baseline=frames[0];
  const views=(frame||baseline)?.slices||[{id:'velocity_xy',label:'Velocity · x and y'}];
  const signature=views.map(v=>v.id).join(',');
  if($('knowledge-view').dataset.views!==signature){
    const previous=$('knowledge-view').value;
    $('knowledge-view').replaceChildren(...views.map(v=>{const o=document.createElement('option');o.value=v.id;o.textContent=v.label;return o;}));
    if(views.some(v=>v.id===previous))$('knowledge-view').value=previous;
    $('knowledge-view').dataset.views=signature;
  }
  $('knowledge-time').disabled=isLive||!recording;
  $('knowledge-view').disabled=!frame&&!baseline;
  $('knowledge-time').max=recording?.samples?.at(-1)?.time||0;
  $('knowledge-time').value=replayTime;
  $('knowledge-time-label').textContent=`${replayTime.toFixed(1)} s`;
  const epoch=recording?.epochs?.filter(e=>e.time<=replayTime+1e-6).at(-1);
  const available=epoch?.policy_version,active=recording?.mode==='unfiltered'?available:epoch?.commitment?.policy_version;
  const key=JSON.stringify([isLive,frame?.model_version,frame?.time,$('knowledge-bound').value,$('knowledge-view').value,live?.updated_unix,recording?.plant_mode,recording?.mode,available,active]);
  if(!force&&key===lastKey)return;lastKey=key;
  const slice=selectedSlice(frame),isData=$('knowledge-bound').value==='data';
  $('knowledge-hover').textContent='Move over either map to read its error bound.';
  $('knowledge-baseline-panel').hidden=isLive;
  draw($('knowledge-map'),frame);if(!isLive)draw($('knowledge-baseline'),baseline);
  $('knowledge-current-title').textContent=frame?(frame.observations===0?'Before learning · no measurements yet':`Latest learned model · updated at ${frame.time.toFixed(1)} s`):'Waiting for model data';
  $('knowledge-baseline-title').textContent='At the start of the flight';
  $('knowledge-scale-max').textContent=`${frame?.threshold??4.5}+ m/s²`;
  $('knowledge-status').textContent=isLive?(live?`Connected to local simulation · refreshed ${new Date(live.updated_unix*1000).toLocaleTimeString()}`:'No local simulation is connected. Choose the recorded scenario to explore the published data.'):'Maps follow the flight time above. Only measurements already collected at that time are used.';
  if(frame?.observations===0&&isData)$('knowledge-status').textContent+=' At startup this source has no finite bound. Select “Measurements + assumed force limits” to see the bound available before learning.';
  $('knowledge-count').textContent=frame?`${frame.observations} measurements collected · ${slice?.nearby_samples.length??0} near this view`:'No measurements available';
  $('knowledge-view-note').textContent=slice?`Varying ${slice.axes[0].label.toLowerCase()} and ${slice.axes[1].label.toLowerCase()}. White dots show measurements close to the fixed values of every other input; they are not all measurements projected onto this plane.`:'';
  $('knowledge-policy').textContent='';
  if(!isLive&&recording?.controller==='neural'&&active!=null){
    $('knowledge-policy').textContent=active===recording.epochs[0]?.policy_version?'The drone is using the initially trained neural controller.':'The drone is using a neural controller updated with learned dynamics.';
    if(available!==active&&available!=null)$('knowledge-policy').textContent+=' A newer trained controller is available, but Gatekeeper has not accepted a trajectory that uses it.';
  }
  if(frame&&slice){
    $('knowledge-anchor-note').textContent='These inputs stay fixed at the same starting values in both maps. Orientation uses roll, pitch and heading to keep every queried rotation physically valid.';
    const fixed=(frame.fixed_coordinates||[]).filter(v=>!slice.keys.includes(v.key));
    $('knowledge-anchor').replaceChildren(...fixed.flatMap(v=>{
      const term=document.createElement('dt'),value=document.createElement('dd');
      term.textContent=v.label;value.textContent=`${v.value.toFixed(2)} ${v.units}`;return [term,value];
    }));
  }
}
async function poll(){
  try{const response=await fetch('./data/live-knowledge.json',{cache:'no-store'});if(!response.ok)throw Error('No local run');live=await response.json();render();}
  catch{live=null;render(true);}
}
export function updateKnowledge(data,time){const changed=recording!==data;recording=data;replayTime=time;render(changed);}
$('knowledge-source').onchange=()=>{clearInterval(timer);live=null;render(true);if($('knowledge-source').value==='live'){poll();timer=setInterval(poll,1500);}};
for(const id of ['knowledge-bound','knowledge-view'])$(id).onchange=()=>render(true);
$('knowledge-time').oninput=event=>window.dispatchEvent(new CustomEvent('knowledge-seek',{detail:Number(event.target.value)}));
if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname))$('knowledge-source').parentElement.hidden=true;
window.addEventListener('resize',()=>render(true));
for(const id of ['knowledge-map','knowledge-baseline'])$(id).onmousemove=event=>{
  const g=$(id)._geometry;if(!g)return;
  const r=$(id).getBoundingClientRect(),x=(event.clientX-r.left-g.p.left)/g.pw,y=(event.clientY-r.top-g.p.top)/g.ph;
  if(x<0||x>1||y<0||y>1)return;
  const ix=Math.round(x*(g.nx-1)),iy=Math.round((1-y)*(g.ny-1)),value=g.values[iy*g.nx+ix];
  $('knowledge-hover').textContent=`${g.slice.axes[0].label} ${g.slice.x_axis[ix].toFixed(1)} ${g.slice.axes[0].units}, ${g.slice.axes[1].label} ${g.slice.y_axis[iy].toFixed(1)} ${g.slice.axes[1].units} → ${value==null?'no finite bound':value.toFixed(3)+' m/s² acceleration-error bound'}`;
};
