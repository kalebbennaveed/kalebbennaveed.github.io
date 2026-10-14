const scenarios = {
  1: {
    number: 1, label: 'Scenario 1 · With Gatekeeper, unknown dynamics',
    title: 'With Gatekeeper and unknown dynamics', gatekeeper: true,
    dynamics: 'Extra air resistance and acceleration bias',
    description: 'The simulated drone has extra air resistance and a constant acceleration bias that the base model does not include. Model learning and neural-controller training continue during flight. Gatekeeper checks each proposed trajectory; if it rejects a proposal, the drone continues along its previously accepted trajectory and moving backup.',
    observe: 'Watch how rejected proposals affect speed and the distance to the gates. Compare with Scenario 3, which uses the same simulated drone without Gatekeeper.',
    limitation: 'The checks approximate how model error spreads along a trajectory. They have not established a mathematical safety guarantee. The page marks where the recorded position bounds end.'
  },
  2: {
    number: 2, label: 'Scenario 2 · Without Gatekeeper, matching dynamics',
    title: 'Without Gatekeeper, with matching dynamics', gatekeeper: false,
    dynamics: 'Simulator matches the base model',
    description: 'The ground-truth simulator uses the same dynamics equations and parameters as the base model, with no extra drag or acceleration bias. MPPI plans the racing trajectory, and the neural controller follows it without Gatekeeper checking or rejecting proposals. Model learning and controller adaptation remain enabled.',
    observe: 'Use this as the comparison with Scenario 3: what changes when the simulator includes forces that the base model does not?',
    limitation: 'Gatekeeper is off. Model-error bounds are displayed for inspection, but they do not restrict the flight.'
  },
  3: {
    number: 3, label: 'Scenario 3 · Without Gatekeeper, unknown dynamics',
    title: 'Without Gatekeeper, with unknown dynamics', gatekeeper: false,
    dynamics: 'Same extra forces as Scenario 1',
    description: 'The simulated drone has the same extra air resistance and acceleration bias as Scenario 1. MPPI plans the racing trajectory, and the neural controller follows it directly. Model learning and controller adaptation remain enabled, but Gatekeeper does not check or reject the trajectory.',
    observe: 'Compare this flight with Scenario 1 to see the effect of Gatekeeper under the same unknown forces, and with Scenario 2 to see the effect of those forces without Gatekeeper.',
    limitation: 'Gatekeeper is off. Model-error bounds are displayed for inspection, but they do not restrict the flight.'
  }
};
export function scenarioFor(record) {
  const enabled=record.gatekeeper_enabled??!['unfiltered','nominal'].includes(record.mode);
  return scenarios[enabled?1:record.plant_mode==='base'?2:3];
}
export function describeScenario(record) {
  const scenario=scenarioFor(record), $=id=>document.getElementById(id);
  $('scenario-number').textContent=`SCENARIO ${scenario.number}`;
  $('scenario-title').textContent=scenario.title;
  $('scenario-description').textContent=scenario.description;
  $('scenario-observe').textContent=scenario.observe;
  $('scenario-checks').textContent=`Gatekeeper ${scenario.gatekeeper?'on':'off'}`;
  $('scenario-dynamics').textContent=scenario.dynamics;
  $('scenario-course').textContent=record.track.name||'Oval course';
  const course=record.track.parameters;
  $('scenario-course-note').textContent=course?.radial_modulation?`${course.gate_count} gates with ${course.gate_width.toFixed(1)} × ${course.gate_height.toFixed(1)} m openings. Alternating sharper and gentler turns, with gate centers between ${(course.height-course.elevation).toFixed(2)} and ${(course.height+course.elevation).toFixed(2)} m high. The same course is used in all three scenarios.`:'';
  if(course?.radial_modulation&&record.planner_settings)$('scenario-course-note').textContent+=` Faster MPCC setting: progress weight ${record.planner_settings.progress}, contouring-error weight ${record.planner_settings.contour}. This rewards more progress and penalizes distance from the course centerline less than the previous setting. All three scenarios use these weights.`;
  if(record.track.layout==='stacked')$('scenario-course-note').textContent=`Seven ${course.gate_width.toFixed(1)} × ${course.gate_height.toFixed(1)} m gates, with at least 6.4 m between non-stacked gate centers. Gates 4 and 5 form the left-hand stacked pair at 4.80 and 1.90 m. Gate 2 is on the right; Gates 3 and 6 are toward the front; Gates 1 and 7 are farther back. A short descending turn connects the stacked gates. The course follows a smooth curve through these explicit locations and connecting turns, reconstructed from the reference image. The simulator, planner and Gatekeeper use the same geometry. MPCC progress weight ${record.planner_settings.progress}; contouring-error weight ${record.planner_settings.contour}. All three scenarios use the same settings.`;
  const outcome=record.outcome;
  $('scenario-outcome').textContent=outcome?`${outcome.label} · ${outcome.time.toFixed(2)} s${outcome.kind==='completed'?` · ${record.metrics.gates_passed} gates passed`:''}`:'';
  $('scenario-outcome').classList.toggle('contact',outcome?.kind==='gate_contact');
  $('jump-outcome').hidden=outcome?.kind!=='gate_contact';
  $('jump-outcome').textContent=outcome?.kind==='gate_contact'?`Show collision at ${outcome.time.toFixed(2)} s`:'Show collision';
  return scenario;
}
