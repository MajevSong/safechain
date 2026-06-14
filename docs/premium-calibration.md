# DI1 Premium Model — Calibration and Justification

Addresses the reviewer concern that the DI1 premium formula is heuristic and not
calibrated. We reframe DI1 as a **parametric, calibration-ready experience-rating
plan** whose structure and coefficients are grounded in published statistics and
established actuarial principles, and we make explicit which parameters are
tunable on insurer claims data (future work).

## The model
For a project, the premium factor is

  factor = min(2.75, 1 + 0.04·n_acc + Σ_i w(s_i) + 0.06·n_expired),

a multiplier on the base hazard-class premium — analogous to a workers'-compensation
**experience modification factor (e-mod)**. It has three terms: a **frequency**
term (per-accident increment), a **severity** term (sum of severity weights), and
a **compliance** term (expired-certificate penalty), bounded by a regulatory cap.

## Grounding of each parameter

| Parameter | Value | Grounding |
|-----------|-------|-----------|
| Base | 1.0 | Neutral multiplier on the sector base premium. Turkish occupational-accident insurance is hazard-class rated at 1–6.5 % of wages, with construction in the *very hazardous* class; SGK already applies an experience-degree system (upper/normal/lower, ±0.2 %) computed from a 3-year hazard-weight (SGK). DI1 generalises this band into a continuous, event-driven multiplier. |
| Cap = 2.75 | max | Bounds the maximum surcharge (≈175 %), consistent with capped debit e-mods and the excess-loss limitation of experience rating (NCCI). |
| Severity weights w | low 0.05, medium 0.15, high 0.32, fatal 0.70 | **Ordering and classes** map 1:1 to the empirical construction severity distribution (SGK 2024: no-lost-time 64.9 %, 1–4 days 12.2 %, ≥5 days/permanent 22.8 %, fatal 0.64 %). **Magnitudes** are a compressed transform of the ANSI Z16.1 charged-day scale (death/permanent-total = 6000 days). The weights sit *below* even the log-normalised ANSI curve (Figure 11b): severity is deliberately compressed so that a single catastrophic event does not dominate the mod — the core NCCI principle that **frequency is more predictable than severity and should carry more weight**. |
| Frequency coeff. 0.04 | per accident | Keeps the frequency term dominant across the many low-severity events (≈64 % of construction accidents are no-lost-time), so the modifier responds primarily to how *often* incidents occur (≈65 % of construction accidents are no-lost-time). |
| Compliance coeff. 0.06 | per expired cert | Ties the premium to a leading, controllable OHS indicator (certificate currency), reinforcing prevention incentives (DI1). |

## Calibration procedure (reproducible)
1. **Class definition** from the SGK lost-workday bands (no-lost-time / 1–4 d / ≥5 d / fatal).
2. **Reference severity** from ANSI Z16.1 standard charged days per class.
3. **Compression** via a sub-logarithmic transform, parameterised so fatal anchors the cap and frequency remains dominant (NCCI excess-loss limitation).
4. **Frequency/compliance coefficients** set so a project at the sector-average accident frequency lands near the neutral band, with the cap matching the maximum regulatory surcharge.

Figure 11 visualises steps 1–3. The sensitivity of the factor to frequency,
severity, and compliance is shown in Figure 6.

## Honest scope
The coefficients above are **illustrative**, grounded in *aggregate* public
statistics rather than fitted to a proprietary claims dataset. Full actuarial
calibration — fitting w, the frequency coefficient, and the cap to an insurer's
historical claim-cost and accident-severity distributions (e.g., via a
generalised linear rating model) — requires access to SGK/insurer micro-data and
is identified as future work. Crucially, DI1's *parametric structure* makes such
recalibration a coefficient-update, not a redesign.

## Anti-gaming / underreporting note
Because the modifier rewards low reported accident counts, it can create an
underreporting incentive. SafeChain mitigates this at the architecture level: the
accident-reporting path requires a multi-signature inspector (Auditor org)
attestation before a premium-affecting update is committed, and on-chain records
are tamper-evident and cross-checkable against SGK/hospital feeds (see the oracle
and governance discussion). Mandating the inspector attestation for premium
updates makes silent underreporting detectable.

## Real-data anchoring (SGK 2024 Statistical Yearbook)

After the initial calibration we obtained the official **SGK 2024 Statistical
Yearbook** micro-tables (Bölüm 3-1, 4-1/a) and re-anchored the validation to real
figures rather than assumptions:

- **Frequency / counts (Table 3.1.1):** construction accidents 2024 = **86,736**
  (NACE 41: 50,429; 42: 26,106; 43: 10,201).
- **Severity scale (Table 3.1.3):** construction temporary-incapacity days =
  **≈685,020**, i.e. **≈7.9 lost workdays per accident** — a real cross-check on
  the severity weighting (short incapacities dominate, with a heavy severe tail).
- **Exposure basis (Table 3.1.30):** national frequency 3.37 per 100 persons;
  official full-time exposure **2,250 working-hours per worker-year** — the basis
  used for the exposure-normalised DI1 variant.
- **Workplace-size distribution (Table 3.1.26):** project sizes in the backtest
  are now **sampled from the real accident-by-workplace-size bands**; crucially,
  **≥250-employee workplaces account for ~47 %** of accidents. This real fact is
  what makes the absolute-count size bias material (for large projects the
  absolute factor correlates with true risk at ρ≈−0.02; exposure normalisation
  restores ρ≈0.90 — see §5.3.4 and Figure 17b).

The per-claim monetary loss model remains independent/synthetic (claim-cost
micro-data are confidential), which is also what keeps the backtest non-circular.
