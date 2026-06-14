"""
F11 — DI1 premium-model calibration against published statistics.
(a) Empirical severity distribution of construction accidents (SGK, 2024) mapped
    1:1 onto the DI1 severity classes.
(b) DI1 severity weights versus an ANSI Z16.1 charged-days reference (linear and
    log-normalised), illustrating the deliberate excess-loss compression that
    keeps accident frequency the dominant premium driver (NCCI principle).

Run: python figures/generate_calibration.py
"""
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

OUT = os.path.dirname(os.path.abspath(__file__))
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10, "savefig.dpi": 300,
                     "savefig.bbox": "tight"})

classes = ["low\n(no lost time)", "medium\n(1–4 days)", "high\n(≥5 days /\npermanent)", "fatal\n(death)"]
# SGK construction-sector accidents, 2024 (n = 86,736): same-day 56,333; 1–4 d 10,612;
# ≥5 d 19,791; fatal 552 (Tables 3.1.1, 3.1.2).
emp_pct = [64.9, 12.2, 22.8, 0.64]
di1_w = [0.05, 0.15, 0.32, 0.70]
# ANSI Z16.1 representative charged days per class (death/permanent-total = 6000).
ansi_days = np.array([5, 50, 3000, 6000], dtype=float)


def norm(v, lo=0.05, hi=0.70):
    v = np.asarray(v, dtype=float)
    return lo + (v - v.min()) / (v.max() - v.min()) * (hi - lo)


def main():
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4.6))

    # (a) empirical distribution + DI1 weights
    x = np.arange(len(classes))
    bars = ax1.bar(x, emp_pct, color="#4f7cb3", width=0.6, label="SGK 2024 construction freq. (%)")
    ax1.set_ylabel("Share of construction accidents (%)", color="#1f4e79")
    ax1.set_xticks(x); ax1.set_xticklabels(classes, fontsize=8.5)
    for b, p in zip(bars, emp_pct):
        ax1.text(b.get_x() + b.get_width() / 2, p + 1, f"{p:g}%", ha="center", fontsize=8)
    axw = ax1.twinx()
    axw.plot(x, di1_w, color="#c0392b", marker="o", ms=7, lw=2, label="DI1 severity weight")
    axw.set_ylabel("DI1 severity weight  w", color="#c0392b")
    axw.set_ylim(0, 0.8)
    ax1.set_ylim(0, 70)
    ax1.set_title("(a) Empirical severity distribution vs. DI1 weights", fontsize=10)
    l1, la1 = ax1.get_legend_handles_labels(); l2, la2 = axw.get_legend_handles_labels()
    ax1.legend(l1 + l2, la1 + la2, fontsize=7.5, loc="upper right")

    # (b) compression vs ANSI reference
    ax2.plot(x, norm(ansi_days), marker="s", color="#7f8c8d", ls="--",
             label="ANSI Z16.1 charged days (linear-norm.)")
    ax2.plot(x, norm(np.log10(ansi_days)), marker="^", color="#2e7d32", ls="-.",
             label="ANSI Z16.1 (log-norm.)")
    ax2.plot(x, di1_w, marker="o", color="#c0392b", lw=2, ms=7, label="DI1 weights (used)")
    ax2.set_xticks(x); ax2.set_xticklabels([c.split("\n")[0] for c in classes])
    ax2.set_ylabel("Normalised severity weight")
    ax2.set_title("(b) Excess-loss compression (NCCI principle)", fontsize=10)
    ax2.grid(alpha=0.3); ax2.legend(fontsize=7.5, loc="upper left")
    ax2.annotate("DI1 sits below the log curve:\nseverity deliberately compressed so\nfrequency drives the premium",
                 xy=(2, 0.32), xytext=(0.15, 0.52), fontsize=7.5, color="#c0392b",
                 arrowprops=dict(arrowstyle="->", color="#c0392b"))

    fig.suptitle("Calibration of the DI1 dynamic-premium model against SGK (2024) construction "
                 "statistics and ANSI/NCCI experience-rating principles", fontsize=10, style="italic",
                 fontweight="bold", y=1.04)
    path = os.path.join(OUT, "F11_calibration.png")
    fig.savefig(path); plt.close(fig)
    print("wrote", path)


if __name__ == "__main__":
    main()
