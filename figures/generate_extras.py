"""F13 (ablations) and F14 (decentralisation cost) from the revision benchmarks."""
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

OUT = os.path.dirname(os.path.abspath(__file__))
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10, "savefig.dpi": 300, "savefig.bbox": "tight"})
C1, C2, C3 = "#1f4e79", "#2e7d32", "#c0392b"

# ---- F13: endorsement / MVCC / PDC ablations ----
fig, ((a, b), (c, d)) = plt.subplots(2, 2, figsize=(12, 8.4))

# (a) endorsement policy
pol = ["1-of-4", "2-of-4", "3-of-4"]
avg = [0.37, 0.37, 0.34]; mx = [2.16, 2.22, 2.36]
x = np.arange(3)
a.bar(x - 0.2, avg, 0.4, color=C1, label="avg latency")
a.bar(x + 0.2, mx, 0.4, color="#9bb8d6", label="max latency")
a.axhline(3.0, color="#8e44ad", ls="--", lw=1, label="3 s target")
a.set_xticks(x); a.set_xticklabels(pol); a.set_ylabel("Latency (s)")
a.set_title("(a) Endorsement policy @100 TPS\n(all ~97.7 TPS, 100% success)", fontsize=9.5)
a.legend(fontsize=7.5)

# (b) MVCC contention
b.bar(["single hot-key", "per-project"], [7.1, 100], color=[C3, C2], width=0.6)
b.axhline(95, color="#8e44ad", ls="--", lw=1, label="95% target")
for i, v in enumerate([7.1, 100]):
    b.text(i, v + 2, f"{v:g}%", ha="center", fontsize=9, fontweight="bold")
b.set_ylim(0, 110); b.set_ylabel("Write success rate (%)")
b.set_title("(b) Premium-key MVCC ablation\n(accident @100 TPS)", fontsize=9.5); b.legend(fontsize=7.5)

# (c) PDC overhead
labels = ["public-only", "+ PII (PDC)"]
lat = [0.46, 5.16]; tps = [97.7, 88.6]
xc = np.arange(2)
bars = c.bar(xc, lat, 0.5, color=[C1, "#8e44ad"])
for i, v in enumerate(lat):
    c.text(i, v + 0.15, f"{v:g}s", ha="center", fontsize=9, fontweight="bold")
c.set_xticks(xc); c.set_xticklabels(labels); c.set_ylabel("Avg write latency (s)")
c.set_title("(c) Private Data Collection overhead\n(register @100 TPS, both 100% succ)", fontsize=9.5)
c.set_ylim(0, 6)

# (d) sharded aggregate scaling (intra-project, same project @100 TPS)
shards = ["1\n(single key)", "16\nshards", "64\nshards"]
succ_sh = [6.4, 52.4, 77.6]
d.bar(shards, succ_sh, color=[C3, "#e8867c", C2], width=0.6)
for i, v in enumerate(succ_sh):
    d.text(i, v + 2, f"{v:g}%", ha="center", fontsize=9, fontweight="bold")
d.axhline(95, color="#8e44ad", ls="--", lw=1, label="95% target")
d.set_ylim(0, 110); d.set_ylabel("Write success rate (%)")
d.set_title("(d) Sharded aggregate scaling\n(one hot project @100 TPS)", fontsize=9.5); d.legend(fontsize=7.5)

fig.suptitle("Sensitivity ablations: endorsement policy, MVCC contention, PDC overhead, and sharded scaling",
             fontsize=10.5, style="italic", fontweight="bold", y=1.0)
fig.savefig(os.path.join(OUT, "F13_ablations.png")); plt.close(fig)
print("wrote F13_ablations.png")

# ---- F14: three architectures, register (write) @100 TPS ----
fig, ax = plt.subplots(figsize=(8, 4.6))
arch = ["Centralized\nREST\n(no integrity)", "Centralized\nsigned hash-chain\n(tamper-evident)", "SafeChain\n(decentralized\nmulti-party)"]
lat = [0.00041, 0.00047, 0.56]   # s, register @100 TPS
cols = ["#bdc3c7", "#7f8c8d", C1]
bars = ax.bar(arch, lat, 0.55, color=cols)
ax.set_yscale("log"); ax.set_ylabel("Avg write latency (s, log)")
for i, v in enumerate(lat):
    ax.text(i, v * 1.4, (f"{v*1000:.2g} ms" if v < 1 else f"{v:.2g} s"), ha="center", fontsize=9, fontweight="bold")
ax.annotate("tamper-evidence is ~free\n(+0.06 ms)", xy=(1, 0.00047), xytext=(0.4, 0.02),
            fontsize=8, color="#555", arrowprops=dict(arrowstyle="->", color="#555"))
ax.annotate("the ~10³× cost buys\nremoval of the single\ntrusted writer", xy=(2, 0.56), xytext=(1.4, 0.0015),
            fontsize=8, color=C1, arrowprops=dict(arrowstyle="->", color=C1))
ax.set_title("What the ledger actually buys: integrity is cheap centrally;\n"
             "decentralised multi-party trust is the real cost (register @100 TPS)",
             fontsize=9.5, style="italic", fontweight="bold")
fig.savefig(os.path.join(OUT, "F14_baseline.png")); plt.close(fig)
print("wrote F14_baseline.png")
