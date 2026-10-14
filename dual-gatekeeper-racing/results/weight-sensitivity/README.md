# Racing information-weight sensitivity

The 66 paired episodes vary eight information weights at three fixed tire coefficients and two candidate risk tolerances. Seed 7, initial support [0.45, 1.05], vehicle dynamics, candidate library and certification settings are shared. These are parameter-sensitivity experiments, not independent Monte Carlo safety estimates.

The weighted objective is `(prefix cost − 0.25 × progress) / prefix duration − λ × excitation`. Its excitation surrogate remains active after identification. The proposed controller uses paired candidates and an exploration budget instead of a fixed information weight.

At μ = 0.85, λ = 0.125 substantially improves on the original λ = 4. λ = 0.25 completes slightly faster than proposed but has higher mission cost. All tested weights are reported; the figures do not claim proposed is fastest for every weight. The best tested weight also changes with tire friction. The displayed examples were selected after this exploratory sweep and are not held-out tuning validation.

CSV retains every outcome; lap times are reported only for completed laps. Raw records and independent replay audits are in the parent directory. The original 2,800-episode stress study remains a separate cohort with its original λ = 4 baseline and narrower initial support.
