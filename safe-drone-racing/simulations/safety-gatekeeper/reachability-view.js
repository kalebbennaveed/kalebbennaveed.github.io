// Pure selection of saved sets for an independent candidate-time inspector.
// This does not simulate flight or interpolate an uncertainty enclosure.
export function reachabilityFrame({bounds,initialBox,failure,referenceStart,candidateDuration,elapsed,dt}){
  const swept=bounds?.swept||[];
  const validated=Math.max(0,Math.min(candidateDuration,(bounds?.validated_until??referenceStart)-referenceStart));
  const failureStart=failure?.interval_offsets?.[0]??null;
  const failureEnd=failure?.interval_offsets?.[1]??null;
  // Inspect the whole proposed reference even when only its prefix is bounded.
  // The suffix remains explicitly unenclosed; this adds no invented sets.
  const inspectionEnd=candidateDuration;
  const selected=Math.max(0,Math.min(inspectionEnd,elapsed));
  const absoluteTime=referenceStart+selected;
  const count=(bounds?.radii||[]).filter((_,i)=>bounds.start_time+i*dt<=absoluteTime+1e-9).length;
  const endpoints={...bounds,centers:bounds?.centers?.slice(0,count),radii:(bounds?.radii||[]).slice(0,count)};
  const completedSwept=swept.filter(box=>box.end_time<=absoluteTime+1e-9);
  const active=selected>1e-9?swept.find(box=>box.start_time<absoluteTime-1e-9&&box.end_time>absoluteTime+1e-9):null;
  let current=null;
  if(selected<=1e-9&&initialBox)current={...initialBox,kind:'initial',start:0,end:0};
  else if(active)current={...active,kind:'swept',start:active.start_time-referenceStart,end:active.end_time-referenceStart};
  else if(count&&Math.abs(bounds.start_time+(count-1)*dt-absoluteTime)<1e-8){
    current={center:bounds.centers[count-1],radius:bounds.radii[count-1],kind:'endpoint',start:selected,end:selected};
  }else if(completedSwept.length){
    const last=completedSwept.at(-1);
    current={...last,kind:'swept',start:last.start_time-referenceStart,end:last.end_time-referenceStart};
  }
  return {selected,inspectionEnd,validated,candidateDuration,
    uncheckedSeconds:Math.max(0,candidateDuration-validated),endpoints,
    swept:[...completedSwept,...(active?[active]:[])],current,
    failureVisible:failureStart!=null&&selected>=failureStart-1e-9,
    attemptedFailureVisible:failureStart!=null&&selected>=failureStart-1e-9&&failure?.region_validated===false};
}

export function splitReference(points,seconds,dt){
  if(!points?.length)return {checked:[],remaining:[]};
  const progress=Math.max(0,Math.min(points.length-1,seconds/dt));
  const index=Math.floor(progress),fraction=progress-index;
  const boundary=points[index].map((value,k)=>value+fraction*((points[index+1]?.[k]??value)-value));
  return {checked:[...points.slice(0,index+1),boundary],remaining:[boundary,...points.slice(index+1)]};
}

// Draw only the reference segment belonging to a saved atomic failure time.
// Interpolation locates points on the displayed polyline, never set bounds.
export function referenceInterval(points,startSeconds,endSeconds,dt){
  if(!points?.length)return [];
  const start=Math.max(0,Math.min(points.length-1,startSeconds/dt));
  const end=Math.max(start,Math.min(points.length-1,endSeconds/dt));
  const pointAt=position=>{
    const index=Math.floor(position),fraction=position-index;
    return points[index].map((value,k)=>value+fraction*((points[index+1]?.[k]??value)-value));
  };
  const segment=[pointAt(start)];
  for(let i=Math.floor(start)+1;i<end;i++)segment.push(points[i]);
  if(end>start)segment.push(pointAt(end));
  return segment;
}
