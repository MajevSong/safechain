"""
Generate publication-quality figures (F1-F9) for the SafeChain paper.
Data-driven figures (ABAC matrix, premium sensitivity) reflect the actual
chaincode logic; diagrams reflect the deployed 4-org / 2-channel artefact.

Run:  python figures/generate_figures.py
Output: figures/*.png  (300 dpi)
"""
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Rectangle

OUT = os.path.dirname(os.path.abspath(__file__))
plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 10,
    "axes.linewidth": 0.8,
    "savefig.dpi": 300,
    "savefig.bbox": "tight",
})

# Palette
C_PRIMARY = "#1f4e79"
C_ACCENT = "#2e7d32"
C_WARN = "#c0392b"
C_LIGHT = "#eaf1f8"
C_LIGHT2 = "#e8f5e9"
C_GREY = "#7f8c8d"


def box(ax, x, y, w, h, text, fc=C_LIGHT, ec=C_PRIMARY, fs=9, bold=False, tc="#1a1a1a"):
    p = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.06",
                       fc=fc, ec=ec, lw=1.3)
    ax.add_patch(p)
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=fs,
            wrap=True, color=tc, fontweight="bold" if bold else "normal")


def arrow(ax, x1, y1, x2, y2, color=C_GREY, style="-|>", lw=1.4, ls="-"):
    ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle=style,
                                 mutation_scale=12, color=color, lw=lw, linestyle=ls))


def save(fig, name):
    path = os.path.join(OUT, name)
    fig.savefig(path)
    plt.close(fig)
    print("wrote", path)


# ---------------------------------------------------------------- F1 DSRM flow
def f1_dsrm():
    fig, ax = plt.subplots(figsize=(11, 3.4))
    ax.set_xlim(0, 12); ax.set_ylim(0, 4); ax.axis("off")
    stages = [
        ("1. Problem\nIdentification", "TR construction\nOHS gaps"),
        ("2. Define\nObjectives", "5 design\nprinciples DI1-DI5"),
        ("3. Design &\nDevelopment", "Fabric chaincode\n3 modules"),
        ("4. Demonstration", "Scenarios\nA / B / C"),
        ("5. Evaluation", "Caliper +\nSTRIDE/KVKK"),
        ("6. Communication", "This paper"),
    ]
    w, h, gap = 1.7, 1.2, 0.22
    x = 0.15
    for i, (title, out) in enumerate(stages):
        box(ax, x, 2.3, w, h, title, fc=C_LIGHT, bold=True, fs=8.5)
        box(ax, x, 0.7, w, 1.1, out, fc=C_LIGHT2, ec=C_ACCENT, fs=8)
        arrow(ax, x + w / 2, 2.28, x + w / 2, 1.82, color=C_ACCENT)
        if i < len(stages) - 1:
            arrow(ax, x + w, 2.9, x + w + gap, 2.9, color=C_PRIMARY)
        x += w + gap
    ax.text(6, 3.75, "DSRM process (Peffers et al., 2007) instantiated for SafeChain",
            ha="center", fontsize=9.5, style="italic")
    save(fig, "F1_dsrm_process.png")


# ------------------------------------------------------- F2 system architecture
def f2_architecture():
    fig, ax = plt.subplots(figsize=(10, 7))
    ax.set_xlim(0, 10); ax.set_ylim(0, 10); ax.axis("off")
    # Actor / org layer
    orgs = ["Contractor", "Subcontractor", "Insurer", "Auditor"]
    for i, o in enumerate(orgs):
        box(ax, 0.3 + i * 2.4, 8.6, 2.1, 1.0, o, fc="#fdf2e3", ec="#b9770e", bold=True, fs=8)
    # Channels
    box(ax, 0.3, 6.7, 5.2, 1.3, "Competency channel\n(all 4 orgs)", fc=C_LIGHT, ec=C_PRIMARY, bold=True)
    box(ax, 5.9, 6.7, 3.8, 1.3, "Premium-accident channel\n(Contractor + Insurer)", fc=C_LIGHT, ec=C_PRIMARY, bold=True)
    # Chaincode modules (CCAAS)
    mods = [("Competency\nManagement\n(DI2)", 0.3), ("Responsibility\n(DI3)", 3.0),
            ("Accident &\nPremium (DI1)", 5.9)]
    for t, x in mods:
        box(ax, x, 4.7, 2.4, 1.5, t, fc=C_LIGHT2, ec=C_ACCENT, bold=True, fs=8.5)
    box(ax, 8.5, 4.7, 1.2, 1.5, "ABAC\n+ PDC\n(DI4)", fc="#f5e8f5", ec="#8e44ad", bold=True, fs=8)
    # On-chain ledger
    box(ax, 0.3, 2.7, 9.4, 1.3,
        "Hyperledger Fabric ledger (on-chain): SHA-256 hashes, timestamps, tx metadata, audit trail",
        fc="#e9edf2", ec=C_PRIMARY, bold=True, fs=9)
    # Orderer + state DB
    box(ax, 0.3, 1.3, 4.6, 1.0, "Raft orderer", fc="#eef2f7", ec=C_GREY)
    box(ax, 5.1, 1.3, 4.6, 1.0, "CouchDB world-state (x4)", fc="#eef2f7", ec=C_GREY)
    # Off-chain
    box(ax, 0.3, 0.1, 9.4, 0.9,
        "Off-chain store / IPFS: full accident reports, certificate documents, medical records (PII)",
        fc="#fbeaea", ec=C_WARN, bold=True, fs=9)
    # arrows
    for i in range(4):
        arrow(ax, 1.35 + i * 2.4, 8.55, 2.8, 8.05, color=C_GREY)
    arrow(ax, 3.0, 6.65, 3.0, 6.25, color=C_PRIMARY)
    arrow(ax, 7.0, 6.65, 7.0, 6.25, color=C_PRIMARY)
    arrow(ax, 5.0, 4.65, 5.0, 4.05, color=C_ACCENT)
    arrow(ax, 5.0, 2.65, 5.0, 2.35, color=C_PRIMARY)
    arrow(ax, 5.0, 1.25, 5.0, 1.05, color=C_WARN, style="<|-|>", ls="--")
    ax.text(5, 9.78, "SafeChain layered architecture on Hyperledger Fabric",
            ha="center", fontsize=10, style="italic", fontweight="bold")
    save(fig, "F2_architecture.png")


# ------------------------------------------------- F3 on-chain / off-chain flow
def f3_dataflow():
    fig, ax = plt.subplots(figsize=(10, 4.2))
    ax.set_xlim(0, 10); ax.set_ylim(0, 4.4); ax.axis("off")
    box(ax, 0.2, 1.7, 1.9, 1.2, "Document\n(cert / accident\nreport)", fc="#fbeaea", ec=C_WARN, fs=8.5)
    box(ax, 2.7, 1.7, 1.7, 1.2, "SHA-256\nhash", fc=C_LIGHT2, ec=C_ACCENT, bold=True)
    box(ax, 5.0, 2.6, 2.0, 1.1, "On-chain:\nhash + metadata\n+ timestamp", fc=C_LIGHT, ec=C_PRIMARY, bold=True, fs=8)
    box(ax, 5.0, 0.5, 2.0, 1.1, "Off-chain store:\nfull document\n(private)", fc="#fbeaea", ec=C_WARN, bold=True, fs=8)
    box(ax, 7.7, 1.7, 2.1, 1.2, "Integrity proof:\nrecompute hash\n== on-chain", fc="#f5e8f5", ec="#8e44ad", bold=True, fs=8)
    arrow(ax, 2.1, 2.3, 2.65, 2.3, color=C_GREY)
    arrow(ax, 4.4, 2.4, 4.95, 3.1, color=C_ACCENT)
    arrow(ax, 4.4, 2.2, 4.95, 1.1, color=C_WARN, ls="--")
    arrow(ax, 7.0, 3.1, 7.65, 2.4, color=C_PRIMARY)
    arrow(ax, 7.0, 1.0, 7.65, 1.9, color=C_WARN, ls="--")
    ax.text(5, 4.15, "On-chain / off-chain split with hash anchoring (DI4)",
            ha="center", fontsize=10, style="italic", fontweight="bold")
    save(fig, "F3_onchain_offchain.png")


# ----------------------------------------------------- F4 scenario sequences
def f4_sequences():
    fig, axes = plt.subplots(1, 3, figsize=(13, 4.6))
    panels = [
        ("A. Certificate expiry", ["Subcontractor", "Chaincode", "Ledger"],
         [(0, 1, "VerifyCertificate"), (1, 2, "read worker"), (2, 1, "validUntil<now"),
          (1, 0, "WARN_EXPIRED")]),
        ("B. Accident -> premium", ["Contractor", "Chaincode", "Insurer"],
         [(0, 1, "ReportAccident"), (1, 1, "recompute factor"), (1, 2, "PREMIUM_UPDATED event"),
          (1, 0, "factor=1.19")]),
        ("C. Responsibility", ["Contractor", "Chaincode", "Ledger"],
         [(0, 1, "AuthorizeTask"), (1, 2, "read worker+cert"), (1, 1, "cert mismatch"),
          (1, 0, "REJECT -> Beta Formwork")]),
    ]
    for ax, (title, actors, msgs) in zip(axes, panels):
        ax.set_xlim(0, len(actors)); ax.set_ylim(0, len(msgs) + 1.5); ax.axis("off")
        xs = [i + 0.5 for i in range(len(actors))]
        for x, a in zip(xs, actors):
            box(ax, x - 0.45, len(msgs) + 0.6, 0.9, 0.7, a, fc=C_LIGHT, fs=7.5, bold=True)
            ax.plot([x, x], [0.2, len(msgs) + 0.6], color=C_GREY, lw=0.8, ls=":")
        y = len(msgs) - 0.2
        for (src, dst, label) in msgs:
            if src == dst:
                ax.annotate("", xy=(xs[src] + 0.25, y), xytext=(xs[src], y + 0.25),
                            arrowprops=dict(arrowstyle="-|>", color=C_ACCENT))
                ax.text(xs[src] + 0.3, y + 0.05, label, fontsize=7, va="center")
            else:
                arrow(ax, xs[src], y, xs[dst], y, color=C_PRIMARY)
                ax.text((xs[src] + xs[dst]) / 2, y + 0.12, label, fontsize=7, ha="center")
            y -= 1.0
        ax.set_title(title, fontsize=9.5, fontweight="bold")
    fig.suptitle("Demonstration scenario sequences (A, B, C)", fontsize=10,
                 style="italic", y=1.02)
    save(fig, "F4_scenarios.png")


# ------------------------------------------------------------- F5 ABAC matrix
def f5_abac():
    roles = ["Contractor", "Subcontractor", "Insurer", "Auditor", "Worker"]
    actions = ["registerCertificate", "verifyCertificate", "submitAccident",
               "attestAccident", "reportAccident", "authorizeTask", "viewLedger"]
    perms = {
        "Contractor": {"registerCertificate", "verifyCertificate", "submitAccident", "reportAccident", "authorizeTask", "viewLedger"},
        "Subcontractor": {"registerCertificate", "verifyCertificate", "submitAccident", "authorizeTask", "viewLedger"},
        "Insurer": {"verifyCertificate", "reportAccident", "viewLedger"},
        "Auditor": {"verifyCertificate", "attestAccident", "viewLedger"},
        "Worker": {"verifyCertificate"},
    }
    M = np.array([[1 if a in perms[r] else 0 for a in actions] for r in roles])
    fig, ax = plt.subplots(figsize=(8, 4.2))
    ax.imshow(M, cmap=matplotlib.colors.ListedColormap(["#f4f6f7", C_ACCENT]), aspect="auto", vmin=0, vmax=1)
    ax.set_xticks(range(len(actions))); ax.set_xticklabels(actions, rotation=25, ha="right", fontsize=9)
    ax.set_yticks(range(len(roles))); ax.set_yticklabels(roles, fontsize=9)
    for i in range(len(roles)):
        for j in range(len(actions)):
            ax.text(j, i, "✓" if M[i, j] else "—", ha="center", va="center",
                    color="white" if M[i, j] else C_GREY, fontsize=11, fontweight="bold")
    ax.set_xticks(np.arange(-.5, len(actions), 1), minor=True)
    ax.set_yticks(np.arange(-.5, len(roles), 1), minor=True)
    ax.grid(which="minor", color="white", lw=2)
    ax.set_title("Attribute-Based Access Control (ABAC) permission matrix",
                 fontsize=10, fontweight="bold", style="italic", pad=12)
    save(fig, "F5_abac_matrix.png")


# ------------------------------------------------ F6 premium sensitivity curves
def f6_premium():
    weights = {"low": 0.05, "medium": 0.15, "high": 0.32, "fatal": 0.70}
    n = np.arange(0, 21)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.2))
    for sev, w in weights.items():
        factor = np.minimum(2.75, 1 + 0.04 * n + w * n)
        ax1.plot(n, factor, marker="o", ms=3, label=f"{sev} (w={w})")
    ax1.axhline(2.75, color=C_WARN, ls="--", lw=1, label="cap = 2.75")
    ax1.set_xlabel("Number of accidents (same project)")
    ax1.set_ylabel("Premium factor")
    ax1.set_title("(a) Factor vs. accident frequency & severity", fontsize=10)
    ax1.legend(fontsize=8); ax1.grid(alpha=0.3)

    expired = np.arange(0, 21)
    for acc, w, lbl in [(0, 0, "0 accidents"), (3, 0.15, "3 medium accidents"),
                        (2, 0.32, "2 high accidents")]:
        base = 1 + 0.04 * acc + w * acc
        factor = np.minimum(2.75, base + 0.06 * expired)
        ax2.plot(expired, factor, marker="s", ms=3, label=lbl)
    ax2.axhline(2.75, color=C_WARN, ls="--", lw=1, label="cap = 2.75")
    ax2.set_xlabel("Number of expired certificates")
    ax2.set_ylabel("Premium factor")
    ax2.set_title("(b) Compliance penalty effect", fontsize=10)
    ax2.legend(fontsize=8); ax2.grid(alpha=0.3)
    fig.suptitle("Dynamic premium model sensitivity (DI1)", fontsize=10,
                 style="italic", fontweight="bold", y=1.02)
    save(fig, "F6_premium_sensitivity.png")


# ---------------------------------------------------- F7 responsibility chain
def f7_responsibility():
    fig, ax = plt.subplots(figsize=(10, 2.8))
    ax.set_xlim(0, 10); ax.set_ylim(0, 2.8); ax.axis("off")
    chain = ["Alpha Construction\n(main contractor)", "Beta Formwork\n(subcontractor)", "Gamma Scaffolding\n(sub-subcontractor)"]
    responsible = 1  # Beta Kalip flagged on reject
    x = 0.3
    for i, c in enumerate(chain):
        is_resp = (i == responsible)
        box(ax, x, 1.0, 2.6, 1.1, c,
            fc="#fbeaea" if is_resp else C_LIGHT,
            ec=C_WARN if is_resp else C_PRIMARY, bold=is_resp, fs=9)
        if is_resp:
            ax.text(x + 1.3, 0.65, "← accountable party\n(certificate mismatch)",
                    ha="center", fontsize=8, color=C_WARN, fontweight="bold")
        if i < len(chain) - 1:
            arrow(ax, x + 2.6, 1.55, x + 3.0, 1.55, color=C_GREY)
        x += 3.0
    ax.text(5, 2.55, "Subcontractor responsibility chain — accountable party on rejection (DI3)",
            ha="center", fontsize=9.5, style="italic", fontweight="bold")
    save(fig, "F7_responsibility_chain.png")


# ---------------------------------------------------------- F8 network topology
def f8_topology():
    fig, ax = plt.subplots(figsize=(9, 6))
    ax.set_xlim(0, 10); ax.set_ylim(0, 8); ax.axis("off")
    box(ax, 4.0, 6.6, 2.0, 0.9, "Raft Orderer\norderer:7050", fc="#eef2f7", ec=C_GREY, bold=True, fs=8.5)
    peers = [("peer0.contractor\n:7051", 0.3, C_PRIMARY), ("peer0.subcontractor\n:8051", 2.7, C_PRIMARY),
             ("peer0.insurer\n:9051", 5.1, C_PRIMARY), ("peer0.auditor\n:10051", 7.5, C_PRIMARY)]
    for t, x, c in peers:
        box(ax, x, 3.9, 2.1, 1.0, t, fc=C_LIGHT, ec=c, bold=True, fs=8)
        arrow(ax, x + 1.05, 4.95, 5.0, 6.55, color=C_GREY, lw=1)
        box(ax, x, 2.5, 2.1, 0.8, "CouchDB", fc="#eef2f7", ec=C_GREY, fs=8)
        arrow(ax, x + 1.05, 3.85, x + 1.05, 3.35, color=C_GREY)
        box(ax, x + 0.35, 1.2, 1.4, 0.8, "CCAAS\nchaincode", fc=C_LIGHT2, ec=C_ACCENT, fs=7.5)
        arrow(ax, x + 1.05, 2.45, x + 1.05, 2.05, color=C_ACCENT, ls="--")
    # channel membership bands
    ax.add_patch(Rectangle((0.15, 3.7), 9.5, 1.45, fill=False, ec=C_PRIMARY, lw=1.2, ls="--"))
    ax.text(9.75, 5.0, "competency\nchannel\n(all 4)", fontsize=7.5, color=C_PRIMARY, va="center")
    ax.add_patch(Rectangle((0.2, 3.78), 7.3, 0.05, fc=C_ACCENT, ec=C_ACCENT))
    ax.text(5.0, 0.55, "premium channel: Contractor + Insurer only",
            ha="center", fontsize=8, color=C_ACCENT, fontweight="bold")
    ax.text(5, 7.75, "Deployed network topology (4 orgs, 2 channels, CCAAS)",
            ha="center", fontsize=10, style="italic", fontweight="bold")
    save(fig, "F8_topology.png")


if __name__ == "__main__":
    f1_dsrm()
    f2_architecture()
    f3_dataflow()
    f4_sequences()
    f5_abac()
    f6_premium()
    f7_responsibility()
    f8_topology()
    print("All figures generated in", OUT)
