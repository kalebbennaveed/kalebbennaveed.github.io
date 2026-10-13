# Local MPPI with dual selection and sampled DRS

## Plant and controls

The discrete seven-state bicycle model is `[s, e_y, e_psi, v_x, v_y, yaw_rate, steering]`, with explicit Euler at 0.05 s and a fixed uncertain tire coefficient μ. Physical controls are drive force, negative brake force and steering rate. The physical step is in `dynamics.py`; it accepts controls directly. Its equations, parameters, tire-force margins and integration step match the prior plant. The old `model.py` expression graph remains a regression reference and supports historical records/the original safety checker.

A fixed error-feedback law tracks an optimized state/input sequence. It is zero on the nominal trajectory and is identical in candidate verification and execution. After the prefix, the original 8 m/s centerline controller runs. A rejected replacement preserves the exact existing controls, reference states, start time and switch time. No controller receives true μ; truth is confined to the simulator, observation generation and offline audits.

## MPPI

`mppi.py` contains the local optimizer. It has no runtime imports from uncertain-racecar-gym or the ROS racing repo. The supplied car-racing `build_mppi` was the algorithm reference: perturb control sequences, roll out each, compute exponential weights, and average bounded controls. The implementation retains the best incumbent/sample when finite-sample averaging is worse; this safeguard is explicit. It optimizes continuous signed force and steering-rate coordinates and converts signed force into separate drive/brake inputs, excluding simultaneous drive and brake.

Default settings: 60 steps (3 s), 384 samples, four updates, temperature 0.35, force-noise scale 500 N, steering-rate-noise scale 0.055 rad/s, temporal noise correlation 0.8. Control increments in the planner are limited to 150 N and 0.12 rad/s per step for numerical smoothness. Physical actuator limits remain drive 0–2880 N, brake −5040–0 N, steering rate ±0.65 rad/s. Feedback can adjust the planned increment but is always physically bounded and is included in certification.

The warm start uses a centerline controller with curvature preview. This is an initialization of the whole control sequence; MPPI perturbs and optimizes every sequence element. It does not choose from a library of reference excursions. A shifted previous plan is also considered. Nominal and informative planners use separate deterministic random streams.

## Objectives

The common mission running cost is

`ell(x,u) = 1 + 0.004(55-v_x)^2 + 0.08 e_y^2 + 0.2 e_psi^2 + 0.002((F_drive+F_brake)/720)^2 + 0.08 steering_rate^2`.

The target is 24 m/s for the optional Barcelona reference scenario. Terminal mission cost is zero. Nominal MPPI minimizes the integrated running cost. Informative/weighted MPPI minimizes the same cost minus `gamma log(epsilon_reg + I)`, where `I = sum(dt * phi_yaw^2 / 0.18^2)` for the scalar-friction quantized-yaw case, and epsilon_reg = 1. For the optional three-channel sensor, the three squared noise-scaled regressors are summed. This is the scalar form of paper (21–22). Proposed fixes gamma at 2 to generate a strongly informative candidate; it is not a tunable tradeoff in the proposed method. The public weight argument applies only to the weighted baseline. Safety, exploration budget, and discounted predicted SMID contraction determine whether proposed executes its informative candidate.

Nominal state constraints reject invalid rollouts. Tire infeasibility at the parameter estimate is penalized in optimization; a finite-iteration MPPI output is never treated as certified merely because it has low cost. DRS tests the actual candidate independently. Mission cost reported in tables and used for the exploration charge excludes information reward and constraint penalties.

## Candidate policies and selection

Both optimized plans start at the current state and use the current interval center. Candidate durations are 0.3, 0.6, 1.2, 1.8, 2.4 and 3.0 s, obtained by taking prefixes of those plans, each followed by fallback. Candidates are regenerated on the common 0.5 s schedule or at prefix expiry. Paid proposed informative prefixes run to completion; nominal and weighted commitments may be replaced earlier by a newly certified policy.

Proposed checks both members of each nominal/informative pair using the current uncertainty. Its exploration charge is `max(0, J_info_prefix - J_nominal_prefix)`. The accumulated charge plus the new charge must not exceed 8. A free informative prefix is eligible even if the remaining budget is zero. Among eligible pairs, select the greatest `exp(-0.5 T) * predicted_width_reduction`. The score uses the informative candidate's own contraction, as in paper (12–13), not its contraction minus nominal contraction. A numerical threshold of 1e-6 ignores zero-resolution gains. The full charge is reserved on commitment.

If no informative candidate qualifies, choose the longest certified nominal prefix. If no new prefix passes, retain the previous certified policy and fallback continuation. This nominal fallback selection is the racing gatekeeper instantiation; informative pairs never use an uncertified nominal comparator.

## SMID

Executed observations obey `y = phi mu + eta`, `|eta| <= w`. Each update intersects the current interval with all measurement-consistency strips. Quantized yaw acceleration has resolution 0.36 rad/s², with error bounded by 0.18 rad/s². Actual bounds change only from executed data. Predicted contraction simulates this quantizer and strip intersection at the current interval center on a copy of the interval. It is a point-estimate forecast, not a guaranteed future reduction and not a replacement for actual measurements.

## DRS preserved

The statistical test and constraints in `safety.py` are unchanged. `control_safety.py` supplies explicit control-policy rollouts using those same functions. Every candidate gets 1,000 IID friction samples from the current interval, one constant friction per rollout. Fresh certification streams are separate from MPPI and the initial fallback check. Conditional uniform friction is assumed; SMID containment does not imply uniformity.

The failure event includes footprint containment (`5.7 - abs(e_y)`), heading ±0.65 rad, speed [2,65] m/s, steering ±0.32 rad, regular Frenet coordinates, both tire-force constraints when enabled, and terminal recovery membership. Recovery requires |e_y|≤1.5 m, |e_psi|≤0.12 rad, |v_x−8|≤1.2 m/s, |v_y|≤1 m/s, and |r−8 κ(s)|≤0.20 rad/s. Fallback-set invariance is assumed (alpha=0).

The exact one-sided Clopper–Pearson upper bound is `Beta.isf(0.05/64, failures+1, 1000-failures)`, or one for all failures. Accept only a completed batch with upper bound ≤ 0.01 or 0.05. Fixed-N failure thresholds allow early rejection only. At most 64 checks are allowed per decision. Identical policies can reuse their certificate only at the identical state, support and decision. Input clipping is part of the policy and is identical in verification and execution.

This is beta=0, the nominal probabilistic specialization, without distribution-mismatch protection. It is a per-decision finite-sample certificate, not a whole-lap guarantee or an invariance proof. At finite certificate expiry, fallback continuation is rechecked; an unavailable certificate terminates the run and remains in results.

## Comparisons and reporting

No learning uses mission-only MPPI and freezes its interval. Passive uses the same mission-only MPPI with active SMID. Weighted uses one mission-information MPPI plan, selecting its longest certified prefix without a contraction gate or budget. Proposed uses separate nominal/informative plans, paired certification, budget and discounted contraction selection. Gamma=0 weighted must reproduce passive. All methods use the same plant, sensor, safety thresholds, per-optimizer sampling settings and paired initial conditions. Proposed performs two MPPI optimizations per decision; each baseline performs one. This comparison does not impose an equal total planning-compute budget, and recorded solve times are simulation measurements rather than a real-time deadline guarantee.

Weight demonstrations include gamma 0, 0.1, 0.4, 2 for the weighted baseline only. Proposed is one fixed method with gamma=2 for informative candidate generation. Every outcome is displayed; settings that lose are retained. Fresh paired validation uses a separate prespecified friction RNG. Completed-lap metrics show completion denominators. Physical failures, unavailable certificates and runtime/audit errors are distinct. Small validation samples do not establish low whole-lap risk.

Each schema-3 record stores the numerical source hash, optimizer settings, all measurements, actual controls, optimized paths, prefix policies, accepted/rejected certificates and reserved budget. Replay audits reconstruct every applied control and plant step, regenerate sensor observations, check SMID containment, costs, certificate arithmetic, pairing and budget. Historical schema-2 results use the old behavior library and are not MPPI evidence.
