"""Rechnet die TUM-Streckendaten des Nürburgrings in Simulationseinheiten um.

Quelle: TUMFTM racetrack-database, tracks/Nuerburgring.csv (LGPL-3.0)
Spalten: x_m, y_m, w_tr_right_m, w_tr_left_m (Mittellinie und Breiten in Metern)

Ausgabe:
  tracks/nuerburgring.json  -> wird von der Python-Simulation gelesen
  tracks/nuerburgring.js    -> wird vom Browser geladen (file:// kann kein JSON holen)

Aufruf aus racing-lab-v2/:  python3 python/tools/build_nuerburgring.py
"""
import csv
import json
import math
from pathlib import Path

UNITS_PER_METER = 5          # wie im Prototyp: 1 Einheit = 0,2 m
CANVAS_W, CANVAS_H, MARGIN = 1200, 800, 40

root = Path(__file__).resolve().parents[2]
rows = []
with open(root / "data" / "Nuerburgring.csv") as f:
    for row in csv.reader(f):
        if row and not row[0].startswith("#"):
            rows.append([float(v) for v in row])

# Bildschirm-y zeigt nach unten: y spiegeln, damit Norden oben bleibt und
# die Strecke nicht seitenverkehrt erscheint.
xy = [(x, -y) for x, y, _, _ in rows]
widths = [(wr, wl) for _, _, wr, wl in rows]


def bbox(points):
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    return min(xs), min(ys), max(xs), max(ys)


def rotate(points, angle):
    c, s = math.cos(angle), math.sin(angle)
    return [(x * c - y * s, x * s + y * c) for x, y in points]


def fit_scale(points):
    x0, y0, x1, y1 = bbox(points)
    return min((CANVAS_W - 2 * MARGIN) / (x1 - x0), (CANVAS_H - 2 * MARGIN) / (y1 - y0))


# Drehen, bis die Strecke die 3:2-Zeichenfläche möglichst groß ausfüllt.
best_angle = max((math.radians(d) for d in range(180)), key=lambda a: fit_scale(rotate(xy, a)))
pts = rotate(xy, best_angle)
x0, y0, x1, y1 = bbox(pts)
pts = [((x - x0) * UNITS_PER_METER, (y - y0) * UNITS_PER_METER) for x, y in pts]
w = [(wr * UNITS_PER_METER, wl * UNITS_PER_METER) for wr, wl in widths]

# Ansicht: Bildschirm = Welt * s + Versatz (zentriert)
wx, wy = (x1 - x0) * UNITS_PER_METER, (y1 - y0) * UNITS_PER_METER
s = min((CANVAS_W - 2 * MARGIN) / wx, (CANVAS_H - 2 * MARGIN) / wy)
view = {"s": round(s, 6), "ox": round((CANVAS_W - wx * s) / 2, 3), "oy": round((CANVAS_H - wy * s) / 2, 3)}

length_m = sum(math.dist(xy[i], xy[(i + 1) % len(xy)]) for i in range(len(xy)))
track = {
    "name": "Nürburgring · GP-Strecke",
    "lengthMeters": round(length_m, 1),
    "source": "TUMFTM racetrack-database, tracks/Nuerburgring.csv, LGPL-3.0",
    "rotationDegrees": round(math.degrees(best_angle)),
    "unitsPerMeter": UNITS_PER_METER,
    "timeLimit": 600,
    "sensorWindow": 12,
    "points": [[round(x, 3), round(y, 3)] for x, y in pts],
    "widths": [[round(a, 3), round(b, 3)] for a, b in w],
    "view": view,
}
(root / "tracks").mkdir(exist_ok=True)
(root / "tracks" / "nuerburgring.json").write_text(json.dumps(track))
(root / "tracks" / "nuerburgring.js").write_text(
    "// Erzeugt von python/tools/build_nuerburgring.py – nicht von Hand ändern.\n"
    "window.RACING_TRACKS=window.RACING_TRACKS||{};\n"
    f"window.RACING_TRACKS.nuerburgring={json.dumps(track)};\n"
)
print(f"{len(pts)} Punkte, {length_m:.0f} m, Drehung {math.degrees(best_angle):.0f}°, "
      f"Ansicht s={s:.4f} ({1 / s / UNITS_PER_METER:.2f} m pro Pixel)")
