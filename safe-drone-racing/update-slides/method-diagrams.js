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
function proofMap(){
  let s=title('Inputs and outputs of the safety check');
  s+=box(70,76,660,110,'1   Residual observations → acceleration error',
    ['Use the data to bound each acceleration component','throughout the velocities the vehicle may reach.'],C.purple);
  s+=arrow(400,189,400,225,C.purple);
  s+=box(70,232,660,110,'2   Acceleration error + feedback → reachable tube',
    ['Enclose the state under the candidate reference and all','accelerations consistent with the model-error bound.'],C.blue);
  s+=arrow(400,345,400,381,C.blue);
  s+=box(70,388,660,110,'3   Reachable positions + body size → clearance',
    ['Compare the volume occupied during each time interval','with the solid gate bars and other obstacles.'],C.teal);
  return s;
}

function fitSlopes(phase){
  let s=title('Slope of the fitted acceleration on one axis');
  const rows=[
    ['Before the first breakpoint','0'],
    ['After the first, before the second','wⱼ₁'],
    ['After the second, before the third','wⱼ₁ + wⱼ₂']
  ];
  s+=text(70,138,'Velocity interval',21,C.muted)+text(505,138,'Segment slope',21,C.muted);
  const active=Math.min(rows.length-1,Math.floor(phase*rows.length));
  rows.forEach(([interval,slope],i)=>{
    const y=209+i*75;
    if(active===i)s+=rect(50,y-44,695,67,C.teal,.07,5);
    s+=text(70,y,interval,22,C.ink)+text(505,y,slope,24,C.teal);
  });
  s+=line(65,414,732,414,C.line);
  return s+lines(70,467,['Continue across all 21 breakpoints. The largest absolute',
    'slope bounds the change in the fitted acceleration per m/s.'],21,C.ink,32);
}

function simulatorSlope(){
  let s=title('Contributions to the simulator slope limit');
  const rows=[['Linear drag','λ dⱼ'],['Constant bias','0'],['Sinusoidal acceleration','λ |γ| / v₀']];
  s+=text(65,138,'Acceleration term',21,C.muted)+text(430,138,'Maximum absolute slope',21,C.muted);
  rows.forEach(([name,limit],i)=>{
    const y=214+i*76;
    s+=line(65,y-42,737,y-42,C.line,1)+text(65,y,name,24,C.ink)+text(430,y,limit,26,C.blue);
  });
  return s+note('Adding these limits bounds the slope of the true residual.',477);
}

function referenceDecision(){
  let s=title('Reference selection at a planning update');
  s+=box(180,77,440,94,'Candidate schedules',['One schedule per switching time'],C.gold);
  s+=arrow(400,174,400,211,C.gold);
  s+=box(180,216,440,93,'Gatekeeper',['Check each full schedule'],C.blue);
  s+=line(400,312,400,348,C.blue)+line(205,348,595,348,C.blue);
  s+=arrow(205,348,205,380,C.teal)+arrow(595,348,595,380,C.ink);
  s+=box(46,386,325,112,'A candidate passes',['Commit the longest verified','racing portion.'],C.teal);
  s+=box(428,386,325,112,'None passes',['Continue the previous','unexpired commitment.'],C.ink);
  return s;
}

function resultsFigure(timing){
  const rows=timing?[
    ['MPPI search','0.276–0.377 s'],['Candidate generation','4.03–5.32 ms'],
    ['Six reachable tubes','2.351–2.399 s'],['Geometry checks','0.48–0.70 ms']
  ]:[
    ['Course 1','17','2.425'],['Course 2','5','1.578'],
    ['Course 3','7','1.912'],['Course 4','5','1.919']
  ];
  let s=title(timing?'Component times for one planning update':'Method 1 over 45 seconds per course');
  const xs=timing?[60,730]:[60,448,730];
  const headers=timing?['Component','Range of course means']:['Environment','Gate crossings','Mean speed (m/s)'];
  headers.forEach((header,i)=>{s+=text(xs[i],135,header,20,C.muted,i?'end':'start');});
  rows.forEach((row,i)=>{
    const y=203+72*i;
    s+=line(60,y-41,730,y-41,C.line,1);
    row.forEach((v,j)=>{s+=text(xs[j],y,v,25,timing&&i===2?C.blue:C.ink,j?'end':'start');});
  });
  return s+note(timing?'CPU measurements exclude the first update on each course.':'Gate crossings count passages through the ordered course gates.',508);
}

function futureLearning(){
  let s=title('Proposed experiment');
  s+=box(70,90,660,108,'Select a verified candidate',['Prefer a candidate that visits a poorly sampled velocity region.'],C.blue);
  s+=arrow(400,202,400,245,C.blue);
  s+=box(70,252,660,108,'Collect residual observations',['Use new observations to fit the residual and update its error bound.'],C.purple);
  s+=arrow(400,363,400,406,C.purple);
  s+=box(70,413,660,108,'Verify the next candidate',['Use the revised model and bound before changing the commitment.'],C.teal);
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
  return s + text(400,y+75,'Velocity along the x axis (m/s)',20,C.muted,'middle');
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
  if(scene==='point-bound'){
    const measured=samples[0].velocity, current=v0, distance=current-measured;
    const lo=x(measured),hi=x(current);
    let s=title('Acceleration error at the start of the flight segment');
    s+=text(lo,128,'Earlier flight',22,C.teal,'middle',true)+text(lo,162,'4.00 m/s',24,C.teal,'middle');
    s+=text(hi,128,'Start of this segment',22,C.purple,'middle',true)+text(hi,162,'5.00 m/s',24,C.purple,'middle');
    s+=velocityScale(247);
    s+=dot(lo,247,8,C.teal)+dot(hi,247,8,C.purple);
    s+=line(lo,201,hi,201,C.line,2)+line(lo,201,lo+(hi-lo)*phase,201,C.gold,4);
    s+=line(lo,193,lo,209,C.gold,2)+line(hi,193,hi,209,C.gold,2);
    s+=text((hi+lo)/2,190,'Difference of '+distance.toFixed(2)+' m/s',18,C.ink,'middle');
    s+=text(55,392,'Error bound at 4.00 m/s',22,C.teal)+text(735,392,'0.13 m/s²',24,C.teal,'end');
    s+=text(55,446,'Maximum change over 1.00 m/s',22,C.ink)+text(735,446,'+ 0.20 m/s²',24,C.ink,'end');
    s+=line(55,471,735,471,C.line);
    return s+text(55,519,'Error bound at 5.00 m/s',23,C.purple,'start',true)
      +text(735,519,errorBound(samples[0],[current,current]).toFixed(2)+' m/s²',28,C.purple,'end',true);
  }
  if(scene==='regional-bound'){
    let s=title('One bound for velocities from 4.75 to 5.25 m/s');
    s+=velocityScale(246);
    for(const sample of samples){
      s+=dot(x(sample.velocity),246,7,C.teal)+text(x(sample.velocity),164,'Earlier observation',19,C.teal,'middle',true);
    }
    s+=intervalLine(x,212,...region,C.purple);
    s+=text(x(v0),188,'Trial interval',21,C.purple,'middle');
    const active=phase<.5?0:1, far=active===0?region[1]:region[0];
    s+=line(x(samples[active].velocity),120,x(far),120,C.gold,3)+dot(x(far),120,5,C.gold);
    s+=text((x(far)+x(samples[active].velocity))/2,100,'Farthest distance  '+Math.abs(far-samples[active].velocity).toFixed(2)+' m/s',19,C.gold,'middle');
    s+=text(75,389,'From 4.00 m/s',22,C.teal)+text(325,389,'0.13 + 0.20 × 1.25 = 0.38',24,C.ink);
    s+=text(75,439,'From 5.50 m/s',22,C.teal)+text(325,439,'0.27 + 0.20 × 0.75 = 0.42',24,C.ink);
    return s+text(400,524,'Smaller valid bound    0.38 m/s²',29,C.purple,'middle',true);
  }
  if(scene==='worked-motion'){
    const t=Math.round(phase*duration*100)/100,dv=beta*t,dp=beta*t*t/2;
    const vx=v=>400+(v-v0)*1100, px=cm=>400+cm*47;
    let s=title('One axis with zero predicted net acceleration');
    s+=text(400,105,'Elapsed time   '+t.toFixed(2)+' s',28,C.ink,'middle',true);
    s+=text(65,173,'Velocity',22,C.blue,'start',true);
    s+=line(125,213,675,213,C.line,2)+intervalLine(vx,213,v0-dv,v0+dv,C.blue)+dot(400,213,4,C.ink);
    s+=text(400,264,'5.00 ± '+dv.toFixed(4)+' m/s',26,C.blue,'middle');
    s+=text(65,343,'Position relative to the prediction',22,C.purple,'start',true);
    s+=line(125,391,675,391,C.line,2)+intervalLine(px,391,-100*dp,100*dp,C.purple)+dot(400,391,4,C.ink);
    s+=text(400,442,'± '+(100*dp).toFixed(4)+' cm about '+(v0*t).toFixed(2)+' m',26,C.purple,'middle');
    return s+note('At 0.50 s the position interval is 2.4525 to 2.5475 m.');
  }
  if(scene==='worked-feedback'||scene==='worked-relu'){
    const q=.19*(2*phase-1),g=Math.max(0,q),lower=.5*q,upper=.5*q+.095;
    let s=title(scene==='worked-relu'?'One neuron over the allowed input interval':'Feedback at three possible velocities');
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
  if(scene==='proof-map'||scene==='references')s=proofMap();
  else if(scene==='fit-slopes')s=fitSlopes(p);
  else if(scene==='simulator-slope')s=simulatorSlope();
  else if(scene==='reference-decision')s=referenceDecision();
  else if(scene==='flight-results'||scene==='timing')s=resultsFigure(scene==='timing');
  else if(scene==='future-learning')s=futureLearning();
  else if(scene==='model-equations'){
    s=title('At the same state and applied command');
    s+=box(40,116,345,120,'Prediction model',['Base rigid-body derivative','+ learned acceleration in v̇'],C.blue);
    s+=box(415,116,345,120,'True dynamics',['Base rigid-body derivative','+ true acceleration in v̇'],C.ink);
    s+=line(213,241,213,300,C.blue)+line(588,241,588,300,C.ink);
    s+=line(213,300,588,300,C.line)+arrow(400,300,400,357,C.purple);
    s+=box(110,364,580,120,'Difference in translational acceleration',['δ(v) = a*(v) − â(v)','Three components in m/s²'],C.purple);
  }else if(scene==='error-output'){
    s+=title('An enclosure of the true derivative');
    s+=box(55,134,295,129,'Predicted derivative',['Base + learned residual','One vector at a chosen (x,u)'],C.gold);
    s+=text(388,207,'+',42,C.ink,'middle');
    s+=box(425,134,320,129,'Allowed model error',['Three acceleration intervals','Inserted into v̇ by Bₐ'],C.purple);
    s+=arrow(400,292,400,358,C.blue);
    s+=box(125,366,550,125,'Set of possible true derivatives',['Every admissible true residual is covered.','Integration encloses the resulting motions.'],C.blue);
    s+=note('Integrating the derivative gives a bound on motion.');
  }else if(scene==='crown-input'){
    s+=title('Preserve the state parameters through the network');
    s+=box(70,89,660,104,'Inputs w = (ξ, eₓ)',['Reconstruct the represented state: x = cₓ + Aₓ ξ + eₓ'],C.blue);
    s+=arrow(400,198,400,235,C.blue);
    s+=box(70,244,660,104,'Complete applied map G(w) = π(x, rₖ)',['Feature transforms → neural network → physical command limits'],C.teal);
    s+=arrow(400,352,400,389,C.teal);
    s+=box(70,398,660,116,'Each command lies between two affine functions of w',['Lower(w) ≤ actual command ≤ upper(w)','The bounds hold throughout the input box.'],C.blue);
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
    s+=arrow(230,204,230,253,C.purple)+text(248,237,'Select the velocity coordinates',18,C.muted);
    s+=box(60,263,330,115,'Velocity region V',['Velocities represented','anywhere inside the trial'],C.purple);
    s+=arrow(395,320,439,320,C.purple);
    s+=box(450,263,290,115,'Acceleration error E(V)',['Data + farthest distances','over this whole region'],C.purple);
    s+=line(595,383,595,450,C.gold)+line(595,450,40,450,C.gold)+line(40,450,40,148,C.gold)+arrow(40,148,58,148,C.gold);
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
      s+=text(400,462,'The integral update maps the trial into itself.',24,C.ink,'middle',true);
      s+=note('Uniqueness identifies this solution with the flight from the given state.',512);
    }
  }else if(scene==='containment-chain'){
    s+=title('Containment follows interval by interval');
    const labels=[['Exact start','X₀ contains x₀'],['Validated step','Y₀ contains the full interval'],['Enclosed endpoint','X₁ contains the next state']];
    labels.forEach(([a,b],i)=>{const y=94+i*145;s+=box(90,y,620,104,a,[b],i===0?C.teal:C.blue);if(i<2)s+=arrow(400,y+108,400,y+140,C.blue);});
    s+=note('Bound the feedback command again at each controller update.');
  }else if(scene==='coverage'){
    s+=title('Safety holds on verified, covered execution intervals');
    s+=box(70,100,660,117,'Required together',['Uniformly valid model-error bounds + sound set calculations','The same controller, reference and timing during execution'],C.blue);
    s+=text(70,284,'Current commitment',22,C.teal,'start',true);
    s+=rect(70,307,470,57,C.teal,.14,4)+text(300,342,'Verified horizon',21,C.teal,'middle');
    s+=line(543,337,730,337,C.line,3,'7 7');
    s+=text(70,399,'Activation',20,C.muted)+text(540,399,'Expiration',20,C.muted,'middle');
    s+=box(70,438,660,88,'At expiration',['A new verified commitment or a proved safe continuation is needed.'],C.gold);
  }else return null;
  return svgFigure(scene,s);
}
function svgFigure(scene,s){
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" role="img" aria-label="${escape(scene)} explanation"><rect width="800" height="600" fill="${C.paper}"/>${s}</svg>`;
}
