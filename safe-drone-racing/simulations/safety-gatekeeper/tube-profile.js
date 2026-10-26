// A readable scale view of the saved bounds. No inflation of the 3D tube.
export function drawTubeProfile(bounds, elapsed, dt) {
  const canvas=document.getElementById('tube-width-chart');
  const caption=document.getElementById('tube-width-caption');
  if(!canvas||!bounds?.radii?.length)return;
  const w=canvas.clientWidth,h=155,dpr=Math.min(devicePixelRatio,2);
  canvas.width=w*dpr;canvas.height=h*dpr;
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  const rows=bounds.radii.map(row=>row.map(v=>v*2000));
  const max=Math.max(.01,...rows.flat())*1.12,left=42,right=w-10,top=18,bottom=h-28;
  const x=i=>left+(right-left)*(i+1)/rows.length,y=v=>bottom-(bottom-top)*v/max;
  ctx.font='10px system-ui';ctx.fillStyle='#aeb9ca';
  ctx.fillText('Full position width · mm',left,10);
  for(let i=0;i<=3;i++){const v=max*i/3;ctx.fillStyle='#aeb9ca';ctx.fillText(v.toFixed(1),0,y(v)+3);ctx.strokeStyle='#363c48';ctx.beginPath();ctx.moveTo(left,y(v));ctx.lineTo(right,y(v));ctx.stroke();}
  ['#64d8df','#b69ae7','#efb75f'].forEach((color,k)=>{ctx.strokeStyle=color;ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(left,y(0));rows.forEach((row,i)=>ctx.lineTo(x(i),y(row[k])));ctx.stroke();ctx.fillStyle=color;ctx.fillText(['x','y','z'][k],right-42+k*16,10);});
  const index=Math.min(rows.length-1,Math.max(0,Math.round(elapsed/dt)-1));
  ctx.strokeStyle='#fff9';ctx.beginPath();ctx.moveTo(x(index),top);ctx.lineTo(x(index),bottom);ctx.stroke();
  ctx.fillStyle='#aeb9ca';ctx.fillText('0 s',left,bottom+18);ctx.textAlign='right';ctx.fillText(`${(rows.length*dt).toFixed(2)} s`,right,bottom+18);
  caption.textContent=`At +${((index+1)*dt).toFixed(2)} s: x ${rows[index][0].toFixed(2)}, y ${rows[index][1].toFixed(2)}, z ${rows[index][2].toFixed(2)} mm. These are full widths of the endpoint position box; the 3D view also shows motion between endpoints.`;
}
