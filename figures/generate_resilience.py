"""F15 — resilience: ordering-tier WAN-latency emulation + fault tolerance."""
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

OUT = os.path.dirname(os.path.abspath(__file__))
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10, "savefig.dpi": 300, "savefig.bbox": "tight"})

delay = ["0 (co-located)", "20 ms", "50 ms"]
lat = [0.56, 0.78, 0.72]   # avg write latency (s) @100 TPS
tps = [98.2, 97.6, 97.2]   # goodput

fig, ax = plt.subplots(figsize=(8, 4.6))
x = np.arange(3)
bars = ax.bar(x, lat, 0.5, color="#1f4e79", label="avg write latency (s)")
for i, v in enumerate(lat):
    ax.text(i, v + 0.03, f"{v:g}s", ha="center", fontsize=9, fontweight="bold")
ax.set_ylabel("Avg write latency (s)", color="#1f4e79")
ax.set_ylim(0, 1.0); ax.set_xticks(x); ax.set_xticklabels(delay)
ax.set_xlabel("Emulated WAN latency injected on the 3-node ordering tier (netem)")
ax2 = ax.twinx()
ax2.plot(x, tps, "s-", color="#2e7d32", lw=2, ms=8, label="goodput (TPS)")
ax2.set_ylabel("Goodput (TPS)", color="#2e7d32"); ax2.set_ylim(80, 105)
for i, v in enumerate(tps):
    ax2.text(i, v + 1, f"{v:g}", ha="center", fontsize=8, color="#2e7d32")
ax.text(0.5, 0.92, "All points: 100% success.  Fault tolerance verified: killing 1 of 3 orderers\n"
                    "(Raft 2/3 quorum) keeps the network committing; recovery is automatic.",
        transform=ax.transAxes, ha="center", fontsize=8.5, color="#c0392b",
        bbox=dict(boxstyle="round,pad=0.3", fc="#fbeaea", ec="#c0392b"))
ax.set_title("Resilience: ordering-tier latency sensitivity and Raft fault tolerance",
             fontsize=10, style="italic", fontweight="bold")
fig.savefig(os.path.join(OUT, "F15_resilience.png")); plt.close(fig)
print("wrote F15_resilience.png")
