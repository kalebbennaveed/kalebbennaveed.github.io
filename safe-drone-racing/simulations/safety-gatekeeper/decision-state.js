// Verification and commitment are different facts. Keep that distinction in
// every label, including startup and retained commitments.
export function candidateDecision(epoch,index){
  const candidate=epoch.candidates[index];
  if(!candidate)return null;
  const selected=epoch.selection?.index===index;
  const passed=Boolean(candidate.verification.accepted);
  if(selected)return {kind:'committed',label:'Committed',detail:passed?'Full tube passed the checks':'Startup assumption; check did not pass'};
  if(passed)return {kind:'passed',label:'Not committed',detail:'Checks passed; another candidate was selected'};
  const reason=candidate.rejection?.reason||candidate.verification.reason;
  if(reason==='reachable_tube_boundary')return {kind:'collision',label:'Rejected',detail:'Collision clearance not established'};
  return {kind:'unbounded',label:'Rejected',detail:'Complete tube not established'};
}

export function activeCommitment(epoch,time){
  const c=epoch.commitment;
  if(!c)return {label:'No committed trajectory',detail:'The drone has no trajectory to execute.'};
  const switchAt=c.start_time+c.switch_seconds;
  const phase=time+1e-9<switchAt?'Racing segment':'Backup segment';
  return {label:`Commitment ${c.id+1} · ${phase}`,detail:`Committed at ${c.start_time.toFixed(2)} s${c.retained?'; retained this update':''} · switch to backup at ${switchAt.toFixed(2)} s · checked through ${c.verification_end_time.toFixed(2)} s`};
}
