# Real official figures extracted from the SGK 2024 Statistical Yearbook
Source: SGK (2024) Yıllık İstatistikler, Bölüm 3-1 İş Kazası ve Meslek Hastalığı
İstatistikleri (4-1/a). Raw yearbook workbooks are included in `dataset/` (official SGK `.xlsx` files).

## Construction sector, 2024 (Table 3.1.1, accidents by NACE)
- NACE 41 (building construction): 50,429 accidents (27 deaths in-table col)
- NACE 42 (civil engineering): 26,106
- NACE 43 (specialised construction): 10,201
- **Construction total: 86,736 accidents** (= 41+42+43)

## Construction lost workdays, 2024 (Table 3.1.3, temporary-incapacity days)
- NACE 41: 439,985 days; NACE 42: 147,781; NACE 43: 97,254
- **Total ≈ 685,020 lost workdays → ≈ 7.9 days per accident** (real severity anchor)

## Frequency & weight rates, 2024 (Table 3.1.30, national, 4-1/a)
- Insured with accident: 733,646; premium-accrued days: 6,128,823,560
- **Frequency rate: 14.96 per 1,000,000 working hours = 3.37 per 100 persons**
- Official exposure basis: NDPA×8 hours; full-time = 225,000 h per 100 persons/yr
  → **2,250 working hours per worker-year** (basis for per-worker-hour normalisation)

## Accidents by workplace size, 2024 (Table 3.1.26, national, Total column)
| Workplace size (employees) | Accidents | Deaths |
|---|---:|---:|
| 1-3 | 10,897 | 153 |
| 4-9 | 31,434 | 228 |
| 10-20 | 44,047 | 268 |
| 21-49 | 80,421 | 375 |
| 50-99 | 80,298 | 219 |
| 100-199 | 103,457 | 246 |
| 200-249 | 36,660 | 36 |
| 250-499 | 116,891 | 148 |
| 500-999 | 100,509 | 103 |
| 1000+ | 129,032 | 121 |
| **Total** | **733,646** | **1,897** |

Key fact: workplaces with **≥250 employees account for ~47%** of all accidents
(346,432/733,646) and the 1000+ band alone 17.6% — large workplaces dominate
accident exposure, which is why absolute-count premium terms are size-biased and
exposure normalisation matters in practice.
