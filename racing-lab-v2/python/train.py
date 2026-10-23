"""Trainiert einen Fahrer mit einer Population (genetischer Algorithmus).

Jede Generation fahren alle Wagen parallel auf mehreren CPU-Kernen. Das Ergebnis
ist eine JSON-Datei, die der Browser über „JSON-Stand laden“ übernimmt.

  python3 train.py --track training --generations 30
  python3 train.py --track nuerburgring --generations 40 --pop 40 --seed 7
  python3 train.py --track nuerburgring --init ../../racing-training.json   # Vorwissen nutzen
"""
import argparse
import json
import os
import time
from multiprocessing import Pool

from racinglab import reference, tracks
from racinglab.ga import Evolution

_track = None


def _init(track_id):
    global _track
    _track = tracks.load(track_id)


def evaluate(w):
    car, reason, score = reference.drive(_track, w)
    return score, car.max, car.time, reason


def export(path, args, track, best, gen, log):
    data = {
        "formatVersion": 1, "app": "racing-lab-v2-python",
        "algorithm": "genetic algorithm: elitism, tournament selection, neuron-block crossover, mutation",
        "population": args.pop, "generation": gen, "seed": args.seed,
        "architecture": [9, 10, 2],
        "weightLayout": "hidden: bias then 9 inputs per neuron; output: bias then 10 hidden per neuron",
        "reward": "min(progress, lap) - 0.6*time + 500 for completed lap", "sensorRange": 180,
        "trackId": track.id, "trainingTrackId": track.id,
        "bestProgress": best["progress"], "trainingLength": track.total,
        "bestScore": best["score"], "bestWeights": best["weights"],
        "records": log, "samples": [], "testResults": [],
    }
    with open(path, "w") as f:
        json.dump(data, f, indent=1)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--track", default="training", choices=sorted(tracks.TRAINABLE))
    p.add_argument("--pop", type=int, default=40, help="Wagen je Generation")
    p.add_argument("--generations", type=int, default=30)
    p.add_argument("--seed", type=int, default=1, help="Zufallsstart – gleicher Seed, gleiches Ergebnis")
    p.add_argument("--init", help="JSON eines vorhandenen Fahrers als Startpunkt")
    p.add_argument("--out", help="Zieldatei (Standard: fahrer-<strecke>-seed<seed>.json)")
    p.add_argument("--workers", type=int, default=os.cpu_count())
    args = p.parse_args()
    out = args.out or f"fahrer-{args.track}-seed{args.seed}.json"

    track = tracks.load(args.track)
    evo = Evolution(args.seed)
    start = json.load(open(args.init))["bestWeights"] if args.init else None
    population = evo.first_generation(args.pop, start)
    best = {"score": float("-inf"), "progress": 0, "weights": None}
    log = []
    print(f"{track.name} · {track.total * .2:.0f} m · {args.pop} Wagen · Seed {args.seed} · {args.workers} Kerne\n")
    print(f"{'Gen':>4} {'bester Score':>13} {'Strecke':>8} {'Zeit':>8} {'Runden':>7} {'Rechenzeit':>11}")
    with Pool(args.workers, initializer=_init, initargs=(args.track,)) as pool:
        for gen in range(1, args.generations + 1):
            t0 = time.perf_counter()
            results = pool.map(evaluate, population)
            top = max(range(len(results)), key=lambda k: results[k][0])
            score, prog, t, reason = results[top]
            if score > best["score"]:
                best = {"score": score, "progress": prog, "weights": population[top][:]}
            laps = sum(r[3] == "Runde geschafft!" for r in results)
            log.append({"attempt": gen * args.pop, "generation": gen, "score": score, "progress": prog,
                        "time": t, "reason": reason, "improved": score >= best["score"]})
            print(f"{gen:4d} {score:13.1f} {min(prog / track.total, 1) * 100:7.1f}% {t:7.2f}s {laps:4d}/{args.pop:<3d}"
                  f"{time.perf_counter() - t0:10.1f}s")
            export(out, args, track, best, gen, log)
            population = evo.next_generation([(r[0], w) for r, w in zip(results, population)], best["weights"], args.pop)
    print(f"\nGespeichert: {out}  →  im Browser „JSON-Stand laden“ oder: python3 replay.py {out}")


if __name__ == "__main__":
    main()
