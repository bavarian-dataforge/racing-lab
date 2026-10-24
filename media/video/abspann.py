"""End card of the video, same style as take_g.py. With blender-logo.png next to this script, "Made with" is followed by the logo.

  python3 abspann.py "Stand: 24.10.2026" abspann.png
"""
import os, sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
HERE = os.path.dirname(os.path.abspath(__file__))
DATE, OUT = sys.argv[1], sys.argv[2]
LOGO = os.path.join(HERE, "blender-logo.png")
BG, INK, MUTED, ORANGE = "#f3f1e8", "#20383c", "#52656a", "#f47342"
plt.rcParams["font.family"] = "Arial"
fig = plt.figure(figsize=(19.2, 10.8), dpi=100, facecolor=BG)
ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, 1920); ax.set_ylim(1080, 0); ax.axis("off")
ax.text(140, 290, "EIN LERNPROJEKT · NEURONALES NETZ + GENETISCHER ALGORITHMUS", fontsize=20, color=MUTED, family="monospace")
ax.text(140, 450, "Racing Lab", fontsize=96, color=INK, weight="bold")
ax.text(140, 560, "github.com/bavarian-dataforge/racing-lab", fontsize=40, color=ORANGE, family="monospace")
ax.text(140, 650, DATE, fontsize=30, color=MUTED)
if os.path.exists(LOGO):   # the logo carries the word "blender" itself: "Made with" + logo
    t = ax.text(140, 955, "Made with", fontsize=30, color=INK, weight="bold")
    x = ax.transData.inverted().transform(t.get_window_extent(fig.canvas.get_renderer()))[1][0] + 25
    img = plt.imread(LOGO)
    h = 80; w = h * img.shape[1] / img.shape[0]   # logo 80 px high, keeps its proportions
    ax.imshow(img, extent=(x, x + w, 955 + 0.27 * h, 955 - 0.73 * h), zorder=2)   # word baseline at 73 % of the logo height
else:
    ax.text(140, 955, "Made with Blender", fontsize=30, color=INK, weight="bold")
ax.set_xlim(0, 1920); ax.set_ylim(1080, 0)   # imshow resets the limits
fig.savefig(OUT, facecolor=BG)
print("Logo:", "ja" if os.path.exists(LOGO) else "nein (blender-logo.png fehlt)")
