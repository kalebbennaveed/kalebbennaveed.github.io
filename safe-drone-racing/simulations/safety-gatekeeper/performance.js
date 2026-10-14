import { scenarioFor } from './scenarios.js?v=1';
const $=id=>document.getElementById(id),fmt=(x,unit='',digits=2)=>x==null?'Not completed':`${x.toFixed(digits)}${unit}`;
let comparison;
function chart(){
  if(!comparison)return;
  const canvas=$('comparison-chart'),r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,2);
  canvas.width=r.width*dpr;canvas.height=r.height*dpr;
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  const w=r.width,h=r.height,l=45,t=35,pw=w-l-15,ph=h-t-30;
  const end=Math.max(...comparison.runs.map(run=>run.metrics.duration));
  const max=Math.ceil(Math.max(...comparison.runs.map(run=>run.metrics.max_speed))/2)*2;
  ctx.font='12px system-ui';ctx.fillStyle='#b9c9dc';ctx.fillText('Flight speed · m/s',l,17);
  for(let v=0;v<=max;v+=2){const y=t+ph-v/max*ph;ctx.strokeStyle='#344051';ctx.beginPath();ctx.moveTo(l,y);ctx.lineTo(w-15,y);ctx.stroke();ctx.fillText(v,12,y+4);}
  for(let v=0;v<=end;v+=5)ctx.fillText(`${v} s`,l+v/end*pw-5,h-7);
  for(const run of comparison.runs){ctx.beginPath();run.speed.forEach(([time,speed],i)=>{const x=l+time/end*pw,y=t+ph-speed/max*ph;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.strokeStyle=run.gatekeeper_enabled?'#b9a2f1':run.plant_mode==='base'?'#71d9d1':'#f09b78';ctx.lineWidth=1.6;ctx.stroke();}
}
try{
  const response=await fetch('./data/comparison.json?v=3',{cache:'no-cache'});if(!response.ok)throw Error('Comparison unavailable');
  comparison=await response.json();
  $('performance-cards').replaceChildren(...comparison.runs.map(run=>{
    const card=document.createElement('article');card.className=`performance-card ${run.gatekeeper_enabled?'gatekeeper':run.plant_mode}`;
    const title=document.createElement('h3');const scenario=scenarioFor(run);title.textContent=`Scenario ${scenario.number}`;card.append(title);const caption=document.createElement('p');caption.className='scenario-caption';caption.textContent=scenario.title;card.append(caption);
    const list=document.createElement('dl');
    for(const [label,value] of [['Gates passed',`${run.metrics.gates_passed} · ${run.metrics.completed_laps} ${run.metrics.completed_laps===1?'lap':'laps'}`],['First lap',fmt(run.metrics.first_lap_seconds,' s')],['Mean speed',fmt(run.metrics.mean_speed,' m/s')],['Missed gates / collisions',`${run.metrics.missed_gates} / ${run.metrics.crashed?1:0}`],['Distance from course centerline · RMS',fmt(run.metrics.contour_rmse_m,' m',3)],['Minimum clearance',fmt(run.metrics.min_clearance,' m',3)],['Run outcome',`${run.status==='duration_reached'?'Completed recording':run.metrics.crashed?'Collision recorded':'Recording ended'} · ${fmt(run.metrics.duration,' s',1)}`]]){
      const term=document.createElement('dt'),detail=document.createElement('dd');term.textContent=label;detail.textContent=value;list.append(term,detail);
    }
    card.append(list);const note=document.createElement('p');note.textContent=`${run.policy_versions.length===1?'The initially trained neural controller remained active.':`${run.policy_versions.length-1} controller updates were applied during flight.`} ${run.model_versions.length-1} dynamics-model updates were learned.`;card.append(note);
    if(run.gatekeeper_enabled){const coverage=document.createElement('p');coverage.textContent=`Recorded state bounds cover ${(run.metrics.tube_covered_steps*run.dt).toFixed(1)} s. The backup continues beyond the checked horizons for ${(run.metrics.continuation_steps*run.dt).toFixed(1)} s. These checks use a local linear approximation and do not prove safety.`;card.append(coverage);}
    return card;
  }));
  $('performance-protocol').textContent=comparison.protocol;
  chart();window.addEventListener('resize',chart);
}catch{ $('performance-cards').textContent='The comparison is not available in this export.'; }
