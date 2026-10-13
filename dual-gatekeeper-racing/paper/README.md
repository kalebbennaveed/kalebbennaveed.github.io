# Local MPPI racing results

The current implementation optimizes physical control sequences locally. The old finite policy library is not used in these records.

The reference demonstrations use true friction 0.85 and seed 7. Both candidate tolerances (1% and 5%) include one proposed method with a fixed gamma=2 informative generation objective; weighted-baseline gamma 0, 0.1, 0.4, 2; passive and no learning. These are paired demonstrations and sensitivity analyses, not independent safety trials.

Paired validation uses 8 prespecified IID friction draws, shared across four methods and two tolerances. The weighted baseline uses gamma=0.4 in this study. All 64 outcomes are in all_validation_episodes.csv; failed or incomplete episodes are not counted as completed laps. Paired time/cost differences use completed pairs with their denominator shown. A positive difference favors proposed. Small samples cannot establish the online tolerance as a whole-lap bound.

The original DRS margins, terminal recovery set, binomial upper bound, sample count and confidence allocation are retained. beta=0, alpha=0; uniform conditional friction and invariant fallback are assumptions. Explicit-input policy rollouts are shared with execution and independently audited.

CSV tables, PDF/SVG/PNG figures and experiment manifests accompany this report. Full raw records, implementation snapshots and reproduction scripts are retained in the implementation repository. Proposed uses two MPPI optimizations per decision; each baseline uses one. Solve times are simulation measurements, not real-time guarantees.
