"""Fahrstil-Analyse: Wie oft bremst, rutscht und lenkt ein Fahrer?

  python3 analyze.py ../fahrer/*.json
  python3 analyze.py fahrer.json --track nuerburgring --grip 1.5 --slide 0.75

Ohne Angaben fährt jeder Fahrer auf seiner Trainingsstrecke mit seiner Trainingsphysik.
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
    """Fährt eine Runde und zählt Pedal, Rutschen und Tempo je Zeitschritt."""
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
        "brake": sum(p < 0 for p in pedals) / n * 100,       # Pedal unter 0 = Bremse
        "full_brake": sum(p < -.5 for p in pedals) / n * 100,
        "slip": sum(s > 0 for s in slips) / n * 100,
        "vmin": min(speeds[60:] or speeds) * .72, "vmax": max(speeds) * .72,  # Einheiten/s → km/h
    }


print(f"{'Fahrer':42} {'Strecke':13} {'Physik':36} {'Ergebnis':>16} {'bremst':>7} {'davon >50%':>10} {'rutscht':>8} {'Tempo km/h':>11}")
for f in args.drivers:
    data = json.load(open(f))
    phys = data.get("physics", {"model": "v1"})
    grip = args.grip if args.grip is not None else (phys.get("grip", 0.0) if phys.get("model") == "kamm" else 0.0)
    slide = args.slide if args.slide is not None else phys.get("slide", 1.0)
    track = tracks.load(args.track or data.get("trainingTrackId", "training"))
    r = analyze(data["bestWeights"], track, grip, slide)
    result = f"{r['time']:.2f} s" if r["reason"] == "Runde geschafft!" else f"✗ {r['progress']:.0f} %"
    print(f"{Path(f).name:42} {track.id:13} {describe(grip, slide):36} {result:>16} {r['brake']:6.1f}% "
          f"{r['full_brake']:9.1f}% {r['slip']:7.1f}% {r['vmin']:5.0f}–{r['vmax']:<5.0f}")
