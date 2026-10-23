"""Strecken: gleiche Geometrie wie im Browser (sim.js, Funktion geometry)."""
import json
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]  # racing-lab-v2/

BASE_NODES = [[260, 630], [130, 480], [160, 250], [340, 155], [620, 155], [790, 270],
              [1030, 200], [1080, 420], [900, 610], [670, 620], [530, 450], [390, 520]]
NODE_COURSES = {
    "training": ("Testkurs 01 · Trainingsstrecke", BASE_NODES),
    "curves": ("Testkurs 02 · Wechselkurven", [[260, 630], [130, 480], [160, 285], [330, 165], [540, 180], [685, 300], [850, 175], [1050, 260], [1060, 470], [900, 635], [705, 510], [480, 635]]),
    "oval": ("Testkurs 03 · Weite Bögen", [[280, 620], [145, 490], [130, 300], [270, 170], [480, 135], [720, 135], [940, 180], [1070, 315], [1050, 500], [890, 635], [675, 670], [455, 660]]),
    "hairpin": ("Testkurs 04 · Enge Kurven", [[200, 640], [125, 450], [150, 180], [380, 150], [410, 390], [570, 400], [620, 170], [1020, 160], [1080, 450], [920, 650], [670, 620], [440, 610]]),
    "reverse": ("Testkurs 05 · Gegenrichtung", [BASE_NODES[0], *reversed(BASE_NODES[1:])]),
}
COURSE_IDS = [*NODE_COURSES, "nuerburgring"]
TRAINABLE = {"training", "nuerburgring"}


@dataclass
class Track:
    id: str
    name: str
    pts: list            # Mittellinie [[x, y], ...]
    half_w: list         # [[rechts, links], ...] halbe Breite je Punkt
    ds: list             # Lauflänge bis Punkt i
    total: float
    edges: list          # [[rechter Punkt, linker Punkt], ...]
    sensor_window: int
    time_limit: float

    @property
    def M(self):
        return len(self.pts)

    def arrays(self):
        """Numpy-Kopien für die vektorisierte Simulation."""
        return (np.array(self.pts), np.array(self.ds[:-1]), np.array(self.edges),
                np.array(self.half_w))


def catmull_rom(nodes):
    """Geschlossene Catmull-Rom-Kurve, 24 Stichproben je Abschnitt (wie sim.js)."""
    N, pts = len(nodes), []
    for j in range(N):
        a, b, c, d = nodes[(j - 1) % N], nodes[j], nodes[(j + 1) % N], nodes[(j + 2) % N]
        for q in range(24):
            t = q / 24
            pts.append([.5 * (2 * b[k] + (-a[k] + c[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t * t
                              + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t * t * t) for k in (0, 1)])
    return pts


def load(track_id):
    if track_id in NODE_COURSES:
        name, nodes = NODE_COURSES[track_id]
        pts = catmull_rom(nodes)
        half_w = [[30, 30] for _ in pts]
        window, limit = 34, 70
    elif track_id == "nuerburgring":
        data = json.loads((ROOT / "tracks" / "nuerburgring.json").read_text())
        name, pts, half_w = data["name"], data["points"], data["widths"]
        window, limit = data["sensorWindow"], data["timeLimit"]
    else:
        raise ValueError(f"Unbekannte Strecke: {track_id}")
    M, ds, edges, total = len(pts), [0.0], [], 0.0
    for i in range(M):
        p, n, prev = pts[i], pts[(i + 1) % M], pts[(i - 1) % M]
        dx, dy = n[0] - prev[0], n[1] - prev[1]
        l = math.hypot(dx, dy)
        wr, wl = half_w[i]
        edges.append([[p[0] - dy / l * wr, p[1] + dx / l * wr], [p[0] + dy / l * wl, p[1] - dx / l * wl]])
        total += math.hypot(n[0] - p[0], n[1] - p[1])
        ds.append(total)
    return Track(track_id, name, pts, half_w, ds, total, edges, window, limit)
