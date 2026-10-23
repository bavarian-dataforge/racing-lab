"""Lässt einen gespeicherten Fahrer (JSON-Export aus Browser oder train.py)
mit eingefrorenen Gewichten auf Strecken fahren – wie „Besten Fahrer testen“.

  python3 replay.py ../../racing-training.json
  python3 replay.py fahrer.json --tracks hairpin nuerburgring
"""
import argparse
import json
import time

from racinglab import reference, tracks

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument("driver", help="JSON mit bestWeights (Architektur 9-10-2)")
parser.add_argument("--tracks", nargs="+", default=tracks.COURSE_IDS, choices=tracks.COURSE_IDS)
args = parser.parse_args()

data = json.load(open(args.driver))
w = data["bestWeights"]
assert data.get("architecture") == [9, 10, 2] and len(w) == reference.N_WEIGHTS, "kein 9-10-2-Fahrer"
logged = {r["trackId"]: r for r in data.get("testResults", [])}
print(f"Fahrer trainiert auf: {data.get('trainingTrackId', 'training')}  ·  bester Score {data['bestScore']:.1f}\n")
print(f"{'Strecke':32} {'Fortschritt':>11} {'Zeit':>9}  Ergebnis")
for tid in args.tracks:
    track = tracks.load(tid)
    t0 = time.perf_counter()
    car, reason, _ = reference.drive(track, w)
    pct = max(0, min(100, car.max / track.total * 100))
    note = ""
    if tid in logged:
        same = abs(logged[tid]["time"] - car.time) < 1e-9 and logged[tid]["reason"] == reason
        note = "  = Browser-Protokoll ✓" if same else f"  ≠ Browser {logged[tid]['time']:.4f} s"
    print(f"{track.name:32} {pct:10.1f} % {car.time:8.4f} s  {reason}{note}   ({time.perf_counter() - t0:.1f} s Rechenzeit)")
