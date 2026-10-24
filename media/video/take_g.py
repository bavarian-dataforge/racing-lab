import json, sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
D = sys.argv[1]; OUT = sys.argv[2]
def load(name):
    s = json.load(open(f"{D}/{name}/summary.json"))["lapsPerTrack"]
    return sum(s[t] for t in ("curves", "oval", "hairpin", "reverse")), s["nuerburgring"]
rows = [("ohne Abstandsregel", *load("seeds-training-v1-pop80-gen14-2026-10-24")),
        ("mit Abstandsregel 2,5 m", *load("seeds-training-v1-clearance-pop80-gen14-2026-10-24"))]
BG, INK, MUTED, ORANGE, BAR = "#f3f1e8", "#20383c", "#52656a", "#f47342", "#d7dcd1"
plt.rcParams["font.family"] = "Arial"
fig = plt.figure(figsize=(19.2, 10.8), dpi=100, facecolor=BG)
ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, 1920); ax.set_ylim(1080, 0); ax.axis("off")
ax.text(140, 150, "JE 5 DURCHLÄUFE (SEEDS) · ALLES GLEICH BIS AUF DIE REGEL", fontsize=20, color=MUTED, family="monospace")
ax.text(140, 250, "Hilft die Abstandsregel?", fontsize=64, color=INK, weight="bold")
cols = [("Teststrecken 02–05", 20, 1), ("Nürburgring", 5, 2)]
x0 = [700, 1330]; w = 480
for j, (title, total, k) in enumerate(cols):
    ax.text(x0[j], 380, title, fontsize=28, color=INK, weight="bold")
    for i, row in enumerate(rows):
        y = 450 + i * 190; v = row[k]
        ax.add_patch(FancyBboxPatch((x0[j], y), w, 70, boxstyle="round,pad=0,rounding_size=10", fc=BAR, ec="none"))
        ax.add_patch(FancyBboxPatch((x0[j], y), max(w * v / total, 1), 70, boxstyle="round,pad=0,rounding_size=10",
                                    fc=ORANGE if i else INK, ec="none"))
        ax.text(x0[j], y + 130, f"{v}/{total} Runden", fontsize=30, color=INK, weight="bold")
for i, row in enumerate(rows):
    ax.text(140, 450 + i * 190 + 48, row[0], fontsize=32, color=INK if i == 0 else ORANGE, weight="bold")
ax.text(140, 900, "Auf den Teststrecken hilft die Regel – auf dem Nürburgring nicht. Gebremst hat noch keiner.", fontsize=30, color=INK)
ax.text(140, 960, "Physik ohne Grip-Limit (v1) · 80 Autos · 14 Generationen · trainiert nur auf Testkurs 01", fontsize=20, color=MUTED)
fig.savefig(OUT, facecolor=BG); print(rows)
