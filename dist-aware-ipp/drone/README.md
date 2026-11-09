# Scenario 1 recorded-flight visualization

This is a rendering-only companion to the existing `dist-aware-ipp` demo. It does not run a planner, learn a belief, integrate robot dynamics, or solve airflow.

- `environment.json` is an unchanged copy of `../data/environment-s1.json`.
- `scenario.json` is the unchanged Scenario 1 object from `../data/manifest.json`.
- `recordings.js` loads the original DAW1 recordings from immutable data revision `261948aefe452de1d47065e0df5b28a667269008`.
- Recorded planar coordinates map to `(6*x, 4.2, -6*y)`. The altitude and architectural scale are visual choices, not a new physical experiment. Position is linearly interpolated between saved samples. The trail uses saved segments without curve fitting.
- Architecture is an illustrative interpretation of the obstacle envelopes. A red outline at a recorded contact displays the corresponding original obstacle envelope. New geometry is never used to infer collision outcomes.
- Wind tracers use bilinear interpolation of the saved, time-independent horizontal CFD field. Their animation time is slowed by 0.10 for readability; the wind readout stays in original m/s. The new visual architecture has not undergone a new CFD solve.
- Only Baseline 4 and Proposed have an initial learning stage. Their Stage 2 handoffs are 240 s and 180 s respectively. Stage labels use these saved times.
- Original GIFs, numerical recordings, simulation sections, figures, and slides remain unchanged.

## Verification, 2026-11-09

Verified JavaScript parsing; all five original recording lengths and finite samples; byte-identical environment; all five UI method selections and end states; exact 180/240 s jumps; recorded contact stopping for Baselines 1/4; camera controls and clarity overlay; no browser console errors. Visual assets are bundled with provenance and license notices under `licenses/`.
