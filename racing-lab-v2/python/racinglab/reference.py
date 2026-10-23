"""Reference simulation: one car, step by step, in plain Python.

Deliberately slow and easy to read. Calculates exactly like sim.js, so a driver
trained in the browser drives the same lap here (see replay.py).
"""
import math
from dataclasses import dataclass, field

from .tracks import Track

DT = 1 / 60                                           # fixed time step
ANGLES = [-1.55, -1.05, -.5, 0, .5, 1.05, 1.55]       # sensor directions relative to the car (rad)
SENSOR_RANGE = 180                                    # 36 m
N_WEIGHTS = 122                                       # 10×(1+9) + 2×(1+10)
G = 9.81 * 5                                          # gravity in units/s² (1 m = 5 units)
CLEAR = 2.5 * 5                                       # clearance rule: minimum side clearance 2.5 m
CLEAR_WEIGHT = 100                                    # points deducted per second at full shortfall
# Steering calm (v2.9): the drivers oscillate around the racing line – in control terms a
# controller with too much gain and too little damping. A rule cannot be programmed into a
# network, so calm steering is rewarded through the performance criterion: every steering
# change costs points. The measure is steering travel Σ|Δsteering| (how far the wheel is moved
# in total), which captures back-and-forth oscillation directly. Squared changes were rejected:
# they mostly punish single large inputs (e.g. at the start) rather than constant oscillation.
# Calibrated on existing drivers (test track 01): calm 32–43, nervous ~60 units of travel.
# At 2 points per unit the rule separates calm from nervous by about 35 points, whereas a few
# tenths of lap time are < 1 point. The lap bonus (500) stays dominant.
CALM_WEIGHT = 2                                       # points deducted per unit of steering travel

# Results of an attempt. Files from before v3.0 contain the German texts; norm_reason()
# translates them so old and new files can be compared.
LAP, WALL, STALL, TIME_LIMIT = "Lap completed!", "Wall contact", "No progress", "Time limit"
LEGACY = {"Runde geschafft!": LAP, "Wandkontakt": WALL, "Kein Fortschritt": STALL, "Zeitlimit": TIME_LIMIT}


def norm_reason(reason):
    return LEGACY.get(reason, reason)


def predict(inputs, w):
    """Network 9 → 10 → 2, both layers tanh. Weight order as in the browser:
    per neuron first the bias, then the weights of its inputs."""
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
    return out   # [steering, throttle], each −1 … +1


@dataclass
class Car:
    x: float
    y: float
    a: float
    v: float = 0.0
    omega: float = 0.0
    i: int = 0             # index of the nearest centre-line point
    progress: float = 0.0  # directed progress along the track
    max: float = 0.0
    time: float = 0.0
    stall: float = 0.0
    slip: float = 0.0      # 0 = grips, >0 = slides (share of yaw rate that cannot be achieved)
    grip_use: float = 0.0  # grip used: |acceleration| / (µ·g)
    sliding: bool = False  # slid in the previous step → only sliding friction available
    near: float = 0.0      # time below the minimum clearance, weighted by the shortfall (0…1)
    steer_travel: float = 0.0  # steering travel Σ|Δsteering| over the run (steering calm)
    last_steer: float = 0.0    # steering in the previous time step
    sensors: list = field(default_factory=list)
    last: tuple = None     # position in the previous step


def start_car(track: Track):
    p, n = track.pts[0], track.pts[1]
    car = Car(p[0], p[1], math.atan2(n[1] - p[1], n[0] - p[0]))
    car.last = (p[0], p[1])
    return car


def nearest(track, x, y, center, rng):
    """Projects (x, y) onto the nearby centre-line segments.
    Result: index, distance, distance along the track s, is the point on the right?"""
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
    """Seven rays: distance to the first boundary (max. 180)."""
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
                t = (px * sy - py * sx) / den      # distance along the ray
                u = (px * dy - py * dx) / den      # position on the wall segment (0…1)
                if t >= 0 and 0 <= u <= 1:
                    dist = min(dist, t)
        out.append(dist)
    return out


def physics_grip(c, steer, pedal, a_max, slide=1.0):
    """Grip limit after Kamm's circle: the tyres transfer at most a_max.

    1. Cornering has priority: lateral acceleration = v · yaw rate (at most a_max).
    2. Throttle/brake only get the rest: sqrt(a_max² − lateral²).
    3. If the steering asks for more than a_max, the car slides: the yaw rate is limited
       to a_max / v (it pushes outwards) and friction costs speed.
    4. Sliding friction (slide < 1, from v2.2): a sliding tyre only holds slide · a_max.
       A sliding car therefore loses lateral grip AND braking force – until it is slow or
       straight enough for sliding friction to suffice again (loss of control).
       slide = 1 is exactly v2.1.
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
    """One time step. Returns the reason the attempt ended, or None.

    grip = 0: physics as in v1 (no grip limit).
    grip > 0: Kamm's circle with µ = grip, see physics_grip().
    slide < 1: sliding friction as a share of µ (loss of control when sliding).
    """
    c.sensors = sense(track, c)
    # measure the clearance rule: side rays (left, right) against the minimum clearance
    d = min(c.sensors[0], c.sensors[6])
    if d < CLEAR:
        c.near += (CLEAR - d) / CLEAR * DT
    steer, pedal = predict([s / 180 for s in c.sensors] + [c.v / 160, c.omega / 4], w)
    # measure steering calm (only scored with steering calm): travel since the previous step
    c.steer_travel += abs(steer - c.last_steer)
    c.last_steer = steer
    if grip:
        physics_grip(c, steer, pedal, grip * G, slide)
    else:
        # vehicle model v1 (kinematic, without tyre grip)
        c.v = max(0, min(170, c.v + (pedal * (85 if pedal > 0 else 140) - .13 * c.v) * DT))
        c.omega = c.v / 22 * math.tan(steer * .52)
        c.slip, c.grip_use = 0, math.hypot(pedal * (85 if pedal > 0 else 140), c.v * c.omega) / (1.5 * G)
    c.a += c.omega * DT
    c.x += math.cos(c.a) * c.v * DT
    c.y += math.sin(c.a) * c.v * DT
    c.time += DT
    # progress = change of distance along the track, corrected across the finish line
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
        return WALL
    if c.progress >= track.total:
        return LAP
    if c.stall > 3:
        return STALL
    if c.time > track.time_limit:
        return TIME_LIMIT
    return None


def score(track, c, clearance=False, calm=False):
    """Score: progress (at most one lap) − 0.6 × time + 500 for a full lap.
    With the clearance rule additionally: − 100 × (time near the wall, weighted by shortfall).
    With steering calm additionally:      − 2 × steering travel Σ|Δsteering|.
    Deductions in the same order as in sim.js (scoreOf), so the scores are bit-identical."""
    s = min(c.progress, track.total) - c.time * .6 + (500 if c.progress >= track.total else 0)
    if clearance:
        s -= CLEAR_WEIGHT * c.near
    if calm:
        s -= CALM_WEIGHT * c.steer_travel
    return s


def drive(track, w, grip=0.0, slide=1.0, on_step=None, clearance=False, calm=False):
    """Drives a complete attempt and returns (car, reason, score)."""
    c = start_car(track)
    while True:
        reason = advance(track, c, w, grip, slide)
        if on_step:
            on_step(c)
        if reason:
            return c, reason, score(track, c, clearance, calm)
