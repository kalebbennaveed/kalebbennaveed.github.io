# Racing experiment results — 1% tolerance

470 executed episodes; 470 completed laps; 0 audit/runtime errors. 2,129,497 recorded states were independently replayed. Actual constraint violations and unavailable certificates are separate outcomes in the safety table.

## Protocol

- 100 IID true friction draws from Uniform[0.45,1.05], seed 20261007, paired across methods and risk tolerances. Each coefficient stays fixed for the whole episode.
- All methods use the same track, state, sensor, bicycle dynamics, actuator limits and sampled safety test. The racing target is 55 m/s, the centerline backup target 8 m/s.
- Horizon: 360 s or one lap; integration step 0.05 s. Grid and weight sweeps are separate from Monte Carlo inference.
- Quantized yaw acceleration has resolution 0.36 rad/s² and bounded error 0.18 rad/s². Passive runs SMID normally; it contracted its interval in 0/100 Monte Carlo episodes. No learning retains the prior.

## Sampled safety certificate

DRS-gatekeeper with beta=0: the nominal probabilistic special case, with no distribution-mismatch protection. The conditional friction law is explicitly assumed uniform over the current SMID interval. Uniformity is a modeling assumption, not a consequence of SMID containment.

Each candidate uses N=1000 IID friction samples, fixed within each rollout, and includes its backup continuation and terminal recovery check. The backup controller is assumed to keep the slow centerline terminal set robustly invariant (alpha=0). Epsilon=0.01; delta=0.05 per decision. A Bonferroni allocation delta/64 covers at most 64 independently sampled candidate checks, including informative and backup options. Accepted candidates complete all 1000 rollouts and satisfy the exact binomial upper bound <= epsilon. A partial batch can only reject, using the fixed-N failure threshold. No sampled pass is reported as all-parameter certification.

Fresh certification batches are separate from candidate generation. Sample seeds, evaluated counts, failures and upper bounds are saved. The 95% confidence and epsilon limit are per certification decision, not a whole-lap probability guarantee. Repeated replanning is assessed by independent closed-loop experiments. The plant is a discrete model with fixed friction and exact controller states; no physical-vehicle or continuous-time guarantee is asserted.

## Statistical interpretation

One-sided 95% Clopper–Pearson bounds use independent episodes per method, never frames or pooled paired controllers. Observed constraint violations, unavailable certificates and unresolved errors count in the conservative unsafe-or-unresolved endpoint. Zero failures in 100 episodes gives 2.9513%; this empirical bound is distinct from epsilon. It cannot validate a 1% whole-lap failure claim with only 100 episodes.

Lap time and lap cost include completed laps only; completion counts accompany them. Partial failed runs retain their distance, time, cost and failure state in the records. Paired mean differences use 5000 bootstrap resamples of whole paired trials; friction subgroups are descriptive. SMID intervals are bounded-error consistency sets, not confidence intervals.

## Comparators and scope

The finite policy library compares aggressive racing with slow backup; there is no intermediate acceleration-limited racing planner. Weighted information uses a persistent regressor-excitation reward, not an information reward that vanishes after identification. The representative proposed exploration budget is not exhausted. These are explicit comparator choices, not general dominance claims.

## Files

Figures: vector PDF, SVG and PNG. Tables: CSV and booktabs LaTeX fragments. `all_episodes.csv` includes all outcomes. `records/*.json.gz` stores full states, observations and certification decisions; `runs/*.json` stores metrics and audits. `manifest.json` fixes the cases and numerical source hash. `paper-results.zip` contains the shareable figures, tables and protocol; raw records remain local.

Runtime is simulation throughput under 2 workers, excluding initial certification and post-run audit, not an isolated planner deadline.

## Reproduce

```bash
uv sync --extra dev
uv run --locked drs-racing experiments --scenario traction --trials 100 --seed 20261007 --seconds 360 --workers 2 --output sampled-risk-01
uv run --locked drs-racing report --input sampled-risk-01
```

Reference: [DRS gatekeeper, Algorithm 1](https://arxiv.org/html/2605.12974v3). The only change to the multiple-candidate confidence allocation is conservative Bonferroni in place of the paper's independence-based Sidak correction.
