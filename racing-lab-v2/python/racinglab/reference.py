"""Referenz-Simulation: ein Wagen, Schritt für Schritt, in reinem Python.

Bewusst langsam und gut lesbar. Rechnet exakt wie sim.js, damit ein im
Browser trainierter Fahrer hier dieselbe Runde fährt (siehe replay.py).
"""
import math
from dataclasses import dataclass, field

from .tracks import Track

DT = 1 / 60                                           # fester Zeitschritt
ANGLES = [-1.55, -1.05, -.5, 0, .5, 1.05, 1.55]       # Sensorrichtungen relativ zum Wagen (rad)
SENSOR_RANGE = 180                                    # 36 m
N_WEIGHTS = 122                                       # 10×(1+9) + 2×(1+10)
G = 9.81 * 5                                          # Erdbeschleunigung in Einheiten/s² (1 m = 5 Einheiten)
CLEAR = 2.5 * 5                                       # Abstandsregel: seitlicher Mindestabstand 2,5 m
CLEAR_WEIGHT = 100                                    # Punktabzug je Sekunde bei voller Unterschreitung


def predict(inputs, w):
    """Netz 9 → 10 → 2, beide Ebenen tanh. Gewichtsreihenfolge wie im Browser:
    je Neuron erst der Bias, dann die Gewichte seiner Eingänge."""
    z, hidden = 0, []
    for _ in range(10):
        v = w[z]; z += 1
        for i in range(9):
            v += w[z] * inputs[i]; z += 1
        hidden.append(math.tanh(v))
    out = []
    for _ in range(2):
        v = w[z]; z += 1
        for j in range(10):
            v += w[z] * hidden[j]; z += 1
        out.append(math.tanh(v))
    return out   # [Lenkung, Fahrpedal], jeweils −1 … +1


@dataclass
class Car:
    x: float
    y: float
    a: float
    v: float = 0.0
    omega: float = 0.0
    i: int = 0             # Index des nächsten Mittellinienpunkts
    progress: float = 0.0  # gerichteter Fortschritt entlang der Strecke
    max: float = 0.0
    time: float = 0.0
    stall: float = 0.0
    slip: float = 0.0      # 0 = haftet, >0 = rutscht (Anteil der nicht umsetzbaren Drehrate)
    grip_use: float = 0.0  # genutzte Haftung: |Beschleunigung| / (µ·g)
    sliding: bool = False  # rutschte im vorigen Schritt → nur Gleitreibung verfügbar
    near: float = 0.0      # Zeit unter dem Mindestabstand, gewichtet mit der Unterschreitung (0…1)
    sensors: list = field(default_factory=list)
    last: tuple = None     # Position im vorigen Schritt


def start_car(track: Track):
    p, n = track.pts[0], track.pts[1]
    car = Car(p[0], p[1], math.atan2(n[1] - p[1], n[0] - p[0]))
    car.last = (p[0], p[1])
    return car


def nearest(track, x, y, center, rng):
    """Projiziert (x, y) auf die nahen Mittellinien-Segmente.
    Ergebnis: Index, Abstand, Lauflänge s, liegt der Punkt rechts?"""
    best, M, pts = None, track.M, track.pts
    for k in range(center - rng, center + rng + 1):
        i = k % M
        p, q = pts[i], pts[(i + 1) % M]
        dx, dy = q[0] - p[0], q[1] - p[1]
        t = max(0, min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / (dx * dx + dy * dy)))
        d = math.hypot(x - p[0] - t * dx, y - p[1] - t * dy)
        if best is None or d < best[1]:
            best = (i, d, track.ds[i] + t * math.hypot(dx, dy), dx * (y - p[1]) - dy * (x - p[0]) >= 0)
    return best


def sense(track, c):
    """Sieben Strahlen: Abstand bis zur ersten Begrenzung (max. 180)."""
    out, M, win = [], track.M, track.sensor_window
    for angle in ANGLES:
        dx, dy = math.cos(c.a + angle), math.sin(c.a + angle)
        dist = SENSOR_RANGE
        for k in range(c.i - win, c.i + win):
            for side in (0, 1):
                p, q = track.edges[k % M][side], track.edges[(k + 1) % M][side]
                sx, sy = q[0] - p[0], q[1] - p[1]
                den = dx * sy - dy * sx
                if abs(den) < 1e-8:
                    continue
                px, py = p[0] - c.x, p[1] - c.y
                t = (px * sy - py * sx) / den      # Entfernung entlang des Strahls
                u = (px * dy - py * dx) / den      # Position auf dem Wandsegment (0…1)
                if t >= 0 and 0 <= u <= 1:
                    dist = min(dist, t)
        out.append(dist)
    return out


def physics_grip(c, steer, pedal, a_max, slide=1.0):
    """Haftungsgrenze nach dem Kammschen Kreis: Die Reifen übertragen höchstens a_max.

    1. Kurvenfahrt hat Vorrang: Querbeschleunigung = v · Drehrate (höchstens a_max).
    2. Für Gas/Bremse bleibt nur der Rest: sqrt(a_max² − quer²).
    3. Verlangt die Lenkung mehr als a_max, rutscht der Wagen: Die Drehrate wird auf
       a_max / v begrenzt (er schiebt nach außen) und Reibung kostet Tempo.
    4. Gleitreibung (slide < 1, ab v2.2): Ein rutschender Reifen hält nur slide · a_max.
       Wer rutscht, verliert also Seitenführung UND Bremskraft – bis er so langsam
       bzw. gerade fährt, dass die Gleitreibung wieder reicht (Kontrollverlust).
       slide = 1 entspricht genau v2.1.
    """
    limit = a_max * slide if c.sliding else a_max
    lat = min(c.v * abs(c.v / 22 * math.tan(steer * .52)), limit)
    avail = math.sqrt(limit * limit - lat * lat)
    tire = max(-avail, min(avail, pedal * (85 if pedal > 0 else 140)))
    c.v = max(0, min(170, c.v + (tire - .13 * c.v) * DT))
    wanted = c.v / 22 * math.tan(steer * .52)
    if c.v > 0 and abs(wanted) * c.v > limit:
        omega_max = limit / c.v
        c.slip = 1 - omega_max / abs(wanted)
        c.omega = math.copysign(omega_max, wanted)
        c.v = max(0, c.v - c.slip * .5 * limit * DT)
        c.sliding = True
    else:
        c.slip, c.omega, c.sliding = 0, wanted, False
    c.grip_use = math.hypot(tire, c.v * c.omega) / a_max


def advance(track, c, w, grip=0.0, slide=1.0):
    """Ein Zeitschritt. Gibt den Abbruchgrund zurück oder None.

    grip = 0: Physik wie v1 (keine Haftungsgrenze).
    grip > 0: Kammscher Kreis mit µ = grip, siehe physics_grip().
    slide < 1: Gleitreibung als Anteil von µ (Kontrollverlust beim Rutschen).
    """
    c.sensors = sense(track, c)
    # Abstandsregel messen: seitliche Strahlen (links, rechts) gegen den Mindestabstand
    d = min(c.sensors[0], c.sensors[6])
    if d < CLEAR:
        c.near += (CLEAR - d) / CLEAR * DT
    steer, pedal = predict([s / 180 for s in c.sensors] + [c.v / 160, c.omega / 4], w)
    if grip:
        physics_grip(c, steer, pedal, grip * G, slide)
    else:
        # Fahrzeugmodell v1 (kinematisch, ohne Reifenhaftung)
        c.v = max(0, min(170, c.v + (pedal * (85 if pedal > 0 else 140) - .13 * c.v) * DT))
        c.omega = c.v / 22 * math.tan(steer * .52)
        c.slip, c.grip_use = 0, math.hypot(pedal * (85 if pedal > 0 else 140), c.v * c.omega) / (1.5 * G)
    c.a += c.omega * DT
    c.x += math.cos(c.a) * c.v * DT
    c.y += math.sin(c.a) * c.v * DT
    c.time += DT
    # Fortschritt = Änderung der Lauflänge, über die Ziellinie hinweg korrigiert
    old = nearest(track, c.last[0], c.last[1], c.i, 5)
    n = nearest(track, c.x, c.y, c.i, 7)
    delta = n[2] - old[2]
    if delta < -track.total / 2:
        delta += track.total
    if delta > track.total / 2:
        delta -= track.total
    c.progress += delta
    c.i = n[0]
    if c.progress > c.max + .05:
        c.max, c.stall = c.progress, 0
    else:
        c.stall += DT
    c.last = (c.x, c.y)
    if n[1] > track.half_w[n[0]][0 if n[3] else 1] - 7:
        return "Wandkontakt"
    if c.progress >= track.total:
        return "Runde geschafft!"
    if c.stall > 3:
        return "Kein Fortschritt"
    if c.time > track.time_limit:
        return "Zeitlimit"
    return None


def score(track, c, clearance=False):
    """Bewertung: Fortschritt (max. eine Runde) − 0,6 × Zeit + 500 für eine volle Runde.
    Mit Abstandsregel zusätzlich: − 100 × (Zeit nahe der Wand, gewichtet nach Unterschreitung)."""
    base = min(c.progress, track.total) - c.time * .6 + (500 if c.progress >= track.total else 0)
    return base - CLEAR_WEIGHT * c.near if clearance else base


def drive(track, w, grip=0.0, slide=1.0, on_step=None, clearance=False):
    """Fährt einen kompletten Versuch und gibt (Wagen, Grund, Score) zurück."""
    c = start_car(track)
    while True:
        reason = advance(track, c, w, grip, slide)
        if on_step:
            on_step(c)
        if reason:
            return c, reason, score(track, c, clearance)
