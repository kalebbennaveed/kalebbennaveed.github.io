import { icon } from './icons.js';
import { getRecords, getUnit, setUnit, getSyncStatus, saveRecord, deleteRecord } from './storage.js';
import { openSync } from './sync-ui.js';
import { openEditor } from './forms.js';
import { renderCalendar, renderReports } from './calendar-reports.js';

const kinds = {
  workout: {name:'Workouts', action:'Log workout', singular:'workout', detail:'Exercises, sets & reps', icon:'dumbbell'},
  meal: {name:'Meals', action:'Log meal', singular:'meal', detail:'Food, portions & calories', icon:'utensils'},
  prayer: {name:'SOAP journal', action:'Write SOAP', singular:'reflection', detail:'Scripture & reflection', icon:'book'},
  weight: {name:'Body weight', action:'Log weight', singular:'weigh-in', detail:'Body weight check-in', icon:'scale'}
};
const views = {overview:'Overview',calendar:'Calendar',reports:'Reports',...Object.fromEntries(Object.entries(kinds).map(([k,v])=>[k,v.name]))};
const page = document.querySelector('#main');
const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const key = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const local = s => new Date(s+'T12:00:00');
const shift = (s,n) => { const d=local(s); d.setDate(d.getDate()+n); return key(d); };
const format = (s,opts) => local(s).toLocaleDateString('en-US',opts);
const fullDate = s => format(s,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s||'') && key(local(s))===s;
const weight = (kg,u) => (Number(kg)*(u==='lb'?2.20462262185:1)).toLocaleString('en-US',{maximumFractionDigits:1});
const quantity = (n,word) => n+' '+word+(n===1?'':'s');
const byNewest = (a,b) => b.date.localeCompare(a.date) || Number(b.updatedAt||0)-Number(a.updatedAt||0);
function route() {
  const [raw, day] = location.hash.slice(1).split('/');
  return { view: Object.hasOwn(views,raw)?raw:'overview', date:validDate(day)?day:key(new Date()) };
}
function navigate(view,date) {
  const next='#'+view+(date===key(new Date())?'':'/'+date);
  if(location.hash===next) render();
  else location.hash=next;
  closeMenu();
}
function menuLink(view,name) {
  const {date}=route();
  const dest='#'+view+(date===key(new Date())?'':'/'+date);
  return '<a class="nav-link" href="'+dest+'" '+(route().view===view?'aria-current="page"':'')+'>'+icon(name,19)+'<span>'+views[view]+'</span></a>';
}
function rail() {
  document.querySelector('#navigation').innerHTML='<div class="nav-group"><span class="nav-label">Workspace</span>'+['overview','calendar','reports'].map(v=>menuLink(v,v)).join('')+'</div><div class="nav-group"><span class="nav-label">My trackers</span>'+Object.entries(kinds).map(([k,v])=>menuLink(k,v.icon)).join('')+'</div>';
  document.querySelector('#storage-label').textContent=getSyncStatus().label;
  document.querySelectorAll('[data-unit]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.unit===getUnit())));
}
function week(date) {
  const start=shift(date,-((local(date).getDay()+6)%7));
  return Array.from({length:7},(_,i)=>shift(start,i));
}
function weekRange(days) {
  const opts={month:'short',day:'numeric'};
  return format(days[0],opts)+' – '+format(days[6],days[0].slice(0,7)===days[6].slice(0,7)?{day:'numeric'}:opts);
}
function weekBanner(records,date) {
  const days=week(date), active=new Set(records.filter(r=>days.includes(r.date)).map(r=>r.date));
  return `<section class="week-banner" aria-labelledby="week-heading"><div class="week-contents"><div class="week-kicker">${icon('calendar',14)} ${weekRange(days)}</div><h2 id="week-heading">Week at a glance</h2><div class="week-strip" aria-label="Select a day">${days.map(d=>`<button data-date="${d}" class="week-day${d===date?' selected':''}${active.has(d)?' has-entries':''}" aria-pressed="${d===date}" aria-label="${fullDate(d)}${active.has(d)?', entries logged':''}"><span>${format(d,{weekday:'short'})}</span><strong>${local(d).getDate()}</strong></button>`).join('')}</div></div><div class="week-badge">${icon('activity',14)} ${active.size} of 7 days logged</div></section>`;
}
function quickCards() {
  return '<div class="quick-grid">'+Object.entries(kinds).map(([k,v])=>`<button class="quick-card ${k}" data-add="${k}"><span class="quick-top"><span class="kind-icon">${icon(v.icon,22)}</span><span class="quick-plus">${icon('plus',15)}</span></span><strong>${v.action}</strong><span class="quick-detail">${v.detail}</span></button>`).join('')+'</div>';
}
function summary(entry,u) {
  if(entry.type==='workout'){
    const ex=entry.exercises||[],sets=ex.reduce((a,x)=>a+(x.sets||[]).length,0);
    return [entry.title||'Workout', [quantity(ex.length,'exercise'),quantity(sets,'set'),entry.duration?entry.duration+' min':''].filter(Boolean).join(' · ')];
  }
  if(entry.type==='meal') return [entry.mealType||'Meal', [Math.round(entry.calories||0).toLocaleString()+' kcal',(entry.foods||[]).map(f=>f.name).join(', ')].filter(Boolean).join(' · ')];
  if(entry.type==='weight') return [weight(entry.kg,u)+' '+u,'Body weight'];
  return [entry.scripture||'SOAP reflection',entry.observation||entry.application||entry.prayer||'Scripture reflection'];
}
function entryRows(entries,u,showDate=false) {
  return '<div class="entry-list">'+entries.map(e=>{
    const kind=kinds[e.type], [title,detail]=summary(e,u);
    return `<button class="entry-row ${e.type}" data-edit="${safe(e.id)}"><span class="entry-icon">${icon(kind.icon,18)}</span><span class="entry-text"><strong>${safe(title)}</strong><small>${safe(detail)}</small></span>${showDate?`<span class="entry-date">${format(e.date,{month:'short',day:'numeric',year:'numeric'})}</span>`:''}<span class="row-arrow">${icon('chevronRight',16)}</span></button>`;
  }).join('')+'</div>';
}
function emptyLog(title,desc,iconName='journal'){
  return `<div class="empty-log"><span class="empty-emblem">${icon(iconName,25)}</span><strong>${safe(title)}</strong><p>${safe(desc)}</p></div>`;
}
function overview(ctx) {
  const {date,records,unit}=ctx, days=week(date);
  const dayEntries=records.filter(r=>r.date===date).sort(byNewest), w=records.filter(r=>days.includes(r.date));
  const weightLogs=w.filter(r=>r.type==='weight').sort(byNewest);
  const stats=[['workout','Workouts',w.filter(r=>r.type==='workout').length],['meal','Calories logged',Math.round(w.reduce((n,e)=>n+(e.type==='meal'?Number(e.calories||0):0),0)).toLocaleString()+' kcal'],['prayer','SOAP reflections',w.filter(e=>e.type==='prayer').length],['weight','Latest weigh-in',weightLogs.length?weight(weightLogs[0].kg,unit)+' '+unit:'—']];
  page.innerHTML=`<div class="page-heading"><div><h1>Daily overview</h1><p>${fullDate(date)}</p></div><div class="day-nav"><button data-date="${shift(date,-1)}" aria-label="Previous day">${icon('chevronLeft',16)}</button><button data-date="${key(new Date())}">Today</button><button data-date="${shift(date,1)}" aria-label="Next day">${icon('chevronRight',16)}</button></div></div>
  ${weekBanner(records,date)}
  <section class="quick-section"><h2 class="section-title">Quick log</h2>${quickCards()}</section>
  <div class="lower-grid"><section class="panel"><div class="panel-head"><h2>Daily log</h2><span class="count-chip">${dayEntries.length} ${dayEntries.length===1?'entry':'entries'}</span></div>${dayEntries.length?entryRows(dayEntries,unit):emptyLog('No entries for this day','Choose a quick log above to add your first entry.','journal')}</section>
  <section class="panel"><div class="panel-head"><h2>Weekly summary</h2><a class="text-link" href="#reports/${date}" aria-label="View weekly reports">Reports ${icon('arrowRight',14)}</a></div><div class="summary-rows">${stats.map(([k,label,value])=>`<div class="stat-row ${k}"><span class="stat-dot"></span><span>${label}</span><strong>${value}</strong></div>`).join('')}</div></section></div>`;
}
function historyView(ctx,type){
  const kind=kinds[type], rows=ctx.records.filter(e=>e.type===type).sort(byNewest);
  const descriptions={workout:'Your training sessions, exercises and sets.',meal:'Your meals, portions and estimated calories.',prayer:'Scripture, Observation, Application and Prayer.',weight:'Your weigh-ins over time.'};
  page.innerHTML=`<div class="page-heading"><div><h1>${kind.name}</h1><p>${descriptions[type]}</p></div><button class="primary-button" data-add="${type}">${icon('plus',16)} ${kind.action}</button></div><section class="panel history-panel"><div class="panel-head"><h2>History</h2><span class="count-chip">${rows.length} ${rows.length===1?'entry':'entries'}</span></div>${rows.length?entryRows(rows,ctx.unit,true):emptyLog('Your '+kind.singular+' history starts here','Use '+kind.action+' to record your first '+kind.singular+'.',kind.icon)}</section>`;
}
function editor(type,date,entry) {
  openEditor({type,date,unit:getUnit(),entry,records:getRecords(),onSave:async data=>{
    await saveRecord(data);
    const r=route();
    if(r.view==='overview'&&data.date!==r.date) navigate('overview',data.date);
    else render();
    toast(getSyncStatus().connected ? 'Saved · sync queued' : 'Saved on this device');
  },onDelete:async id=>{await deleteRecord(id);render();toast('Entry deleted');}});
}
function render() {
  const {view,date}=route();
  document.title='Daymark · '+views[view];
  document.querySelector('#current-location').textContent=views[view];
  rail();
  const ctx={records:getRecords().filter(e=>Object.hasOwn(kinds,e.type)),date,unit:getUnit(),icon,onDate:d=>navigate('overview',d),onAdd:(t,d)=>editor(t,d||date),onEdit:e=>editor(e.type,e.date,e)};
  if(view==='calendar')renderCalendar(page,ctx);
  else if(view==='reports')renderReports(page,ctx);
  else if(view==='overview')overview(ctx);
  else historyView(ctx,view);
  renderedData = dataStamp();
}
function dataStamp() {
  return [route().view,route().date,getUnit(),JSON.stringify(getRecords())].join('|');
}
let renderedData;
let toastTimer;
function toast(msg){const el=document.querySelector('#notice');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2400);}
const mobileLayout=matchMedia('(max-width:780px)');
function updateSidebar(){document.querySelector('#sidebar').inert=mobileLayout.matches&&!document.body.classList.contains('menu-open');}
mobileLayout.addEventListener('change',()=>{closeMenu();});
updateSidebar();
function closeMenu(){document.body.classList.remove('menu-open');document.querySelector('#scrim').hidden=true;document.querySelector('#mobile-open').setAttribute('aria-expanded','false');updateSidebar();}
function picker(){
  const dlg=document.createElement('dialog');
  dlg.className='pick-dialog'; dlg.setAttribute('aria-labelledby','pick-heading');
  dlg.innerHTML=`<div class="pick-head"><h2 id="pick-heading">Log an entry</h2><button class="icon-button" aria-label="Close" data-dismiss>${icon('close')}</button></div>${quickCards()}`;
  document.body.append(dlg);
  dlg.addEventListener('close',()=>dlg.remove(),{once:true});
  dlg.addEventListener('click',e=>{if(e.target.closest('[data-dismiss]')||e.target===dlg){dlg.close();return;}const btn=e.target.closest('[data-add]');if(btn){e.stopPropagation();dlg.close();editor(btn.dataset.add,route().date);}});
  dlg.showModal();
}
document.addEventListener('click',e=>{
  const btn=e.target.closest('button,a');if(!btn)return;
  if(btn.closest('#navigation,.brand'))closeMenu();
  if(btn.closest('dialog'))return;
  if(btn.dataset.date)navigate('overview',btn.dataset.date);
  if(btn.dataset.add)editor(btn.dataset.add,route().date);
  if(btn.dataset.edit){const r=getRecords().find(x=>x.id===btn.dataset.edit);if(r)editor(r.type,r.date,r);}
  if(btn.dataset.unit){setUnit(btn.dataset.unit);render();}
  switch(btn.dataset.action){
    case 'sync':closeMenu();openSync();break;
    case 'picker':picker();break;
    case 'menu':document.body.classList.add('menu-open');document.querySelector('#scrim').hidden=false;btn.setAttribute('aria-expanded','true');updateSidebar();document.querySelector('.mobile-close').focus();break;
    case 'close-menu':closeMenu();document.querySelector('#mobile-open').focus();break;
  }
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('menu-open')){closeMenu();document.querySelector('#mobile-open').focus();}});
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);});
window.addEventListener('tracker-change',()=>{if(renderedData!==dataStamp())render();else rail();});
document.querySelector('#workspace-icon').innerHTML=icon('panel',17);
document.querySelector('#storage-icon').innerHTML=icon('cloud',20);
document.querySelector('#storage-arrow').innerHTML=icon('chevronRight',15);
document.querySelector('#mobile-open').innerHTML=icon('menu');
document.querySelector('.mobile-close').innerHTML=icon('close');
document.querySelector('#global-log').innerHTML=icon('plus',17)+'Log entry';
render();
