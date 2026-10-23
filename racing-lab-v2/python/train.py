"""Trains a driver with a population (genetic algorithm) or a single car (hill climbing).

In population mode all cars of a generation drive in parallel on several CPU cores. The
result is a JSON file that the browser takes over via "Load JSON state".

  python3 train.py --track training --generations 30              # grip 1.5 g + sliding friction (v2.2)
  python3 train.py --track training --slide 1                      # grip without sliding friction (v2.1)
  python3 train.py --track training --grip 0                       # physics as in v1, no grip limit
  python3 train.py --track nuerburgring --generations 40 --pop 40 --seed 7
  python3 train.py --track nuerburgring --init ../../racing-training.json   # start from an existing driver
  python3 train.py --method single --attempts 300 --grip 0         # single car as in v1 (hill climbing)
  python3 train.py --grip 0 --clearance                            # with clearance rule (2.5 m to the wall)
  python3 train.py --grip 0 --calm                                 # with steering calm (steering travel costs points)
  python3 train.py --grip 0 --clearance --calm                     # both combined
"""
import argparse
import datetime
import json
import os
import time
from multiprocessing import Pool

from racinglab import reference, tracks
from racinglab.ga import Evolution

_track, _grip, _slide, _clear, _calm = None, 0.0, 1.0, False, False


def _init(track_id, grip, slide, clearance=False, calm=False):
    global _track, _grip, _slide, _clear, _calm
    _track, _grip, _slide, _clear, _calm = tracks.load(track_id), grip, slide, clearance, calm


def evaluate(w):
    car, reason, score = reference.drive(_track, w, _grip, _slide, clearance=_clear, calm=_calm)
    return score, car.max, car.time, reason


def physics(grip, slide):
    return {"model": "kamm", "grip": grip, "slide": slide} if grip else {"model": "v1"}


def scoring(args):
    """Scoring in words and as data – same wording and model names as in the browser.
    Models: standard · abstand (clearance) · ruhe (calm) · abstand+ruhe; the model names are
    kept as stored in existing data files."""
    clear, calm = getattr(args, "clearance", False), getattr(args, "calm", False)
    if not (clear or calm):
        return "Standard", {"model": "standard"}
    data = {"model": "+".join(m for m, on in (("abstand", clear), ("ruhe", calm)) if on)}
    if clear:
        data.update(minDistanceM=2.5, weight=reference.CLEAR_WEIGHT)
    if calm:
        data.update(calmWeight=reference.CALM_WEIGHT)
    text = " + ".join(t for t, on in (("clearance rule 2.5 m", clear), ("steering calm", calm)) if on)
    return "with " + text, data


def describe(grip, slide):
    """Physics in words – same wording as in the browser."""
    if not grip:
        return "no grip limit (v1)"
    return f"with grip {grip:g} g" + (f" + sliding friction {round(slide * 100)}%" if slide < 1 else " without sliding friction")


def algorithm(args):
    """Learning method in words – same wording as in the browser, plus Python and seed."""
    if args.method == "single":
        return f"Single car (hill climbing) · Python, seed {args.seed}"
    return f"Population (genetic algorithm) · {args.pop} cars · Python, seed {args.seed}"


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def export(path, args, track, best, gen, log, tests=()):
    data = {
        "formatVersion": 1, "app": "racing-lab-v2-python",
        "meta": {"exportedAt": now(), "trainingTrack": track.name, "physics": describe(args.grip, args.slide),
                 "algorithm": algorithm(args), "scoring": scoring(args)[0], "trainedAt": best.get("at")},
        "scoring": scoring(args)[1],
        "algorithm": ("sequential random mutation with elitist selection" if args.method == "single" else
                      "genetic algorithm: elitism, tournament selection, neuron-block crossover, mutation"),
        "population": 1 if args.method == "single" else args.pop, "generation": gen, "seed": args.seed, "physics": physics(args.grip, args.slide),
        "architecture": [9, 10, 2],
        "weightLayout": "hidden: bias then 9 inputs per neuron; output: bias then 10 hidden per neuron",
        "reward": "min(progress, lap) - 0.6*time + 500 for completed lap"
                  + (" - 100*near-wall time (lateral rays < 2.5 m)" if args.clearance else "")
                  + (" - 2*steering travel sum(|delta steer|)" if args.calm else ""), "sensorRange": 180,
        "trackId": track.id, "trainingTrackId": track.id,
        "bestProgress": best["progress"], "trainingLength": track.total,
        "bestScore": best["score"], "bestWeights": best["weights"],
        "records": log, "samples": [], "testResults": list(tests),
        "bestLaps": {t["trackId"]: t["time"] for t in tests if t["completed"]},
    }
    with open(path, "w") as f:
        json.dump(data, f, indent=1)


def run_population(args, track, evo, start, out, log):
    """Genetic algorithm: in every generation all cars drive in parallel."""
    population = evo.first_generation(args.pop, start)
    best = {"score": float("-inf"), "progress": 0, "weights": None}
    print(f"{'Gen':>4} {'best score':>13} {'distance':>8} {'time':>8} {'laps':>7} {'compute':>11}")
    with Pool(args.workers, initializer=_init, initargs=(args.track, args.grip, args.slide, args.clearance, args.calm)) as pool:
        for gen in range(1, args.generations + 1):
            t0 = time.perf_counter()
            results = pool.map(evaluate, population)
            top = max(range(len(results)), key=lambda k: results[k][0])
            score, prog, t, reason = results[top]
            if score > best["score"]:
                best = {"score": score, "progress": prog, "weights": population[top][:], "at": now()}
            laps = sum(r[3] == reference.LAP for r in results)
            log.append({"at": now(), "algorithm": algorithm(args), "attempt": gen * args.pop, "generation": gen, "score": score, "progress": prog,
                        "time": t, "reason": reason, "improved": score >= best["score"]})
            print(f"{gen:4d} {score:13.1f} {min(prog / track.total, 1) * 100:7.1f}% {t:7.2f}s {laps:4d}/{args.pop:<3d}"
                  f"{time.perf_counter() - t0:10.1f}s")
            export(out, args, track, best, gen, log)
            population = evo.next_generation([(r[0], w) for r, w in zip(results, population)], best["weights"], args.pop)
    return best, gen


def run_single(args, track, evo, start, out, log):
    """Hill climbing as in v1: one car per attempt. If it is better than the best so far, it
    becomes the new best; the next attempt is a mutated copy of the best."""
    _init(args.track, args.grip, args.slide, args.clearance, args.calm)
    weights = start[:] if start else evo.fresh()
    best = {"score": float("-inf"), "progress": 0, "weights": None}
    print(f"{'attempt':>7} {'score':>10} {'distance':>8} {'time':>8}  result")
    for attempt in range(1, args.attempts + 1):
        score, prog, t, reason = evaluate(weights)
        improved = score > best["score"]
        if improved:
            best = {"score": score, "progress": prog, "weights": weights[:], "at": now()}
            print(f"{attempt:7d} {score:10.1f} {min(prog / track.total, 1) * 100:7.1f}% {t:7.2f}s  {reason} · improvement")
        log.append({"at": now(), "algorithm": algorithm(args), "attempt": attempt, "generation": attempt, "car": 0,
                    "score": score, "progress": prog, "time": t, "reason": reason, "improved": improved})
        if improved or attempt % 50 == 0:
            export(out, args, track, best, attempt, log[-200:])
        weights = evo.next_single(best["weights"])
    print(f"… {args.attempts} attempts, {sum(r['improved'] for r in log)} of them improvements")
    return best, args.attempts


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--track", default="training", choices=sorted(tracks.TRAINABLE))
    p.add_argument("--method", default="population", choices=["population", "single"],
                   help="population = genetic algorithm, single = single car / hill climbing as in v1")
    p.add_argument("--pop", type=int, default=40, help="cars per generation (population only)")
    p.add_argument("--generations", type=int, default=30, help="population only")
    p.add_argument("--attempts", type=int, default=300, help="attempts (single only)")
    p.add_argument("--seed", type=int, default=1, help="random start – same seed, same result")
    p.add_argument("--grip", type=float, default=1.5, help="grip µ in g (0 = physics as in v1)")
    p.add_argument("--slide", type=float, default=0.7,
                   help="sliding friction as a share of grip (1 = v2.1, no loss of control)")
    p.add_argument("--clearance", action="store_true",
                   help="clearance rule: side clearance below 2.5 m costs points")
    p.add_argument("--calm", action="store_true",
                   help="steering calm: every steering change costs points (2 per unit of travel)")
    p.add_argument("--init", help="JSON of an existing driver as the starting point")
    p.add_argument("--out", help="output file (default: driver-<track>-<method>-seed<seed>.json)")
    p.add_argument("--workers", type=int, default=os.cpu_count())
    args = p.parse_args()
    out = args.out or f"driver-{args.track}-{args.method}-seed{args.seed}.json"

    track = tracks.load(args.track)
    evo = Evolution(args.seed)
    start = json.load(open(args.init))["bestWeights"] if args.init else None
    log = []
    print(f"{track.name} · {track.total * .2:.0f} m · {algorithm(args)} · {describe(args.grip, args.slide)} · scoring {scoring(args)[0]}\n")
    run = run_single if args.method == "single" else run_population
    best, last = run(args, track, evo, start, out, log)
    # Final run of the best driver with frozen weights – serves as the parity reference in the
    # browser test (tests/regression.cjs).
    car, reason, _ = reference.drive(track, best["weights"], args.grip, args.slide)
    test = {"date": now(), "physics": describe(args.grip, args.slide), "algorithm": algorithm(args), "scoring": scoring(args)[0],
            "trainedOn": track.name, "trainedAt": best["at"], "trackId": track.id, "course": track.name, "driver": "Python training",
            "progressPercent": max(0, min(100, car.max / track.total * 100)), "time": car.time,
            "completed": reason == reference.LAP, "reason": reason, "weightsUnchanged": True}
    export(out, args, track, best, last, log[-2000:], [test])
    print(f"\nSaved: {out}  →  in the browser \"Load JSON state\" or: python3 replay.py {out}")


if __name__ == "__main__":
    main()
