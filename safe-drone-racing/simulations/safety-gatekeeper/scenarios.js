export const scenarios = {
  "baseline-1": {
    number: 1,
    label: "Baseline 1",
    subtitle: "Matching dynamics · no Gatekeeper",
    description:
      "MPPI plans desired velocities and the neural controller applies thrust and torque. The ground-truth simulator and prediction model use the same base dynamics, with no residual acceleration. Gatekeeper and reachable-set calculation are disabled.",
    observe:
      "This isolates the performance of MPPI and the neural controller when the dynamics model matches the simulated drone.",
  },
  "baseline-2": {
    number: 2,
    label: "Baseline 2",
    subtitle: "Model mismatch · no Gatekeeper",
    description:
      "The simulated drone has additional velocity-dependent acceleration. The prediction model uses a learned approximation of that acceleration. MPPI and the neural controller execute directly, with no Gatekeeper or reachable-set calculation.",
    observe:
      "Compare with Method 1: the ground-truth dynamics, learned residual, neural controller and planner settings are identical. Only Gatekeeper is added in Method 1.",
  },
  "method-1": {
    number: 3,
    label: "Method 1",
    subtitle: "Model mismatch · DiffReach + Gatekeeper",
    description:
      "The same MPPI planner proposes a racing reference. Six candidates switch from that reference to a course-following backup at different times. DiffReach propagates the same neural feedback controller, using the learned-residual error bound. Gatekeeper commits a candidate only when the complete tube passes the checks, except for the stated initial backup assumption.",
    observe:
      "Select a switching time to inspect its full recorded tube and decision. Purple shows established position sets. Red locates the first failed check; a rejected candidate is never labeled as a collision.",
  },
};
export function scenarioFor(record) {
  return scenarios[record.variant];
}
