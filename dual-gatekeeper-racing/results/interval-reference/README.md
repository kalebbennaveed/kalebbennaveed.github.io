# Racing experiment results

470 executed episodes: 100 IID friction draws × four methods, plus a deterministic friction grid and fixed-weight sensitivity runs. 470 laps completed; 0 runs reported errors. Every returned record is independently replayed and audited. 2,129,497 recorded states were checked.

## Experiment design

The Monte Carlo test draws one fixed true tire coefficient per trial from Uniform[0.45, 1.05], seed 20261007. All methods receive the same true coefficient and initial state. Initial support is [0.45, 1.05]; controller and estimator never receive truth. The sensor is deterministic quantized yaw acceleration, so changing only its seed would not create independent experiments. Grid and weight-sweep runs are excluded from binomial confidence intervals. Horizon is 360 s or one completed lap; lap time resolution is 0.05 s.

Passive runs the same SMID update at every step, with no information-seeking candidates. In the Monte Carlo batch, 0/100 passive episodes reduced the interval by more than 1e-8. This is a result of this sensor/controller/scenario, not a rule suppressing passive learning. No learning deliberately retains its initial interval.

The candidate library compares aggressive racing (55 m/s straight-line target, curvature-limited in turns) with the 8 m/s backup; it does not supply an intermediate acceleration-limited racing planner. Weighted uses a persistent regressor-excitation reward, not a posterior-aware reward that vanishes after identification. These explicit choices affect the comparison. A richer conservative planner or another information objective can change the ranking. The proposed exploration budget is not exhausted in the representative μ=0.85 case, so that example does not demonstrate a binding-budget advantage.

## Interpreting safety and SMID

This code specializes DRS to a Wasserstein-infinity ball around a point measure that contains every distribution on the current bounded interval. It checks the entire support, with zero allowed worst-case finite-horizon failure probability. It is not the paper's general sampling-based acceptance algorithm. The implementation uses float64 interval calculations with numerical padding, not an externally verified arithmetic proof. Monte Carlo validates the implementation under the declared test distribution; it does not establish distribution-free safety or backup-set invariance.

SMID must retain truth if the initial set contains the constant true parameter, the affine model is correct, and each observation error lies inside its declared bound. Each measurement strip then contains truth, so their intersection does too. The audit checks every observation, nested interval, truth containment (1e-9 numerical tolerance), executed control, tire constraint, footprint clearance, cost, exploration budget and certificate coverage. No estimator receives μtrue or widens an inconsistent interval. Inconsistency stops the run.

For k failures among n independent episodes, the one-sided 95% Clopper–Pearson upper bound is BetaQuantile(0.95; k+1,n−k), or 1 if k=n. With zero failures it is 1−0.05^(1/n): 2.9513% at n=100 and 0.2991% at n=1000. Bounds are per method, not simultaneous, and are conditional on this sampling distribution and model. Correlated time steps and the four paired methods are never counted as independent trials. Unresolved errors are conservatively counted as failures for the upper bound. Safety and task completion are separate outcomes.

## Tables and figures

Open `index.html` for the figure gallery. Every figure is available as vector PDF, editable SVG and 190-dpi PNG. `tables/*.tex` are booktabs fragments for inclusion in a paper (the full friction grid also uses longtable); `tables/*.csv` retain the numerical data. `all_episodes.csv` contains every case, including errors. Summary means and standard deviations use episodes, not frames. Lap metrics include completed laps only; completion denominators are in the safety table. Time-to-learning summaries use only threshold crossings; their n column reports how many crossed. Paired intervals use 5,000 percentile bootstrap resamples of whole paired trials. Subgroups split at μ=0.75 are descriptive, not independent confirmatory tests. No multiplicity correction or significance claim is made.

Candidate-rejection counts in the raw records cover logged mission attempts for proposed/passive/no learning and all ranked checked attempts for weighted. They are not matched candidate-acceptance rates; unlogged rejected informative probes cannot be recovered from these records.

Runtime is warm-cache simulation wall time under 4 concurrent workers, excluding initial certification and independent auditing. Do not describe it as a measured isolated planner deadline.

Raw complete records, observations and candidate decisions are in `records/*.json.gz`; per-run metrics and audits are in `runs/`. `manifest.json` fixes all cases, package versions and the numerical source SHA-256. The raw directories are ignored by Git because of their size; retain them with the experiment archive.

## Reproduce

```bash
uv sync --extra dev
uv run --locked drs-racing experiments --trials 100 --seed 20261007 --seconds 360 --workers 4 --output results/paper
MPLCONFIGDIR=/tmp/drs-mpl-cache uv run --locked drs-racing report --input results/paper
```

The runner resumes identical cached cases and refuses to mix changed numerical sources or experiment designs. Use a new output directory for another trial count. For 1,000 trials, set `--trials 1000 --output results/paper-1000`; this executes 4,000 Monte Carlo episodes plus the same grid/sensitivity studies. No retry silently replaces a failed result.

References: [DRS paper](https://arxiv.org/html/2605.12974v3), [NIST exact binomial limits](https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/exacbino.htm), and the model specification in the repository's `docs/method.md` (copied as `method.md` here when available).
