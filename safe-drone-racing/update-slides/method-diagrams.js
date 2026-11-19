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
function queryDiagram(kind,p){
  let s=title(kind==='regional-bound'?'One bound for every query in the trial':'Known error + permitted change = query-error bound');
  if(kind==='regional-bound'){
    const x=435,w=150+75*p,y=182,h=150;
    s+=dot(130,242,8,C.teal)+text(55,200,'Measured query zℓ',21,C.teal,'start',true);
    s+=rect(x,y,w,h,C.purple,.09)+text(x+5,y-20,'Query region Q',22,C.purple,'start',true);
    s+=dot(x+w/2,y+h/2,5,C.line)+line(130,242,x+w/2,y+h/2,C.line,2,'5 6');
    s+=line(130,242,x+w,y+h,C.gold,3)+dot(x+w,y+h,7,C.gold);
    s+=text(200,340,'dℓ(Q): distance to the farthest query',20,C.gold);
    s+=text(x+10,y+h+33,'All queries in the trial',17,C.muted);
    s+=budget(130,415,165,'Measured error αₐℓ',C.teal)+text(312,437,'+',26,C.ink);
    s+=budget(345,415,310,'Regional growth Lₐ dℓ(Q)',C.gold);
    s+=arrow(400,455,400,483,C.purple)+text(400,515,'Uniform bound βₐ(Q)',24,C.purple,'middle',true);
    return s;
  }
  const x=460+115*p;
  s+=box(55,116,247,110,'Measured query zℓ',['Error is bounded by αₐℓ'],C.teal);
  s+=box(x,116,185,110,'New query z',['Error not','measured'],C.purple);
  s+=line(304,171,x-8,171,C.gold,3,'7 5');
  s+=text((304+x)/2,264,'distance ‖z − zℓ‖',20,C.gold,'middle');
  s+=text(70,331,'Error allowance at the new query',23,C.ink,'start',true);
  const known=130,growth=180+115*p;
  s+=budget(70,371,known,'αₐℓ',C.teal)+budget(70+known+8,371,growth,'Lₐ ‖z − zℓ‖',C.gold);
  s+=line(70,416,70+known+8+growth,416,C.purple,3)+line(70,408,70,424,C.purple)+line(70+known+8+growth,408,70+known+8+growth,424,C.purple);
  s+=text(70,462,'Measured error',20,C.teal)+text(250,462,'Allowed change away from that query',20,C.gold);
  s+=note('Moving the query farther away increases the allowed model error.');
  return s;
}
export function renderMethodDiagram(scene,p){
  let s='';
  if(scene==='proof-map'||scene==='reach-map')s=proofMap(scene==='reach-map'?'reachability':'',p);
  else if(scene==='model-equations'){
    s+=title('The same base model in both dynamics');
    s+=box(70,105,650,112,'Prediction model',['Base equations f₀ + learned residual acceleration â'],C.blue);
    s+=box(70,266,650,112,'True dynamics',['Base equations f₀ + unknown residual acceleration a*'],C.ink);
    s+=arrow(393,381,393,424,C.purple);
    s+=box(140,430,510,94,'Difference: δ = a* − â',['Only this residual mismatch enters E(Q).'],C.purple);
  }else if(scene==='observed-error'){
    s+=title('At the same measured query zℓ');
    s+=box(55,106,325,138,'Observed acceleration',['Residual observation: 0.80 m/s²','Measurement error: at most 0.03'],C.teal);
    s+=box(423,106,322,138,'Learned acceleration',['Residual prediction: 0.70 m/s²','Evaluated at that same query'],C.blue);
    s+=arrow(216,250,340,326,C.teal)+arrow(580,250,462,326,C.blue);
    s+=text(400,369,'|0.80 − 0.70| + 0.03 = 0.13 m/s²',26,C.purple,'middle',true);
    s+=box(133,417,535,94,'Bound on true model error at zℓ',['The true error magnitude is at most 0.13 m/s².'],C.purple);
    s+=note('Illustrative numbers for one acceleration component; not flight data.');
  }else if(scene==='point-bound'||scene==='regional-bound')s=queryDiagram(scene,p);
  else if(scene==='anchor-minimum'){
    s+=title('Every row bounds the same unmeasured query');
    const alpha=[92,48,67],growth=[125+125*p,146-62*p,146+8*p],totals=alpha.map((v,i)=>v+growth[i]),best=totals.indexOf(Math.min(...totals));
    for(let i=0;i<3;i++){
      const y=139+i*103;
      s+=text(50,y+22,`Measurement ${i+1}`,21,C.ink);
      s+=budget(245,y,alpha[i],'α',C.teal)+budget(249+alpha[i],y,growth[i],'L d',C.gold);
      if(i===best)s+=rect(234,y-10,350,50,C.purple,0,6)+text(604,y+22,'Smallest total',19,C.purple,'start',true);
    }
    s+=text(245,474,'α: error at measurement',20,C.teal)+text(245,508,'L d: change allowed across the distance',20,C.gold);
    s+=note('Take the minimum total, rather than selecting by distance alone.',566);
  }else if(scene==='error-output'){
    s+=title('An enclosure of the true derivative');
    s+=box(55,134,295,129,'Predicted derivative',['Base + learned residual','One vector at a chosen (x,u)'],C.gold);
    s+=text(388,207,'+',42,C.ink,'middle');
    s+=box(425,134,320,129,'Allowed model error',['Three acceleration intervals','Inserted into v̇ by Bₐ'],C.purple);
    s+=arrow(400,292,400,358,C.blue);
    s+=box(125,366,550,125,'Set of possible true derivatives',['Every admissible true residual is covered.','Integrating this set will produce motion uncertainty.'],C.blue);
    s+=note('An acceleration allowance is not a position-tube radius.');
  }else if(scene==='feedback-states'){
    s+=title('The reference rₖ is the same; the state can differ');
    const colors=[C.blue,C.teal,C.purple];
    s+=rect(285,160,230,246,C.ink,.025)+text(400,220,'Known neural policy π',21,C.ink,'middle',true)+text(400,346,'u = π(x, rₖ)',24,C.ink,'middle');
    for(let i=0;i<3;i++){const y=180+i*100;s+=dot(100,y,11,colors[i])+text(128,y+6,`State x${'ABC'[i]}`,21,colors[i])+arrow(219,y,281,y,colors[i])+arrow(518,y,586,y,colors[i])+dot(612,y,10,colors[i])+text(639,y+6,`Command u${'ABC'[i]}`,20,colors[i]);}
    s+=note('CROWN covers all states in Xₖ, not just these three examples.',498);
    s+=note('The relation between a state and its command matters.',537);
  }else if(scene==='tm-dependence'){
    s+=title('One parameter links several coordinates');
    s+=dot(400,136,30,C.blue)+text(400,144,'ξ',28,'#fff','middle',true);
    s+=arrow(381,162,205,238,C.blue)+arrow(419,162,593,238,C.blue);
    s+=box(60,250,310,115,'First coordinate',['Polynomial P₁(ξ, θ)','+ bounded remainder I₁'],C.blue);
    s+=box(430,250,310,115,'Second coordinate',['Polynomial P₂(ξ, θ)','+ bounded remainder I₂'],C.blue);
    s+=text(400,423,'One value of ξ selects both polynomial values.',22,C.ink,'middle',true);
    s+=note('Remainders enclose what the polynomial cannot keep exactly.',475);
    s+=note('Keeping dependence avoids combining unrelated coordinate extremes.',524);
  }else if(scene==='crown-relaxation'){
    s+=title('A nonlinear operation is enclosed by affine maps');
    s+=box(52,180,230,150,'Bounded input',['One neuron input','lies between lᴿ and hᴿ','and crosses zero'],C.ink);
    s+=arrow(285,255,340,255,C.blue);
    s+=rect(350,112,394,114,C.blue)+text(372,148,'Upper affine bound',23,C.blue,'start',true)+text(372,194,'κ υ − κ lᴿ',28,C.blue);
    s+=rect(350,282,394,114,C.teal)+text(372,318,'Lower affine bound',23,C.teal,'start',true)+text(372,364,'κ υ',28,C.teal);
    s+=text(548,258,'ReLU output always lies between',19,C.muted,'middle');
    s+=arrow(547,410,547,449,C.blue)+text(400,486,'Compose backward through the network',23,C.ink,'middle',true);
    s+=note('The bounds hold for every input in the stated interval.');
  }else if(scene==='crown-input'){
    s+=title('Preserve the state parameters through the network');
    s+=box(70,89,660,104,'Input: ζ = (ξ, eₓ) in Ξ × Iₓ',['Reconstruct the represented state: x = cₓ + Aₓ ξ + eₓ'],C.blue);
    s+=arrow(400,198,400,235,C.blue);
    s+=box(70,244,660,104,'Complete applied map G(ζ) = π(x, rₖ)',['Feature transforms → neural network → physical command limits'],C.teal);
    s+=arrow(400,352,400,389,C.teal);
    s+=box(70,398,660,116,'Output: lower and upper affine functions of ζ',['Lower(ζ) ≤ actual command ≤ upper(ζ)','They bound every input in the set, not only the center.'],C.blue);
  }else if(scene==='crown-output'){
    s+=title('Separate a common slope from a bounded gap');
    s+=box(85,95,630,105,'Two enclosing affine functions',['Lower(ζ) ≤ G(ζ) ≤ upper(ζ)'],C.blue);
    s+=arrow(400,204,400,245,C.blue);
    s+=box(85,253,630,105,'Subtract the same Aζ from both sides',['Bound the remaining expressions over all ζ in Z'],C.purple);
    s+=arrow(400,362,400,404,C.purple);
    s+=box(85,412,630,105,'Command = shared affine part + interval',['G(ζ) lies in Aζ + [d⁻, d⁺]'],C.teal);
  }else if(scene==='joint-state-command'){
    s+=title('One joint state-command enclosure');
    s+=dot(126,290,38,C.blue)+text(126,299,'ξ',33,'#fff','middle',true);
    s+=arrow(165,273,291,183,C.blue)+arrow(165,306,291,392,C.blue);
    s+=box(305,110,416,139,'State',['x = cₓ + Aₓ ξ + eₓ','State remainder: eₓ in Iₓ'],C.blue);
    s+=box(305,324,416,139,'Command',['u lies in Aξ ξ + Iᵤ','Iᵤ includes the CROWN gap'],C.teal);
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" role="img" aria-label="${escape(scene)} explanation"><rect width="800" height="600" fill="${C.paper}"/>${s}</svg>`;
}
