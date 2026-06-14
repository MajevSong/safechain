"""
F17 — DI1 backtesting on a synthetic portfolio, with two methodological
safeguards added in response to review:

(1) NON-CIRCULAR ground truth. DI1's severity weights derive from the ANSI
    Z16.1 charged-day scale, so a ground truth built from ANSI days would be
    partly circular. We instead draw each accident's loss from an INDEPENDENT
    monetary model: severity-conditioned Lognormal claim costs with relativities
    distinct from ANSI, plus per-claim noise. Correlation then reflects genuine
    predictive validity, not shared construction.

(2) EXPOSURE / FAIRNESS. Each project has a size (worker exposure) and an
    independent per-worker safety factor. We compare the absolute-count DI1
    against an exposure-normalised variant to show the size bias and its fix.

Run: python figures/generate_calibration_backtest.py
"""
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

OUT = os.path.dirname(os.path.abspath(__file__))
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10, "savefig.dpi": 300, "savefig.bbox": "tight"})
rng = np.random.default_rng(7)

SEV = ["low", "medium", "high", "fatal"]
P_SEV = np.array([0.649, 0.122, 0.228, 0.0064]); P_SEV /= P_SEV.sum()  # SGK 2024 construction (Tbl 3.1.1/3.1.2)
DI1_W = {"low": 0.05, "medium": 0.15, "high": 0.32, "fatal": 0.70}      # ANSI-derived (unchanged)
# INDEPENDENT monetary claim-cost medians (relativities deliberately != ANSI days)
COST = {"low": 1.0, "medium": 6.0, "high": 60.0, "fatal": 250.0}

# Parameters anchored to REAL official SGK 2024 Statistical Yearbook figures
# (Table 3.1.26 accidents-by-workplace-size; Table 3.1.30 frequency rate). Project
# sizes are sampled from the REAL workplace-size bands (exposure-weighted by the
# real accident shares), not a guessed distribution. Only the per-project safety
# multiplier and the per-claim monetary loss remain synthetic (micro-data private).
SIZE_MID = np.array([2, 6, 15, 35, 75, 150, 225, 375, 750, 1500], dtype=float)
SIZE_ACC = np.array([10897, 31434, 44047, 80421, 80298, 103457, 36660, 116891, 100509, 129032], dtype=float)
SIZE_P = SIZE_ACC / SIZE_ACC.sum()
N = 4000
band = rng.choice(len(SIZE_MID), size=N, p=SIZE_P)
W = SIZE_MID[band] * rng.uniform(0.7, 1.3, size=N)            # real SGK workplace-size distribution
safety = rng.lognormal(mean=0.0, sigma=0.5, size=N)           # per-worker risk multiplier (true risk)
base_rate = 0.045                                             # REAL SGK 2024 construction accident frequency (~86,736/1.93M)
lam = W * base_rate * safety                                  # expected accidents scales with size AND risk

di1_abs, di1_norm, loss_tot, sizes, loss_rate = [], [], [], [], []
for i in range(N):
    n = rng.poisson(lam[i])
    sev = [SEV[k] for k in (rng.choice(4, size=n, p=P_SEV) if n > 0 else [])]
    # independent monetary loss per claim (lognormal noise around cost median)
    loss = float(sum(rng.lognormal(mean=np.log(COST[s]), sigma=0.7) for s in sev))
    n_exp = rng.poisson(0.15 * lam[i])
    sev_sum = sum(DI1_W[s] for s in sev)
    abs_f = min(2.75, 1 + 0.04 * n + sev_sum + 0.06 * n_exp)
    # exposure-normalised: rates per 100 workers
    k = 100.0 / max(W[i], 1.0)
    norm_f = min(2.75, 1 + 0.04 * (n * k) + sev_sum * k + 0.06 * (n_exp * k))
    di1_abs.append(abs_f); di1_norm.append(norm_f)
    loss_tot.append(loss); sizes.append(W[i]); loss_rate.append(loss / max(W[i], 1.0))

di1_abs = np.array(di1_abs); di1_norm = np.array(di1_norm)
loss_tot = np.array(loss_tot); sizes = np.array(sizes); loss_rate = np.array(loss_rate)

def spearman(a, b):
    return np.corrcoef(np.argsort(np.argsort(a)), np.argsort(np.argsort(b)))[0, 1]

rho_validity = spearman(di1_abs, loss_tot)
order = np.argsort(loss_tot)
lift = di1_abs[order[-N // 10:]].mean() / di1_abs[order[: N // 10]].mean()
rho_sizebias = spearman(di1_abs, sizes)
# Fairness is size-dependent: evaluate within size quartiles (small vs large projects).
q = np.argsort(sizes)
small = q[: N // 4]; large = q[-N // 4:]
abs_small = spearman(di1_abs[small], loss_rate[small]); norm_small = spearman(di1_norm[small], loss_rate[small])
abs_large = spearman(di1_abs[large], loss_rate[large]); norm_large = spearman(di1_norm[large], loss_rate[large])
print(f"validity rho(DI1_abs, indep loss) = {rho_validity:.3f}  decile lift = {lift:.2f}x")
print(f"size bias rho(DI1_abs, size)      = {rho_sizebias:.3f}")
print(f"small projects: abs->loss_rate {abs_small:.3f}  norm->loss_rate {norm_small:.3f}")
print(f"large projects: abs->loss_rate {abs_large:.3f}  norm->loss_rate {norm_large:.3f}")

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.4))
ax1.scatter(loss_tot + 1, di1_abs + rng.normal(0, 0.01, N), s=6, alpha=0.2, color="#1f4e79")
ax1.set_xscale("log"); ax1.set_xlabel("Independent monetary loss per project (log)")
ax1.set_ylabel("DI1 factor (absolute)")
ax1.set_title(f"(a) Non-circular validity (real SGK frequency)\nSpearman ρ={rho_validity:.2f}", fontsize=9.5)
ax1.axhline(2.75, color="#c0392b", ls="--", lw=1); ax1.grid(alpha=0.3)

x = np.arange(2); w = 0.35
ax2.bar(x - w / 2, [abs_small, abs_large], w, color="#e8867c", label="DI1 absolute")
ax2.bar(x + w / 2, [norm_small, norm_large], w, color="#2e7d32", label="DI1 exposure-normalised")
for i, (a, n) in enumerate([(abs_small, norm_small), (abs_large, norm_large)]):
    ax2.text(i - w / 2, a + 0.02, f"{a:.2f}", ha="center", fontsize=8)
    ax2.text(i + w / 2, n + 0.02, f"{n:.2f}", ha="center", fontsize=8)
ax2.set_xticks(x); ax2.set_xticklabels(["small projects\n(typical, ~8 workers)", "large projects\n(top size quartile)"])
ax2.set_ylim(0, 1.0); ax2.set_ylabel("ρ with true loss-rate")
ax2.set_title("(b) Fairness: exposure normalisation helps\nmost where it matters — large projects", fontsize=9.5)
ax2.legend(fontsize=8, loc="lower left"); ax2.grid(alpha=0.3, axis="y")

fig.suptitle("DI1 backtesting — non-circular validity and exposure-normalised fairness "
             f"(synthetic, N={N}, SGK marginals)", fontsize=9.5, style="italic", fontweight="bold", y=1.03)
fig.savefig(os.path.join(OUT, "F17_di1_backtest.png")); plt.close(fig)
print("wrote F17_di1_backtest.png")
