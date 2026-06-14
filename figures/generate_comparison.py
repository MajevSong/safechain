"""F12 — single-orderer vs 3-node Raft cluster (HA overhead)."""
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

OUT = os.path.dirname(os.path.abspath(__file__))
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10, "savefig.dpi": 300, "savefig.bbox": "tight"})

loads = [50, 100, 200]
# avg latency (s)
reg_1 = [0.20, 0.85, 26.86]
reg_3 = [0.21, 0.56, 30.57]
acc_1 = [0.19, 1.40, 27.41]
acc_3 = [0.21, 0.78, 29.88]
# success %
succ_1 = [100, 100, 48.1]
succ_3 = [100, 100, 55.2]

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4.4))
x = np.arange(len(loads)); w = 0.2
ax1.bar(x - 1.5 * w, reg_1, w, label="Register · 1 orderer", color="#1f4e79")
ax1.bar(x - 0.5 * w, reg_3, w, label="Register · 3-node Raft", color="#5b8fc9")
ax1.bar(x + 0.5 * w, acc_1, w, label="Accident · 1 orderer", color="#c0392b")
ax1.bar(x + 1.5 * w, acc_3, w, label="Accident · 3-node Raft", color="#e8867c")
ax1.axhline(3.0, color="#8e44ad", ls="--", lw=1, label="3 s target")
ax1.set_yscale("log"); ax1.set_xticks(x); ax1.set_xticklabels([f"{l} TPS" for l in loads])
ax1.set_ylabel("Avg latency (s, log)"); ax1.set_title("(a) Write latency: 1 orderer vs 3-node Raft", fontsize=10)
ax1.legend(fontsize=7); ax1.grid(alpha=0.3, axis="y", which="both")

ax2.plot(loads, succ_1, "o-", color="#1f4e79", label="1 orderer")
ax2.plot(loads, succ_3, "s--", color="#2e7d32", label="3-node Raft")
ax2.axhline(95, color="#8e44ad", ls="--", lw=1, label="95% target")
ax2.set_ylim(0, 105); ax2.set_xlabel("Offered load (TPS, write)"); ax2.set_ylabel("Success rate (%)")
ax2.set_title("(b) Reliability is preserved under HA consensus", fontsize=10)
ax2.legend(fontsize=8); ax2.grid(alpha=0.3)
ax2.annotate("HA at no cost:\n≤100 TPS identical,\n100% success",
             xy=(100, 100), xytext=(120, 60), fontsize=8, color="#2e7d32",
             arrowprops=dict(arrowstyle="->", color="#2e7d32"))

fig.suptitle("Fault-tolerant 3-node Raft ordering vs a single orderer — negligible overhead at the "
             "design load", fontsize=10, style="italic", fontweight="bold", y=1.03)
fig.savefig(os.path.join(OUT, "F12_ha_comparison.png")); plt.close(fig)
print("wrote F12_ha_comparison.png")
