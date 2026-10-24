"""Repeats the same training with several seeds and tests every driver on all tracks.

A single run can be luck. Only when several independent runs (different seeds, otherwise
identical settings) lead to the same result is the result reliable.

For every seed: train.py with these settings → driver JSON → frozen test on all tracks
(as "Test best driver" in the browser). At the end a table and a summary.json.

  python3 seeds.py --seeds 1 2 3 4 5 --generations 14 --pop 80 --grip 0 --clearance
  python3 seeds.py --seeds 1 2 3 --grip 0                         # same without clearance rule
  python3 seeds.py --seeds 1 2 3 --grip 0 --clearance --calm --out ../drivers/my-experiment
"""
import argparse
import datetime
import json
import subprocess
import sys
from pathlib import Path

from racinglab import reference, tracks
from train import describe

HERE = Path(__file__).resolve().parent
SHORT = {"training": "01 Train", "curves": "02 Bends", "oval": "03 Arcs", "hairpin": "04 Tight",
         "reverse": "05 Rev", "nuerburgring": "Nürburg"}

p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
p.add_argument("--seeds", type=int, nargs="+", default=[1, 2, 3, 4, 5])
p.add_argument("--track", default="training", choices=sorted(tracks.TRAINABLE))
p.add_argument("--pop", type=int, default=40)
p.add_argument("--generations", type=int, default=30)
p.add_argument("--grip", type=float, default=1.5, help="grip µ in g (0 = physics as in v1)")
p.add_argument("--slide", type=float, default=0.7, help="sliding friction (1 = v2.1)")
p.add_argument("--clearance", action="store_true", help="clearance rule 2.5 m")
p.add_argument("--calm", action="store_true", help="steering calm")
p.add_argument("--init", help="JSON of an existing driver as the starting point for every seed")
p.add_argument("--out", help="output folder (default: ../drivers/seeds-<settings>-<date>)")
args = p.parse_args()

label = "-".join([args.track, "v1" if not args.grip else f"grip{args.grip:g}" + (f"-slide{args.slide:g}" if args.slide < 1 else ""),
                  *(["clearance"] if args.clearance else []), *(["calm"] if args.calm else []),
                  f"pop{args.pop}", f"gen{args.generations}"])
out = Path(args.out) if args.out else HERE.parent / "drivers" / f"seeds-{label}-{datetime.date.today()}"
out.mkdir(parents=True, exist_ok=True)
print(f"{label} · seeds {' '.join(map(str, args.seeds))} · physics {describe(args.grip, args.slide)} → {out}\n")

rows = []
for seed in args.seeds:
    path = out / f"seed{seed}.json"
    cmd = [sys.executable, str(HERE / "train.py"), "--track", args.track, "--pop", str(args.pop),
           "--generations", str(args.generations), "--seed", str(seed), "--grip", str(args.grip),
           "--slide", str(args.slide), "--out", str(path)]
    cmd += ["--clearance"] * args.clearance + ["--calm"] * args.calm + (["--init", args.init] if args.init else [])
    # keep the full training output per seed as a log, show only the last generation
    log = subprocess.run(cmd, cwd=HERE, capture_output=True, text=True, check=True).stdout
    (out / f"seed{seed}.log").write_text(log)
    last = [line for line in log.splitlines() if line.strip()[:1].isdigit()][-1]
    print(f"seed {seed:>2} trained · last generation: {last.strip()}")

    w = json.load(open(path))["bestWeights"]
    results = {}
    for tid in tracks.COURSE_IDS:
        track = tracks.load(tid)
        car, reason, _ = reference.drive(track, w, args.grip, args.slide)
        results[tid] = {"completed": reason == reference.LAP, "time": car.time,
                        "progressPercent": max(0, min(100, car.max / track.total * 100)), "reason": reason}
    rows.append({"seed": seed, "file": path.name, "results": results})

cell = lambda r: f"✓ {r['time']:.1f}s" if r["completed"] else f"✗ {r['progressPercent']:.0f}%"
print(f"\n{'seed':>4}  " + "  ".join(f"{SHORT[t]:>9}" for t in tracks.COURSE_IDS) + "   all")
for row in rows:
    r = row["results"]
    print(f"{row['seed']:4d}  " + "  ".join(f"{cell(r[t]):>9}" for t in tracks.COURSE_IDS)
          + f"   {sum(x['completed'] for x in r.values())}/{len(r)}")
counts = {t: sum(row["results"][t]["completed"] for row in rows) for t in tracks.COURSE_IDS}
print(f"{'laps':>4}  " + "  ".join(f"{f'{counts[t]}/{len(rows)}':>9}" for t in tracks.COURSE_IDS))

with open(out / "summary.json", "w") as f:
    json.dump({"createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
               "settings": {k: v for k, v in vars(args).items() if k != "out"}, "physics": describe(args.grip, args.slide),
               "lapsPerTrack": counts, "runs": rows}, f, indent=1)
print(f"\nSaved: {out}/seed<N>.json (load in the browser), seed<N>.log, summary.json")
