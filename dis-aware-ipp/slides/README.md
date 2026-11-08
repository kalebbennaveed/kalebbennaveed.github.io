# Updated manuscript presentation

Public entry point: https://kalebbennaveed.github.io/dis-aware-ipp/slides/

30 slides: 22 main slides and eight appendix slides. Buildless HTML, CSS and JavaScript. Equations use the existing local KaTeX distribution in `../update-slides/assets/katex/dist/`.

## Content and recordings

The method, equations and discussion follow `disturbance_aware_ipp-draft1.pdf` (23 pages). `assets/provenance.json` records its SHA-256 and the immutable public data revision. Figures and trajectories are not synthetic replacements for recordings.

The manuscript uses scenario order 1, 2, 3, 4 for website data identifiers 1, 2, 4, 3. The source identifier is retained in `assets/results.json`. Shared cutoffs are 532, 560, 544 and 514 seconds. Runs stop at contact, with no extrapolated comparison score. The two development handoff checks are disclosed in the appendix.

Recorded binaries and GIFs load lazily from the same immutable GitHub data commit as the simulation website. This avoids duplicating the large recordings in the Pages build. Environment JSON and metric summaries are local to this deck. The original simulation site and previous decks are unchanged.

The animated method cartoon is illustrative, based on the approved five-panel vector figure. Controls animate drawing, measurement arrival and robot movement without representing a numerical simulation. `assets/method-cartoon.gif` provides a portable animated export. All slide text, math, tables and charts remain editable in source.

## Controls

- Arrow keys, slide selector, Home and End navigate.
- Each animation has Play, Restart and a slider.
- Simulation slides offer synchronized replay or looping recorded GIFs.
- Space controls the current slide's main animation.
- Notes contain paper references and interpretation details.

## Verification

Browser checks cover all 30 slides, math parsing, text overflow, actual immutable data URLs, all 20 recordings, playback progress and GIF loading. QA scripts are kept in the research repository under `docs/presentation/draft1-20261108/`.
