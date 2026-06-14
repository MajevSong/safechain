"""
Generate F10 performance figures from the refined Caliper benchmark
(safechain-clean). Data are the measured per-round results; goodput is
successful transactions divided by the round's wall-clock duration.

Run: python figures/generate_performance.py
"""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

OUT = os.path.dirname(os.path.abspath(__file__))
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10, "savefig.dpi": 300,
                     "savefig.bbox": "tight"})

# Measured results: offered TPS, success, fail, avg latency (s), duration (s)
DATA = {
    "RegisterCertificate (competency, write)": {
        "c": "#1f4e79", "m": "o",
        "offered": [50, 100, 200, 400],
        "succ": [6000, 12004, 11536, 1660],
        "fail": [0, 0, 12468, 46344],
        "lat": [0.20, 0.85, 26.86, 47.47],
        "dur": [122.148, 122.194, 174.819, 174.821],
    },
    "GetWorker (competency, read)": {
        "c": "#2e7d32", "m": "s",
        "offered": [100, 500, 1000],
        "succ": [12004, 60004, 120004],
        "fail": [0, 0, 0],
        "lat": [0.004, 0.004, 0.02],
        "dur": [120.113, 120.107, 120.113],
    },
    "ReportAccident (premium, write)": {
        "c": "#c0392b", "m": "^",
        "offered": [50, 100, 200],
        "succ": [6004, 12004, 10701],
        "fail": [0, 0, 13299],
        "lat": [0.19, 1.40, 27.41],
        "dur": [122.087, 122.324, 174.72],
    },
}

for d in DATA.values():
    d["goodput"] = [s / t for s, t in zip(d["succ"], d["dur"])]
    d["succrate"] = [100 * s / (s + f) for s, f in zip(d["succ"], d["fail"])]


def main():
    fig, axes = plt.subplots(1, 3, figsize=(15, 4.4))

    # (a) goodput vs offered load
    ax = axes[0]
    ax.plot([0, 1000], [0, 1000], color="#bbbbbb", ls=":", lw=1, label="ideal (y=x)")
    for name, d in DATA.items():
        ax.plot(d["offered"], d["goodput"], marker=d["m"], color=d["c"], label=name, ms=6)
    ax.set_xlabel("Offered load (TPS)"); ax.set_ylabel("Goodput — successful TPS")
    ax.set_title("(a) Throughput vs. offered load", fontsize=10)
    ax.grid(alpha=0.3); ax.legend(fontsize=7.5, loc="upper left")

    # (b) avg latency vs offered load (log y)
    ax = axes[1]
    for name, d in DATA.items():
        ax.plot(d["offered"], [max(l, 0.003) for l in d["lat"]], marker=d["m"], color=d["c"], ms=6, label=name)
    ax.axhline(3.0, color="#8e44ad", ls="--", lw=1, label="3 s target")
    ax.set_yscale("log"); ax.set_xlabel("Offered load (TPS)"); ax.set_ylabel("Avg latency (s, log)")
    ax.set_title("(b) Latency vs. offered load", fontsize=10)
    ax.grid(alpha=0.3, which="both"); ax.legend(fontsize=7.5)

    # (c) success rate vs offered load
    ax = axes[2]
    for name, d in DATA.items():
        ax.plot(d["offered"], d["succrate"], marker=d["m"], color=d["c"], ms=6, label=name)
    ax.axhline(95, color="#8e44ad", ls="--", lw=1, label="95% target")
    ax.set_ylim(0, 105); ax.set_xlabel("Offered load (TPS)"); ax.set_ylabel("Success rate (%)")
    ax.set_title("(c) Reliability vs. offered load", fontsize=10)
    ax.grid(alpha=0.3); ax.legend(fontsize=7.5, loc="lower left")

    fig.suptitle("SafeChain performance on a single-host 4-org Hyperledger Fabric network "
                 "(Hyperledger Caliper)", fontsize=10.5, style="italic", fontweight="bold", y=1.03)
    path = os.path.join(OUT, "F10_performance.png")
    fig.savefig(path); plt.close(fig)
    print("wrote", path)


if __name__ == "__main__":
    main()
