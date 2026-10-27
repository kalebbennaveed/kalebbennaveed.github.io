// Recorded quantities only. A common time cursor links both plots to the replay.
export function drawFlightDiagnostics(record, time) {
  if(!record.samples?.length)return;
  const samples=record.samples;
  for(const [id,unit,first,second,labels] of [
    ['command-speed-chart','m/s',s=>s.speed,s=>s.desired_velocity?Math.hypot(...s.desired_velocity):NaN,['Actual','Requested']],
    ['altitude-chart','m',s=>s.state[2],s=>s.predicted_altitude,['Actual','Predicted']]
  ]) {
    const canvas=document.getElementById(id); if(!canvas?.clientWidth)continue;
    const w=canvas.clientWidth,h=180,dpr=Math.min(devicePixelRatio,2);
    canvas.width=w*dpr;canvas.height=h*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
    const values=samples.flatMap(s=>[first(s),second(s)]).filter(Number.isFinite);
    const max=Math.max(1,...values)*1.12,end=samples.at(-1).time,left=42,right=w-12,top=24,bottom=h-27;
    const x=t=>left+(right-left)*t/end,y=v=>bottom-(bottom-top)*v/max;
    ctx.font='11px system-ui';ctx.fillStyle='#b8c4d6';ctx.fillText(unit,5,13);
    for(let k=0;k<=4;k++){const v=max*k/4;ctx.fillStyle='#b8c4d6';ctx.fillText(v.toFixed(1),3,y(v)+4);ctx.strokeStyle='#353d49';ctx.beginPath();ctx.moveTo(left,y(v));ctx.lineTo(right,y(v));ctx.stroke();}
    [first,second].forEach((read,k)=>{ctx.strokeStyle=['#71e2db','#efb75f'][k];ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=1.8;ctx.setLineDash(k?[5,3]:[]);ctx.beginPath();let begun=false;for(const s of samples){const value=read(s);if(!Number.isFinite(value)){begun=false;continue;}if(!begun)ctx.moveTo(x(s.time),y(value));else ctx.lineTo(x(s.time),y(value));begun=true;}ctx.stroke();ctx.fillText(labels[k],left+k*90,13);});
    ctx.setLineDash([]);ctx.strokeStyle='#fff8';ctx.beginPath();ctx.moveTo(x(time),top);ctx.lineTo(x(time),bottom);ctx.stroke();
    ctx.fillStyle='#b8c4d6';ctx.fillText('0 s',left,h-7);ctx.textAlign='right';ctx.fillText(`${end.toFixed(0)} s`,right,h-7);
  }
}
