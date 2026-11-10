// Presentation-only animation. All simulation recordings are loaded by app.js unchanged.
const $=(s,e=document)=>e.querySelector(s),$$=(s,e=document)=>[...e.querySelectorAll(s)];
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const stages=[
 ['Task and geometric paths','Predict how clarity will decay, then generate alternative routes toward useful sensing locations. These routes guide learning and initialize independent MBD optimizations.'],
 ['Locate relevant wind uncertainty','Weight wind uncertainty along paths with useful monitoring opportunities, including their transit corridors. High uncertainty elsewhere does not automatically justify a detour.'],
 ['Learn along useful paths','Choose measurement waypoints by expected weighted uncertainty reduction and travel distance. Actual observations update POAM. Dedicated learning ends when weighted uncertainty reaches its threshold.'],
 ['Predict the effect of wind','Evaluate MBD candidates through the robot dynamics, tracking controller and relaxed RPCBF under spatially coherent wind samples. The teal trajectory has the lowest evaluated expected monitoring cost.'],
 ['Execute, observe and replan','Execute a short segment through the runtime RPCBF. Continue sensing, update clarity and the wind belief using actual measurements, and replan. The finite-sample method is safety-aware; it does not guarantee collision avoidance.']
];
async function setupMethod(){
 const el=$('#method-cartoon'),buttons=$$('[data-method-step]');buttons.forEach(b=>b.disabled=true);
 const response=await fetch('assets/method-cartoon.svg');if(!response.ok)throw Error('Method illustration unavailable');el.innerHTML=await response.text();
 const svg=$('svg',el);svg.removeAttribute('width');svg.removeAttribute('height');svg.setAttribute('viewBox','0 19 540 155');svg.setAttribute('role','img');svg.setAttribute('aria-label','Animated five-step disturbance-aware informative planning method');
 const axes=[1,2,3,4,5].map(i=>$(`[id="axes_${i}"]`,svg));
 const paths=axes.map(g=>$$('path',g).filter(p=>/stroke: #(7754a3|d59a29|4e9ac5|087e73)/.test(p.getAttribute('style')||'')&&(p.getAttribute('style')||'').includes('fill: none')).map(p=>({p,len:p.getTotalLength(),dash:p.style.strokeDasharray,offset:p.style.strokeDashoffset,opacity:p.style.opacity,color:(p.getAttribute('style').match(/stroke: (#[\da-f]+)/)||[])[1]})));
 const dots=axes.map(g=>$$('path',g).filter(p=>(p.getAttribute('style')||'').includes('fill: #087e73')));
 const robots=axes.map((g,i)=>{if(![2,4].includes(i))return null;const route=paths[i].find(a=>Math.abs(parseFloat(a.p.style.strokeWidth)-(i===2?1.65:2.35))<.001);if(!route)return null;$$('path',g).filter(p=>/fill: #27333c|stroke: #27333c/.test(p.getAttribute('style')||'')).forEach(p=>p.style.visibility='hidden');const marker=document.createElementNS('http://www.w3.org/2000/svg','circle');marker.setAttribute('r','2.5');marker.setAttribute('fill','#27333c');marker.setAttribute('stroke','#fff');marker.setAttribute('stroke-width','.45');g.append(marker);return {marker,route}});
 for(const id of ['patch_147','line2d_22','line2d_23','text_22','legend_1'])$(`[id="${id}"]`,svg)?.remove();
 let progress=reduced?1:0,playing=false,visible=false,started=false,last=performance.now();
 const play=$('#cartoon-play'),range=$('#cartoon-progress');
 function render(){const phase=Math.min(4,Math.floor(progress*5));for(let i=0;i<5;i++){const f=Math.max(0,Math.min(1,progress*5-i));axes[i].style.opacity=i>phase?'.20':'1';paths[i].forEach(({p,len,color,dash,offset,opacity})=>{let local=f;if(i===3&&color==='#087e73')local=Math.max(0,(f-.55)/.45);if(i===3&&color==='#4e9ac5')local=Math.min(1,f/.6);if(dash)p.style.opacity=String((opacity?+opacity:1)*Math.min(1,local*2));else{p.style.strokeDasharray=`${len} ${len}`;p.style.strokeDashoffset=len*(1-Math.min(1,local))}if(f>=.999){p.style.strokeDasharray=dash;p.style.strokeDashoffset=offset;p.style.opacity=opacity}});if(i===2)dots[i].forEach((p,j)=>p.style.opacity=f>(j+1)/(dots[i].length+1)?'1':'.05');if(robots[i]){const {marker,route}=robots[i],p=route.p.getPointAtLength(route.len*f);marker.setAttribute('cx',p.x);marker.setAttribute('cy',p.y)}}
  $('#method-stage-title').textContent=stages[phase][0];$('#method-stage-copy').textContent=stages[phase][1];$('#cartoon-step').textContent=`Step ${phase+1} of 5`;range.value=progress;play.textContent=playing?'Pause':'Play animation';buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===phase)));
 }
 buttons.forEach((b,i)=>{b.disabled=false;b.onclick=()=>{playing=false;progress=(i+.999)/5;render()}});play.onclick=()=>{if(progress>=1)progress=0;playing=!playing;render()};$('#cartoon-restart').onclick=()=>{progress=0;playing=!reduced;render()};range.oninput=()=>{playing=false;progress=+range.value;render()};$('.cartoon-controls').hidden=false;
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible&&!started){started=true;playing=!reduced;render()}},{threshold:.2}).observe($('.method-figure'));
 render();function tick(now){const dt=Math.min(.1,(now-last)/1000);last=now;if(visible&&!document.hidden&&playing){progress=Math.min(1,progress+dt/24);if(progress>=1)playing=false;render()}requestAnimationFrame(tick)}requestAnimationFrame(tick);
}
setupMethod().catch(e=>{console.error(e);$$('[data-method-step]').forEach(b=>b.hidden=true)});
// Only instantiate added WebGL views as the visitor approaches them.
const viewerObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){const iframe=entry.target;iframe.src=iframe.dataset.src;viewerObserver.unobserve(iframe)}},{rootMargin:'200px'});$$('iframe[data-src]').forEach(e=>viewerObserver.observe(e));
