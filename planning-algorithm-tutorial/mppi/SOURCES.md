# Sources and implementation choices

The mathematical sources are the three user-provided PDFs in `Tutorials/MPPI`:

- `1509.01149v3.pdf`: Williams, Aldrich, and Theodorou, arXiv v3, 28 October 2015. Sections II–IV.
- `williams-et-al-2017-model-predictive-path-integral-control-from-theory-to-parallel-computation.pdf`: Williams, Aldrich, and Theodorou, 2017, DOI 10.2514/1.G001921. Sections II, III, and V.
- `2112.09988v8.pdf`: Kim et al., journal publication 2022, supplied arXiv revision dated 13 October 2025. Section II, Eqs. (1)–(10); Section III, Eqs. (11)–(18), Algorithm 1; Section IV, Eq. (19).

No PDF is redistributed in the project. The notes contain original explanations, derivations in consistent notation, and links to the publications.

## Code references inspected

The workspace repository corresponding to the user's DRS/gatekeeper reference is:

- [`dual_gtk_drs_racing/dual_gtk_drs_racing/mppi.py`](https://github.com/kalebbennaveed/dual_gtk_drs_racing/blob/243b188f5077200fc5fe04c8f29b187092a9b662/dual_gtk_drs_racing/mppi.py), revision `243b188f5077200fc5fe04c8f29b187092a9b662`. It uses NumPy/Numba, projected correlated Gaussian samples, exponential weights, warm starts, and incumbent/best-sample retention. Its own header points to the earlier JAX `build_mppi` / `mppi_update` code.
- The earlier local reference is `Dual-gatekeeper/dual-gtk-car-racing/colcon_ws/src/dual_gatekeeper/dual_gatekeeper/mppi.py`, revision `165ee4cb0fa649d674f9ccd7778d4bd9fa14eecf`, functions `build_mppi`, `rollout_cost`, and `mppi_update`. It uses `lax.scan` for sequential state propagation, `vmap` over rollouts, and `jit` for compilation, with clipped action samples and exponential weighting.

This implementation is written as a small standalone teaching package. It uses the scan/vmap/jit organization from those references while deriving the score and mean update from the papers. Neither reference's state-cost-only weighting rule is presented as the full Gaussian likelihood-ratio update.

## Explicit differences and scope

- Independent Gaussian input perturbations; diagonal reference covariance.
- The cross term and the proposal covariance correction are retained. Batch-constant terms are omitted only after showing why normalized weights cancel them.
- Actuator clipping is part of the physical action map. Gaussian density ratios and mean updates use raw coordinates.
- No correlated-noise filter, incumbent acceptance, best-sample fallback, racing cost, learned dynamics, friction estimator, or gatekeeper safety certificate.
- SMPPI stores both a derivative-coordinate mean and a physical control sequence (written as D-bar and U-bar in the tutorial). It uses the iteration-indexed action update in the supplied v8 paper, not a time-axis cumulative sum. Candidate action clipping is evaluated in the rollout and smoothness cost. The covariance-scaled extension and derivative-noise defaults are explicit teaching choices.
- Dynamics and their coordinate conventions follow the double integrator, unicycle, and pendulum in Kaleb Notes. All numerical navigation costs, terminal weights, scenarios, success criteria, and validation runs are tutorial-specific.
- CPU-only recorded results are not reproductions of the papers' reported experiments or hardware benchmarks.

The package is covered by the parent repository's MIT license, also included in source downloads.
