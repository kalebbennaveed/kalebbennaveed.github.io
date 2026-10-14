# Safety stress results

2,800 executed episodes; 46 tire-force constraint violations.

Initial μ ∼ Uniform[0.76, 1.05]. Launch and full-lap cohorts are independent. Failures are infeasible committed tire-force requests, not simulated collisions. The online 1% / 5% tolerance applies per certification decision, not per lap.

| Cohort | Tolerance | Method | Trials | Violations | Observed rate | 95% interval |
|---|---:|---|---:|---:|---:|---:|
| launch | 1% | Proposed | 1000 | 0 | 0.00% | [0.00, 0.37]% |
| launch | 5% | Proposed | 1000 | 24 | 2.40% | [1.54, 3.55]% |
| lap | 1% | Proposed | 100 | 0 | 0.00% | [0.00, 3.62]% |
| lap | 1% | Passive | 100 | 0 | 0.00% | [0.00, 3.62]% |
| lap | 1% | Weighted information | 100 | 0 | 0.00% | [0.00, 3.62]% |
| lap | 1% | No learning | 100 | 0 | 0.00% | [0.00, 3.62]% |
| lap | 5% | Proposed | 100 | 6 | 6.00% | [2.23, 12.60]% |
| lap | 5% | Passive | 100 | 8 | 8.00% | [3.52, 15.16]% |
| lap | 5% | Weighted information | 100 | 0 | 0.00% | [0.00, 3.62]% |
| lap | 5% | No learning | 100 | 8 | 8.00% | [3.52, 15.16]% |

[Protocol](README.md) · [Every episode](tables/all_episodes.csv) · [Every failure](tables/executed_failures.csv) · [Certificate rechecks](tables/failed_policy_rechecks.csv)

## Figures

Each figure is available as PDF, SVG and PNG.

- [01 executed failure rates](figures/01_executed_failure_rates.pdf)
- [02 failures vs true friction](figures/02_failures_vs_true_friction.pdf)
- [03 accepted nonzero risk](figures/03_accepted_nonzero_risk.pdf)
- [04 time to violation](figures/04_time_to_violation.pdf)
- [05 matched failure trace](figures/05_matched_failure_trace.pdf)
- [06 failure after driving](figures/06_failure_after_driving.pdf)
- [07 full lap failure](figures/07_full_lap_failure.pdf)

## Tables and records

The `tables/` directory contains CSV data and LaTeX tables. The archive includes figures, tables, representative trajectories, the frozen manifest, and source snapshots. All raw episode records and individual audits remain in `../records/` and `../runs/`; they are not duplicated in this compact archive.

These results are local files and are not included in the website demo.
