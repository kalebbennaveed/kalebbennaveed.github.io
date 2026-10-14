const $=id=>document.getElementById(id);
let recording, replayTime=0, live=null, lastKey='', timer=null;
const color=(value,max)=>{
  if(value==null)return '#414650';
  const f=Math.min(1,Math.max(0,value/max)), a=f<.5?[78,155,225]:[229,186,94],b=f<.5?[229,186,94]:[231,87,88], t=f<.5?f*2:(f-.5)*2;
  return `rgb(${a.map((c,i)=>Math.round(c+(b[i]-c)*t)).join(',')})`;
};
function draw(canvas,frame){
  const r=canvas.getBoundingClientRect(), dpr=Math.min(devicePixelRatio,2);
  canvas.width=r.width*dpr;canvas.height=r.height*dpr;
  canvas._geometry=null;
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  const w=r.width,h=r.height,p={left:48,top:12,right:15,bottom:40};
  ctx.fillStyle='#161c26';ctx.fillRect(0,0,w,h);
  if(!frame){ctx.fillStyle='#b5bdca';ctx.font='13px system-ui';ctx.fillText('No model-knowledge snapshot available.',18,35);return;}
  const n=frame.axis.length, pw=w-p.left-p.right,ph=h-p.top-p.bottom;
  const values=$('knowledge-bound').value==='data'?frame.data_bound:frame.values;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    ctx.fillStyle=color(values[y*n+x],frame.threshold);
    ctx.fillRect(p.left+x*pw/n,p.top+(n-1-y)*ph/n,pw/n+.5,ph/n+.5);
  }
  const low=frame.axis[0],high=frame.axis.at(-1),span=high-low;
  ctx.save();ctx.beginPath();ctx.rect(p.left,p.top,pw,ph);ctx.clip();
  ctx.fillStyle='#ffffffb0';ctx.strokeStyle='#162a40';ctx.lineWidth=.6;
  for(const [x,y] of frame.nearby_samples){ctx.beginPath();ctx.arc(p.left+(x-low)/span*pw,p.top+(high-y)/span*ph,2.1,0,2*Math.PI);ctx.fill();ctx.stroke();}
  ctx.restore();ctx.font='11px system-ui';ctx.fillStyle='#b5bdca';ctx.textAlign='center';
  for(const v of [-10,-5,0,5,10]){const x=p.left+(v-low)/span*pw,y=p.top+(high-v)/span*ph;ctx.fillText(v,x,h-23);ctx.textAlign='right';ctx.fillText(v,p.left-8,y+4);ctx.textAlign='center';}
  ctx.fillText('World velocity x · m/s',p.left+pw/2,h-5);
  ctx.save();ctx.translate(13,p.top+ph/2);ctx.rotate(-Math.PI/2);ctx.fillText('World velocity y · m/s',0,0);ctx.restore();
  canvas._geometry={p,pw,ph,w,h,frame,values};
}
function render(force=false){
  const isLive=$('knowledge-source').value==='live';
  const frames=recording?.knowledge||[];
  let frame=isLive?live?.frame:frames.filter(f=>f.time<=replayTime+1e-6).at(-1);
  const baseline=frames[0];
  const key=JSON.stringify([isLive,frame?.model_version,frame?.time,$('knowledge-bound').value,live?.updated_unix,recording?.seed,recording?.controller]);
  if(!force&&key===lastKey)return;lastKey=key;
  $('knowledge-hover').textContent='Move over a map to inspect a state.';
  draw($('knowledge-map'),frame);
  draw($('knowledge-baseline'),isLive?null:baseline);
  $('knowledge-baseline-panel').hidden=isLive;
  $('knowledge-current-title').textContent=frame?`Model ${frame.model_version} · ${frame.time.toFixed(1)} s`:'Waiting for model data';
  $('knowledge-baseline-title').textContent=baseline?`At start · model ${baseline.model_version}`:'At start';
  $('knowledge-scale-max').textContent=`${frame?.threshold??4.5}+ m/s²`;
  $('knowledge-status').textContent=isLive?(live?`LOCAL RUN · ${(live.status==='initial_commitment_rejected: terminal_recovery'?'initial trajectory rejected · terminal error set too large':live.status.replaceAll('_',' '))} · updated ${new Date(live.updated_unix*1000).toLocaleTimeString()}`:'No local run connected. Start the simulation with --live-output web_demo/data/live-knowledge.json.'):'RECORDED MODEL UPDATES · follows the playback time';
  $('knowledge-count').textContent=frame?`${frame.observations} measurements · ${frame.nearby_samples.length} near this slice`:'No measurements available';
  $('knowledge-policy').textContent=isLive&&live?.policy?.available_version!=null?`Neural controller: version ${live.policy.available_version} available; ${live.policy.active_version??'none'} active.`:isLive?'Geometric tracking controller · local run.':recording?.controller==='neural'?(recording.samples.length<2?'Neural controller trained; backup-only initialization failed. Racing episode: zero steps; preliminary data collection is separate.':'Neural tracking policy · adapted using the learned prediction model.'):'This recording uses the geometric tracking controller.';
  if(frame){
    const x=frame.anchor_state,u=frame.anchor_control,fmt=a=>a.map(v=>Number(v).toFixed(2)).join(', ');
    $('knowledge-anchor').textContent=`Held fixed throughout this comparison: position [${fmt(x.slice(0,3))}] m; vertical velocity ${x[5].toFixed(2)} m/s; quaternion [${fmt(x.slice(6,10))}]; actual thrust ${x[10].toFixed(2)} m/s²; actual body rates [${fmt(x.slice(11,14))}] rad/s; commanded thrust ${u[0].toFixed(2)} m/s² and body rates [${fmt(u.slice(1))}] rad/s. White dots are measured samples whose other normalized features lie within ${frame.nearby_tolerance} of these values.`;
  }
}
async function poll(){
  try{
    const response=await fetch('./data/live-knowledge.json',{cache:'no-store'});
    if(!response.ok)throw Error('No local run');
    live=await response.json();render();
  }catch{live=null;render(true);}
}
export function updateKnowledge(data,time){const changed=recording!==data;recording=data;replayTime=time;render(changed);}
$('knowledge-source').onchange=()=>{clearInterval(timer);live=null;render(true);if($('knowledge-source').value==='live'){poll();timer=setInterval(poll,1500);}};
$('knowledge-bound').onchange=()=>render(true);
window.addEventListener('resize',()=>render(true));
for(const id of ['knowledge-map','knowledge-baseline']){
  $(id).onmousemove=event=>{
    const g=$(id)._geometry;if(!g)return;
    const r=$(id).getBoundingClientRect(), n=g.frame.axis.length;
    const ix=Math.floor((event.clientX-r.left-g.p.left)/g.pw*n),iy=n-1-Math.floor((event.clientY-r.top-g.p.top)/g.ph*n);
    if(ix<0||iy<0||ix>=n||iy>=n)return;
    const value=g.values[iy*n+ix];
    $('knowledge-hover').textContent=`vₓ ${g.frame.axis[ix].toFixed(1)} m/s, vᵧ ${g.frame.axis[iy].toFixed(1)} m/s → ${value==null?'no finite bound':value.toFixed(3)+' m/s² error bound'}`;
  };
}
