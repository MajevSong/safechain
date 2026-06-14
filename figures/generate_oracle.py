"""F16 — conceptual Oracle Gateway addressing the oracle problem."""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

OUT = os.path.dirname(os.path.abspath(__file__))
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9.5, "savefig.dpi": 300, "savefig.bbox": "tight"})
C_P, C_A, C_W, C_L = "#1f4e79", "#2e7d32", "#c0392b", "#eaf1f8"


def box(ax, x, y, w, h, t, fc=C_L, ec=C_P, fs=9, bold=False):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.06", fc=fc, ec=ec, lw=1.3))
    ax.text(x + w / 2, y + h / 2, t, ha="center", va="center", fontsize=fs, fontweight="bold" if bold else "normal")


def arr(ax, x1, y1, x2, y2, c="#7f8c8d", ls="-"):
    ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle="-|>", mutation_scale=12, color=c, lw=1.4, linestyle=ls))


fig, ax = plt.subplots(figsize=(11, 5.2))
ax.set_xlim(0, 12); ax.set_ylim(0, 6); ax.axis("off")

# Trusted off-chain sources
box(ax, 0.2, 4.6, 2.6, 1.0, "IoT site sensors\n(wearables, cameras,\nhazard monitors)", fc="#fdf2e3", ec="#b9770e", fs=8)
box(ax, 0.2, 3.0, 2.6, 1.0, "Inspector multi-sig\n(Auditor / SGK\nlabour inspectorate)", fc="#e8f5e9", ec=C_A, fs=8)
box(ax, 0.2, 1.4, 2.6, 1.0, "SGK / hospital\ncentral APIs\n(claim, medical records)", fc="#f5e8f5", ec="#8e44ad", fs=8)

# Oracle Gateway
box(ax, 3.6, 2.4, 2.8, 2.2,
    "Oracle Gateway\n\n• source authentication\n• cross-source corroboration\n• threshold (m-of-n) signing\n• tamper-evident feed",
    fc=C_L, ec=C_P, bold=True, fs=8.5)

# On-chain
box(ax, 7.4, 3.4, 2.4, 1.2, "AccidentIntake\n(competency channel)\nPENDING → ATTESTED", fc="#e8f5e9", ec=C_A, bold=True, fs=8)
box(ax, 7.4, 1.4, 2.4, 1.2, "AccidentPremium\n(premium channel)\nfactor update (DI1)", fc=C_L, ec=C_P, bold=True, fs=8)
box(ax, 10.4, 2.4, 1.4, 1.2, "Immutable\nledger\n(audit trail)", fc="#e9edf2", ec=C_P, fs=8)

for y in (5.1, 3.5, 1.9):
    arr(ax, 2.8, y, 3.55, 3.5)
arr(ax, 6.4, 3.7, 7.35, 4.0, c=C_A)
arr(ax, 8.6, 3.35, 8.6, 2.65, c=C_P, ls="--")
ax.text(8.75, 3.0, "relay on\nattestation", fontsize=7, color=C_P)
arr(ax, 9.8, 4.0, 10.4, 3.2, c=C_P)
arr(ax, 9.8, 2.0, 10.4, 2.7, c=C_P)

ax.text(6, 5.7, "Conceptual Oracle Gateway: corroborated, multi-source, threshold-signed off-chain feeds "
                "mitigate the oracle problem", ha="center", fontsize=9.5, style="italic", fontweight="bold")
ax.text(5.0, 0.5, "Mitigation: a premium update requires a threshold-signed, cross-corroborated, inspector-attested event — "
                  "no single party can fabricate or suppress a report undetected.", ha="center", fontsize=8, color=C_W)
fig.savefig(os.path.join(OUT, "F16_oracle_gateway.png")); plt.close(fig)
print("wrote F16_oracle_gateway.png")
