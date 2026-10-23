"""Drives a saved driver (JSON export from the browser or train.py) with frozen weights on
the tracks – like "Test best driver" in the browser.

  python3 replay.py ../../racing-training.json
  python3 replay.py driver.json --tracks hairpin nuerburgring
"""
import argparse
import json
import time

from racinglab import reference, tracks
from train import describe

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument("driver", help="JSON with bestWeights (architecture 9-10-2)")
parser.add_argument("--grip", type=float, help="grip µ in g; default: as in training (0 = v1)")
parser.add_argument("--slide", type=float, help="sliding friction; default: as in training (1 = v2.1)")
parser.add_argument("--tracks", nargs="+", default=tracks.COURSE_IDS, choices=tracks.COURSE_IDS)
args = parser.parse_args()

data = json.load(open(args.driver))
w = data["bestWeights"]
assert data.get("architecture") == [9, 10, 2] and len(w) == reference.N_WEIGHTS, "not a 9-10-2 driver"
trained = data.get("physics", {"model": "v1"})
trained_grip = trained.get("grip", 0.0) if trained.get("model") == "kamm" else 0.0
trained_slide = trained.get("slide", 1.0)
grip = trained_grip if args.grip is None else args.grip
slide = trained_slide if args.slide is None else args.slide
# Logged runs can only be compared when driven with the same physics.
same_physics = grip == trained_grip and (not grip or slide == trained_slide)
logged = {r["trackId"]: r for r in data.get("testResults", [])} if same_physics else {}
meta = data.get("meta", {})
print(f"Driver trained on: {meta.get('trainingTrack', data.get('trainingTrackId', 'training'))}  ·  best score {data['bestScore']:.1f}")
print(f"Learning method: {meta.get('algorithm', data.get('algorithm', 'unknown'))}  ·  trained: {meta.get('trainedAt') or 'date unknown'}")
print(f"Physics: {describe(grip, slide)}\n")
print(f"{'Track':34} {'progress':>9} {'time':>10}  result")
for tid in args.tracks:
    track = tracks.load(tid)
    t0 = time.perf_counter()
    car, reason, _ = reference.drive(track, w, grip, slide)
    pct = max(0, min(100, car.max / track.total * 100))
    note = ""
    if tid in logged:
        same = abs(logged[tid]["time"] - car.time) < 1e-9 and reference.norm_reason(logged[tid]["reason"]) == reason
        note = "  = logged run ✓" if same else f"  ≠ logged {logged[tid]['time']:.4f} s"
    print(f"{track.name:34} {pct:8.1f} % {car.time:8.4f} s  {reason}{note}   ({time.perf_counter() - t0:.1f} s compute)")
