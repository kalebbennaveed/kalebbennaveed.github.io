import { scenarioFor } from './scenarios.js?v=4';
const $=id=>document.getElementById(id),fmt=(x,unit='',digits=2)=>x==null?'Not completed':`${x.toFixed(digits)}${unit}`;
let comparison,comparisonRequest=0;
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
  for(const run of comparison.runs){ctx.beginPath();run.speed.forEach(([time,speed],i)=>{const x=l+time/end*pw,y=t+ph-speed/max*ph;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.strokeStyle=run.gatekeeper_enabled?'#b9a2f1':run.plant_mode==='base'?'#71d9d1':'#f09b78';ctx.lineWidth=1.6;ctx.stroke();
    if(run.outcome?.kind==='gate_contact'){const [time,speed]=run.speed.at(-1),x=l+time/end*pw,y=t+ph-speed/max*ph;ctx.fillStyle='#ff6570';ctx.beginPath();ctx.arc(x,y,5,0,2*Math.PI);ctx.fill();ctx.fillText(`Collision · ${time.toFixed(2)} s`,Math.max(l,Math.min(x-60,w-145)),y-12);}
  }
}
async function loadComparison(environment){
 const request=++comparisonRequest;comparison=null;
 $('performance-environment').textContent=`${environment.label.toUpperCase()} · MATCHED SCENARIOS`;
 $('performance-cards').textContent='Loading this environment’s results…';$('force-search').hidden=true;
 $('comparison-chart').getContext('2d').clearRect(0,0,$('comparison-chart').width,$('comparison-chart').height);
 if(!environment.comparison){
  $('performance-intro').textContent='This environment currently has only the matched DiffReach recording.';
  $('performance-cards').replaceChildren();$('performance-protocol').textContent='';
  return;
 }
 try{
  const response=await fetch(`./data/${environment.directory}${environment.comparison}?v=6`,{cache:'no-cache'});if(!response.ok)throw Error('Comparison unavailable');
  const result=await response.json();if(request!==comparisonRequest)return;comparison=result;
  $('performance-intro').textContent=`Three scenarios in ${environment.label}, with the same starting state, pretrained neural controller and planner settings. Each runs for up to ${comparison.duration_limit||Math.max(...comparison.runs.map(r=>r.metrics.duration))} seconds and stops if it violates the course constraints.`;
  $('performance-cards').replaceChildren(...comparison.runs.map(run=>{
    const card=document.createElement('article');card.className=`performance-card ${run.gatekeeper_enabled?'gatekeeper':run.plant_mode}`;
    const title=document.createElement('h3');const scenario=scenarioFor(run);title.textContent=`Scenario ${scenario.number}`;card.append(title);const caption=document.createElement('p');caption.className='scenario-caption';caption.textContent=scenario.title;card.append(caption);
    const list=document.createElement('dl');
    for(const [label,value] of [['Gates passed',`${run.metrics.gates_passed} · ${run.metrics.completed_laps} ${run.metrics.completed_laps===1?'lap':'laps'}`],['First lap',fmt(run.metrics.first_lap_seconds,' s')],['Mean speed',fmt(run.metrics.mean_speed,' m/s')],['Missed gates / frame contacts',`${run.metrics.missed_gates} / ${run.outcome?.kind==='gate_contact'?1:0}`],['Distance from course centerline · RMS',fmt(run.metrics.contour_rmse_m,' m',3)],['Minimum clearance',fmt(run.metrics.min_clearance,' m',3)],['Run outcome',`${run.outcome?.label??(run.status==='duration_reached'?'Completed recording':'Recording ended')} · ${fmt(run.metrics.duration,' s',2)}`]]){
      const term=document.createElement('dt'),detail=document.createElement('dd');term.textContent=label;detail.textContent=value;list.append(term,detail);
    }
    if(run.gatekeeper_enabled){const term=document.createElement('dt'),detail=document.createElement('dd');term.textContent='Steps outside recorded bounds';detail.textContent=`${run.metrics.full_state_tube_violations} state/control · ${run.metrics.tube_violations} position`;list.append(term,detail);}
    card.append(list);const note=document.createElement('p');note.textContent=`${run.policy_versions.length===1?'The initially trained neural controller remained active.':`${run.policy_versions.length-1} controller ${run.policy_versions.length===2?'update was':'updates were'} applied during flight.`} ${run.model_versions.length-1} dynamics-model updates were learned.`;card.append(note);
    if(run.gatekeeper_enabled){const coverage=document.createElement('p');coverage.textContent=`Recorded state bounds cover ${(run.metrics.tube_covered_steps*run.dt).toFixed(1)} s. The backup continues beyond the checked horizons for ${(run.metrics.continuation_steps*run.dt).toFixed(1)} s. These checks use a local linear approximation and do not prove safety.`;card.append(coverage);
      if(run.metrics.continuation_terminal_violations){const limits=document.createElement('p');limits.textContent=`During that continuation, ${run.metrics.continuation_terminal_violations} recorded steps (${(run.metrics.continuation_terminal_violations*run.dt).toFixed(2)} s) exceeded at least one of the position, velocity or tilt limits used to check candidate endpoints.`;card.append(limits);}}
    return card;
  }));
  $('performance-protocol').textContent=comparison.protocol;
  if(comparison.search){
    $('force-search').hidden=false;$('force-search-description').textContent=comparison.search.description;
    $('force-search-trials').replaceChildren(...comparison.search.trials.map((trial,index)=>{
      const item=document.createElement('li'),p=trial.ground_truth_parameters;
      item.textContent=`Trial ${index+1} · ${trial.track}: progress weight ${trial.planner.progress}, centerline-error weight ${trial.planner.contour}, initial rollout ${trial.planner.initialization_speed} m/s; drag ${p.drag.toFixed(3)} m⁻¹${p.drag_axis?` along [${p.drag_axis.map(v=>v.toFixed(2)).join(', ')}]`:''}; acceleration bias [${p.bias.map(v=>v.toFixed(3)).join(', ')}] m/s². ${trial.outcome.label} at ${trial.outcome.time.toFixed(2)} s.${trial.selected?' Selected for Scenarios 1 and 3.':''}`;
      return item;
    }));
  }
  chart();
 }catch{if(request===comparisonRequest)$('performance-cards').textContent='The comparison is not available for this environment.';}
}
window.addEventListener('resize',chart);
window.addEventListener('environment-change',event=>loadComparison(event.detail));
