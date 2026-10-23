"""Driving-style analysis: how often does a driver brake, slide and steer?

  python3 analyze.py ../drivers/*.json
  python3 analyze.py driver.json --track nuerburgring --grip 1.5 --slide 0.7

Without options every driver drives on its training track with its training physics.
"""
import argparse
import json
from pathlib import Path

from racinglab import reference, tracks
from train import describe

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument("drivers", nargs="+")
parser.add_argument("--track", choices=tracks.COURSE_IDS)
parser.add_argument("--grip", type=float)
parser.add_argument("--slide", type=float)
args = parser.parse_args()


def analyze(w, track, grip, slide):
    """Drives one lap and counts throttle, sliding and speed per time step."""
    pedals, slips, speeds = [], [], []
    original = reference.predict

    def spy(inputs, weights):
        out = original(inputs, weights)
        pedals.append(out[1])
        return out

    reference.predict = spy
    try:
        car, reason, _ = reference.drive(track, w, grip, slide,
                                         on_step=lambda c: (slips.append(c.slip), speeds.append(c.v)))
    finally:
        reference.predict = original
    n = len(pedals)
    return {
        "reason": reason, "time": car.time, "progress": min(100, car.max / track.total * 100),
        "brake": sum(p < 0 for p in pedals) / n * 100,       # pedal below 0 = brake
        "full_brake": sum(p < -.5 for p in pedals) / n * 100,
        "slip": sum(s > 0 for s in slips) / n * 100,
        "vmin": min(speeds[60:] or speeds) * .72, "vmax": max(speeds) * .72,  # units/s → km/h
    }


print(f"{'Driver':50} {'track':13} {'physics':42} {'result':>10} {'brakes':>7} {'of it >50%':>10} {'slides':>7} {'speed km/h':>11}")
for f in args.drivers:
    data = json.load(open(f))
    phys = data.get("physics", {"model": "v1"})
    grip = args.grip if args.grip is not None else (phys.get("grip", 0.0) if phys.get("model") == "kamm" else 0.0)
    slide = args.slide if args.slide is not None else phys.get("slide", 1.0)
    track = tracks.load(args.track or data.get("trainingTrackId", "training"))
    r = analyze(data["bestWeights"], track, grip, slide)
    result = f"{r['time']:.2f} s" if r["reason"] == reference.LAP else f"✗ {r['progress']:.0f} %"
    print(f"{Path(f).name:50} {track.id:13} {describe(grip, slide):42} {result:>10} {r['brake']:6.1f}% "
          f"{r['full_brake']:9.1f}% {r['slip']:6.1f}% {r['vmin']:5.0f}–{r['vmax']:<5.0f}")
