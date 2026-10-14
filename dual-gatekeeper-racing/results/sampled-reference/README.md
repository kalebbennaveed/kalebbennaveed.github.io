# Sampled DRS racing results

Two matched scenarios: epsilon=0.01 and epsilon=0.05, N=1000 samples per candidate, delta=0.05 per decision, beta=0, alpha=0 (assumed invariant backup). 940 executed episodes; 100 independent paired Monte Carlo trials per method per scenario. The physical track, plant, sensor and candidate objectives are identical.

The 5% case permits a higher candidate failure probability. It need not change a trajectory when both thresholds accept the same candidates. Identical outcomes and all failures are retained. No result is forced to show an improvement. The primary demonstration remains informative exploration versus passive and no-learning baselines.

The conditional friction law is assumed uniform on the SMID interval. This is the nominal probabilistic special case of DRS. Its per-decision safety/confidence parameters are not whole-lap probability claims. Completed-lap statistics and empirical failure bounds are separate.

Each scenario directory contains its full plots, CSV and LaTeX tables, manifest, and protocol. Raw records remain in the original results directories. The ZIP contains shareable reports, not the large raw trajectories. Old interval-verifier results are not mixed into this study.
