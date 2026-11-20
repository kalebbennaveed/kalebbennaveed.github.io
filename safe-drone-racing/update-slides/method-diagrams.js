// Deterministic explanatory diagrams. Query distances are schematic, not positions
// on the course; numerical budgets on the measurement slide are illustrative.
const C={ink:'#173850',muted:'#657c8c',blue:'#326cc6',teal:'#00858b',gold:'#bc880d',purple:'#8151ac',red:'#c53e50',line:'#bdccd5',paper:'#fafbf9'};
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const text=(x,y,s,size=21,color=C.ink,anchor='start',bold=false)=>`<text x="${x}" y="${y}" font-family="Arial,Helvetica,sans-serif" font-size="${size}" fill="${color}" text-anchor="${anchor}" font-weight="${bold?600:400}">${escape(s)}</text>`;
const lines=(x,y,items,size=20,color=C.muted,gap=29)=>items.map((s,i)=>text(x,y+i*gap,s,size,color)).join('');
const rect=(x,y,w,h,color=C.blue,fill=.05,rx=10)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${color}" fill-opacity="${fill}" stroke="${color}" stroke-width="2"/>`;
const line=(x,y,xx,yy,color=C.line,width=2,dash='')=>`<line x1="${x}" y1="${y}" x2="${xx}" y2="${yy}" stroke="${color}" stroke-width="${width}" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
const dot=(x,y,r,color)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
function arrow(x,y,xx,yy,color=C.blue,width=3){const a=Math.atan2(yy-y,xx-x),d=10;return line(x,y,xx,yy,color,width)+`<path d="M${xx-d*Math.cos(a-.48)} ${yy-d*Math.sin(a-.48)}L${xx} ${yy}L${xx-d*Math.cos(a+.48)} ${yy-d*Math.sin(a+.48)}" fill="none" stroke="${color}" stroke-width="${width}"/>`;}
function box(x,y,w,h,title,body,color=C.blue){return `<g class="diagram-block">`+rect(x,y,w,h,color)+text(x+19,y+33,title,22,color,'start',true)+lines(x+19,y+66,body)+'</g>';}
function title(s){return text(35,48,s,22,C.ink,'start',true);}
function note(s,y=555){return text(400,y,s,19,C.muted,'middle');}
function budget(x,y,width,label,color){return `<rect x="${x}" y="${y}" width="${width}" height="30" rx="4" fill="${color}" fill-opacity=".17"/>`+text(x+width/2,y+21,label,17,color,'middle',true);}
function proofMap(active,p){
  let s=title('Data → model-error bound → controlled motion');
  s+=box(65,92,670,118,'1  Model error',['Observed errors + justified bound on how fast error changes', 'Output: acceleration-error set E(Q) for each query region Q'],C.purple);
  s+=arrow(400,213,400,267,C.purple)+text(418,249,'E(Q)',21,C.purple);
  s+=rect(65,272,670,222,C.blue,.025)+text(85,306,'2  Reachability',22,C.blue,'start',true);
  s+=box(88,327,255,119,'CROWN',['Possible states →','feedback commands'],C.teal);
  s+=arrow(345,384,387,384,C.blue);
  s+=box(390,327,323,119,'Taylor-model integration',['Dynamics + error set E(Q)','→ next states and swept motion'],C.blue);
  s+=line(550,448,550,474,C.blue)+line(550,474,190,474,C.blue)+arrow(190,474,190,448,C.blue);
  if(active==='model')s+=rect(56,83,688,136,C.purple,0,14);
  if(active==='reachability')s+=rect(56,263,688,240,C.blue,0,14);
  s+=note(active==='reachability'?'Repeat the controller update and motion enclosure over the horizon.':'CROWN bounds the known controller; E(Q) bounds the unknown model error.');
  return s;
}
// The measurement and both distance bounds are reused through the first integration step.
const example = {
  samples: [{velocity: 4, error: 0.13}, {velocity: 5.5, error: 0.27}],
  slope: 0.2, initialVelocity: 5, region: [4.75, 5.25], duration: 0.5
};
function errorBound(sample, interval) {
  const distance = Math.max(...interval.map(v => Math.abs(v - sample.velocity)));
  return sample.error + example.slope * distance;
}
const beta = Math.min(...example.samples.map(s => errorBound(s, example.region)));
function intervalLine(x, y, lo, hi, color) {
  const left = x(lo), right = x(hi);
  return line(left,y,right,y,color,8) + line(left,y-12,left,y+12,color,2)
       + line(right,y-12,right,y+12,color,2);
}
function velocityScale(y) {
  const x = v => 110 + (v-4)*362;
  let s = line(68,y,735,y,C.line,2);
  for(const v of [4,4.5,5,5.5]){
    s += line(x(v),y-6,x(v),y+7,C.ink) + text(x(v),y+35,v.toFixed(1),20,C.ink,'middle');
  }
  return s + text(400,y+75,'Velocity (m/s)',20,C.muted,'middle');
}
function exampleFigure(scene, phase) {
  const {samples, region, duration, initialVelocity:v0} = example;
  const x = v => 110 + (v-4)*362;
  if (scene === 'observed-error') {
    const ax = a => 110 + (a-0.65)*2350;
    let s=title('One residual measurement at 4 m/s');
    s+=text(65,128,'Learned residual',22,C.blue)+text(65,165,'0.70 m/s²',32,C.ink);
    s+=text(420,128,'Measured residual',22,C.teal)+text(420,165,'0.80 ± 0.03 m/s²',32,C.ink);
    s+=line(85,286,690,286,C.line)+intervalLine(ax,286,.77,.83,C.teal)+dot(ax(.70),286,7,C.blue);
    for(const a of [.70,.77,.83]) s+=text(ax(a),332,a.toFixed(2),22,C.ink,'middle');
    s+=text(400,373,'Residual acceleration (m/s²)',20,C.muted,'middle');
    const a=.77+.06*phase;
    s+=dot(ax(a),286,6,C.ink)+line(ax(.70),241,ax(a),241,C.gold,3);
    s+=text(400,455,'Greatest distance from 0.70 to the allowed interval',22,C.ink,'middle');
    return s+text(400,506,'0.83 − 0.70 = 0.13 m/s²',34,C.purple,'middle',true);
  }
  if(scene==='point-bound' || scene==='regional-bound'){
    const regionView=scene==='regional-bound';
    const query=regionView?region:[5+phase*.25,5+phase*.25];
    let s=title(regionView?'One bound for all velocities from 4.75 to 5.25 m/s':'What does the measurement permit at a new speed?');
    s+=velocityScale(246);
    for(const [i,sample] of samples.entries()){
      if(i&&!regionView)continue;
      s+=dot(x(sample.velocity),246,7,C.teal)+text(x(sample.velocity),164,'Sample '+(i+1),21,C.teal,'middle',true);
    }
    if(regionView){
      s+=intervalLine(x,212,...region,C.purple);
      s+=text(x(5),188,'Trial velocities',21,C.purple,'middle');
      const active = phase < .5 ? 0 : 1;
      const far = active === 0 ? region[1] : region[0];
      s+=line(x(samples[active].velocity),120,x(far),120,C.gold,3)+dot(x(far),120,5,C.gold);
      s+=text((x(far)+x(samples[active].velocity))/2,100,'Farthest distance  '+Math.abs(far-samples[active].velocity).toFixed(2)+' m/s',19,C.gold,'middle');
      s+=text(75,389,'From 4.00 m/s',22,C.teal)+text(325,389,'0.13 + 0.20 × 1.25 = 0.38',24,C.ink);
      s+=text(75,439,'From 5.50 m/s',22,C.teal)+text(325,439,'0.27 + 0.20 × 0.75 = 0.42',24,C.ink);
      return s+text(400,524,'Smaller valid bound    0.38 m/s²',29,C.purple,'middle',true);
    }
    const v=query[0], distance=v-samples[0].velocity;
    s+=line(x(4),212,x(v),212,C.gold,3)+dot(x(v),246,8,C.purple)+text(x(v),164,v.toFixed(2)+' m/s',24,C.purple,'middle',true);
    s+=text(400,399,'Error at sample  +  maximum change across the gap',22,C.ink,'middle');
    s+=text(400,465,'0.13 + 0.20 × '+distance.toFixed(2)+' = '+errorBound(samples[0],query).toFixed(2)+' m/s²',32,C.purple,'middle',true);
    return s;
  }
  if(scene==='worked-motion'){
    const t=phase*duration,dv=beta*t,dp=beta*t*t/2;
    const vx=v=>400+(v-v0)*1100, px=cm=>400+cm*47;
    let s=title('One axis with zero predicted net acceleration');
    s+=text(400,105,'Elapsed time   '+t.toFixed(2)+' s',28,C.ink,'middle',true);
    s+=text(65,173,'Velocity',22,C.blue,'start',true);
    s+=line(125,213,675,213,C.line,2)+intervalLine(vx,213,v0-dv,v0+dv,C.blue)+dot(400,213,4,C.ink);
    s+=text(400,264,'5.00 ± '+dv.toFixed(3)+' m/s',26,C.blue,'middle');
    s+=text(65,343,'Position relative to the prediction',22,C.purple,'start',true);
    s+=line(125,391,675,391,C.line,2)+intervalLine(px,391,-100*dp,100*dp,C.purple)+dot(400,391,4,C.ink);
    s+=text(400,442,'± '+(100*dp).toFixed(2)+' cm about '+(v0*t).toFixed(2)+' m',26,C.purple,'middle');
    return s+note('At 0.50 s the position interval is 2.4525 to 2.5475 m.');
  }
  if(scene==='worked-feedback'||scene==='worked-relu'){
    const q=.19*(2*phase-1),g=Math.max(0,q),lower=.5*q,upper=.5*q+.095;
    let s=title(scene==='worked-relu'?'One neuron over the allowed input interval':'How two possible velocities change the command');
    if(scene==='worked-feedback'){
      s+=text(400,128,'Illustrative command   u = K max(0, 5 − v)',26,C.ink,'middle',true);
      s+=text(400,172,'K = 1 s⁻¹',22,C.muted,'middle');
      for(const [i,v] of [4.81,5,5.19].entries()){
        const y=254+i*76;
        s+=text(100,y,v.toFixed(2)+' m/s',25,C.blue)+arrow(273,y-8,430,y-8,C.line);
        s+=text(470,y,Math.max(0,5-v).toFixed(2)+' m/s²',25,C.teal);
      }
      return s+note('The reference remains 5 m/s for all three states.');
    }
    const axis=v=>140+(v+.1)*1750;
    s+=text(400,150,'Input q = '+q.toFixed(3)+' on [−0.19, 0.19]',25,C.ink,'middle');
    s+=line(90,288,694,288,C.line)+intervalLine(axis,288,lower,upper,C.blue)+dot(axis(g),288,8,C.teal);
    s+=text(75,395,'Lower bound',21,C.blue)+text(400,395,'ReLU output',21,C.teal,'middle')+text(728,395,'Upper bound',21,C.blue,'end');
    s+=text(75,442,lower.toFixed(3),30,C.ink)+text(400,442,g.toFixed(3),30,C.teal,'middle',true)+text(728,442,upper.toFixed(3),30,C.ink,'end');
    return s+note('The point stays inside the affine bounds for each input q.');
  }
  if(scene==='shift-example'){
    const value=.05+.15*phase, position=y=>330+1650*y;
    let s=title('Trial polynomial P = 0 with allowance I = [−0.10, 0.10]');
    s+=text(400,137,'For ẏ = 5 and y(0) = 0, the integrated image is 5t.',22,C.ink,'middle');
    s+=intervalLine(position,273,-.1,.1,C.blue)+dot(position(value),273,9,value>.1?C.red:C.teal);
    s+=text(position(-.1),325,'−0.10',22,C.blue,'middle')+text(position(.1),325,'0.10',22,C.blue,'middle');
    s+=text(400,402,'t = '+(value/5).toFixed(3)+'     P⁺ = '+value.toFixed(3)+'     I⁺ = {0}',26,C.ink,'middle');
    return s+note(value>.1?'The integrated value is outside the trial.':'At this time the integrated value is inside the trial.',489);
  }
  return null;
}

export function renderMethodDiagram(scene,p){
  const worked=exampleFigure(scene,p);
  if(worked!==null) return svgFigure(scene,worked);
  let s='';
  if(scene==='proof-map'||scene==='reach-map')s=proofMap(scene==='reach-map'?'reachability':'',p);
  else if(scene==='model-equations'){
    s=title('The same base model in both dynamics');
    s+=box(70,105,650,112,'Prediction model',['Base equations f₀ + learned residual acceleration â'],C.blue);
    s+=box(70,266,650,112,'True dynamics',['Base equations f₀ + unknown residual acceleration a*'],C.ink);
    s+=arrow(393,381,393,424,C.purple);
    s+=box(140,430,510,94,'Difference: δ = a* − â',['Only this residual mismatch enters E(Q).'],C.purple);
  }else if(scene==='error-output'){
    s+=title('An enclosure of the true derivative');
    s+=box(55,134,295,129,'Predicted derivative',['Base + learned residual','One vector at a chosen (x,u)'],C.gold);
    s+=text(388,207,'+',42,C.ink,'middle');
    s+=box(425,134,320,129,'Allowed model error',['Three acceleration intervals','Inserted into v̇ by Bₐ'],C.purple);
    s+=arrow(400,292,400,358,C.blue);
    s+=box(125,366,550,125,'Set of possible true derivatives',['Every admissible true residual is covered.','Integrating this set will produce motion uncertainty.'],C.blue);
    s+=note('An acceleration allowance is not a position-tube radius.');
  }else if(scene==='crown-input'){
    s+=title('Preserve the state parameters through the network');
    s+=box(70,89,660,104,'Inputs w = (ξ, eₓ)',['Reconstruct the represented state: x = cₓ + Aₓ ξ + eₓ'],C.blue);
    s+=arrow(400,198,400,235,C.blue);
    s+=box(70,244,660,104,'Complete applied map G(w) = π(x, rₖ)',['Feature transforms → neural network → physical command limits'],C.teal);
    s+=arrow(400,352,400,389,C.teal);
    s+=box(70,398,660,116,'Each command lies between two affine functions of w',['Lower(w) ≤ actual command ≤ upper(w)','They bound every input in the set, not only the center.'],C.blue);
  }else if(scene==='joint-state-command'){
    s+=title('Use the same parameter for the state and its command');
    s+=dot(126,290,38,C.blue)+text(126,299,'ξ',33,'#fff','middle',true);
    s+=arrow(165,273,291,183,C.blue)+arrow(165,306,291,392,C.blue);
    s+=box(305,110,416,139,'State',['x = cₓ + Aₓ ξ + eₓ','State remainder: eₓ in Iₓ'],C.blue);
    s+=box(305,324,416,139,'Command',['u lies in A₍ξ₎ ξ + Iᵤ','Iᵤ includes the CROWN gap'],C.teal);
    s+=note('The same ξ appears in both affine expressions.');
  }else if(scene==='held-command'||scene==='implementation-clock'){
    const impl=scene==='implementation-clock';
    s+=title(impl?'One 0.05 s control interval contains five 0.01 s steps':'Alternate neural updates and continuous motion');
    s+=box(55,95,250,110,'At the update',['CROWN encloses uₖ','from the current state set'],C.teal);
    s+=arrow(310,153,376,153,C.teal);
    s+=box(386,95,350,110,'Between updates',['Propagate y = (x,u)','Keep u̇ = 0'],C.blue);
    s+=text(60,263,'Held command uₖ',22,C.teal,'start',true);
    s+=rect(60,285,675,49,C.teal,.13,4)+text(397,317,'Same command along each possible flight',21,C.teal,'middle');
    for(let i=0;i<5;i++){const x=60+i*135;s+=rect(x,374,127,78,C.blue,i<=Math.floor(p*5)?.13:.025,4)+text(x+64,421,impl?'0.01 s':'step h',21,C.blue,'middle');}
    s+=text(60,490,impl?'0 s':'kΔ',21,C.ink)+text(735,490,impl?'0.05 s':'(k+1)Δ',21,C.ink,'end');
    s+=note('At the next update, CROWN encloses the new feedback command.');
  }else if(scene==='trial-region'){
    s+=title('The error bound must cover this propagation trial');
    s+=box(60,95,680,105,'Trial: Y = P + I',['Every represented state and held command is included.'],C.blue);
    s+=arrow(230,204,230,253,C.purple)+text(248,237,'Apply χ',18,C.muted);
    s+=box(60,263,330,115,'Query region Q(Y)',['Residual inputs reached','anywhere inside the trial'],C.purple);
    s+=arrow(395,320,439,320,C.purple);
    s+=box(450,263,290,115,'Model error E(Q)',['Data + farthest distances','over this whole region'],C.purple);
    s+=line(595,383,595,450,C.gold)+line(595,450,95,450,C.gold)+arrow(95,450,95,205,C.gold);
    s+=text(340,494,'An expanded trial needs a bound covering the expansion.',20,C.gold,'middle');
    s+=note('This is the model-error component used inside reachability.');
  }else if(scene==='picard-image'||scene==='full-inclusion'||scene==='one-step-proof'){
    s+=title(scene==='picard-image'?'Compare the proposed motion and its integrated image':scene==='full-inclusion'?'Express the image relative to the same trial polynomial':'Self-inclusion establishes a solution inside the trial');
    s+=rect(66,145,667,270,C.blue,.04,30)+text(89,185,'Trial P + I',23,C.blue,'start',true);
    s+=rect(133,228,528-45*p,126,C.teal,.13,20)+text(160,271,'Enclosed Picard image P⁺ + I⁺',23,C.teal,'start',true);
    s+=text(160,311,'All represented initial values and allowed dynamics',18,C.teal);
    if(scene==='picard-image')s+=note('Integrate the allowed derivatives, then test whether the image fits.',477);
    else if(scene==='full-inclusion'){
      s+=text(400,468,'Image relative to P:  box(P⁺ − P) + I⁺',24,C.ink,'middle',true);
      s+=note('The polynomial difference and interval remainder both count.',520);
    }else{
      s+=text(400,462,'Picard maps the trial into itself.',24,C.ink,'middle',true);
      s+=note('Existence of a fixed point + uniqueness identifies the true solution.',512);
    }
  }else if(scene==='containment-chain'){
    s+=title('Containment follows interval by interval');
    const labels=[['Exact start','X₀ contains x₀'],['Validated step','Y₀ contains the full interval'],['Enclosed endpoint','X₁ contains the next state']];
    labels.forEach(([a,b],i)=>{const y=94+i*145;s+=box(90,y,620,104,a,[b],i===0?C.teal:C.blue);if(i<2)s+=arrow(400,y+108,400,y+140,C.blue);});
    s+=note('Repeat; recompute the command at each scheduled controller update.');
  }else if(scene==='coverage'){
    s+=title('Safety holds on verified, covered execution intervals');
    s+=box(70,100,660,117,'Required together',['Uniformly valid model-error bounds + sound set calculations','The same controller, reference and timing during execution'],C.blue);
    s+=text(70,284,'Current commitment',22,C.teal,'start',true);
    s+=rect(70,307,470,57,C.teal,.14,4)+text(300,342,'Verified horizon',21,C.teal,'middle');
    s+=line(543,337,730,337,C.line,3,'7 7');
    s+=text(70,399,'Activation',20,C.muted)+text(540,399,'Expiration',20,C.muted,'middle');
    s+=box(70,438,660,88,'After expiration',['A new verified commitment or a proved safe continuation is needed.'],C.gold);
  }else if(scene==='velocity-query'){
    s+=title('In this implementation the query is velocity');
    s+=box(60,100,680,110,'Full drone state x = (p, v, η, ω)',['Select velocity for this particular residual model: χ(x,u) = v'],C.ink);
    s+=arrow(400,214,400,254,C.purple);
    s+=box(60,264,680,110,'A trial gives a velocity region V',['Each residual component depends only on its own velocity coordinate.'],C.purple);
    s+=arrow(400,378,400,418,C.purple);
    s+=box(60,428,680,104,'Data-and-distance bound over V',['Use the farthest interval endpoint from each measured velocity.'],C.purple);
    s+=note('Velocity-only dependence is a model assumption; the full state is propagated.',576);
  }else return null;
  return svgFigure(scene,s);
}
function svgFigure(scene,s){
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" role="img" aria-label="${escape(scene)} explanation"><rect width="800" height="600" fill="${C.paper}"/>${s}</svg>`;
}
