# Recorded-flight visualizations · Scenarios 1–4

This is a rendering-only companion to the existing `dist-aware-ipp` demo. It does not run a planner, learn a belief, integrate robot dynamics, or solve airflow.

- `environment.json` is an unchanged copy of `../data/environment-s1.json`; `environment-s2.json` through `environment-s4.json` are byte-identical copies of the corresponding environments.
- `scenario.json` is the unchanged Scenario 1 object from `../data/manifest.json`. `scenario-s2.json` through `scenario-s4.json` contain the other unchanged scenario objects.
- `recordings.js` loads the original DAW1 recordings from immutable data revision `261948aefe452de1d47065e0df5b28a667269008`.
- Recorded planar coordinates map to `(6*x, 4.2, -6*y)`. The altitude and architectural scale are visual choices, not a new physical experiment. Position is linearly interpolated between saved samples. The trail uses saved segments without curve fitting.
- Architecture is an illustrative interpretation of the obstacle envelopes. A red outline at a recorded contact displays the corresponding original obstacle envelope. New geometry is never used to infer collision outcomes.
- Wind tracers use bilinear interpolation of the saved, time-independent horizontal CFD field. Their animation time is slowed by 0.10 for readability; the wind readout stays in original m/s. The new visual architecture has not undergone a new CFD solve.
- Only Baseline 4 and Proposed have an initial learning stage. Their Stage 2 handoffs, in seconds (Baseline 4 / Proposed), are S1: 240 / 180; S2: 370 / 200; S3: 214 / 102; S4: 244 / 124. Labels and seeking use the saved values.
- Original GIFs, numerical recordings, simulation sections, figures, and slides remain unchanged.
- `?scenario=1` (default) and `?scenario=2` render the shared industrial courtyard; Scenario 3 renders a glazed pavilion within the calm upper monitoring plaza; Scenario 4 renders workshops and tanks distributed across a utility campus. All use the original obstacle centers and envelopes. The demo retains its original scenario numbering.
- Added viewers load only when near the viewport; rendering pauses while offscreen or while the document is hidden. No extra simulation data is generated.

## Verification, 2026-11-09

Verified JavaScript parsing; all five original recording lengths and finite samples; byte-identical environment; all five UI method selections and end states; exact 180/240 s jumps; recorded contact stopping for Baselines 1/4; camera controls and clarity overlay; no browser console errors. Visual assets are bundled with provenance and license notices under `licenses/`.

## Verification, 2026-11-10

Checked copied environments and manifest entries against the original data, finite recording samples, all five method end states in each added scenario, recorded contacts, stage transitions, camera controls, clarity overlay and JavaScript parsing. The project-page introduction reuses the approved five-panel SVG and animates its paths; it does not alter the algorithm or recorded experiments.
