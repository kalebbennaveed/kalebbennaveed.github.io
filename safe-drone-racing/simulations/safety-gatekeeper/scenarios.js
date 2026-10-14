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
    observe: 'Compare speed, tracking error and minimum clearance with Scenarios 1 and 2. Completing this recording without a collision does not guarantee that another flight will do so.',
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
  return scenario;
}
