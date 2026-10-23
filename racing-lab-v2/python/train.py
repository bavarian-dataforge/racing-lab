"""Trainiert einen Fahrer mit einer Population (genetischer Algorithmus).

Jede Generation fahren alle Wagen parallel auf mehreren CPU-Kernen. Das Ergebnis
ist eine JSON-Datei, die der Browser über „JSON-Stand laden“ übernimmt.

  python3 train.py --track training --generations 30              # Haftung 1,5 g + Gleitreibung (v2.2)
  python3 train.py --track training --slide 1                      # Haftung ohne Gleitreibung (v2.1)
  python3 train.py --track training --grip 0                       # Physik wie v1, ohne Haftungsgrenze
  python3 train.py --track nuerburgring --generations 40 --pop 40 --seed 7
  python3 train.py --track nuerburgring --init ../../racing-training.json   # Vorwissen nutzen
"""
import argparse
import datetime
import json
import os
import time
from multiprocessing import Pool

from racinglab import reference, tracks
from racinglab.ga import Evolution

_track, _grip, _slide = None, 0.0, 1.0


def _init(track_id, grip, slide):
    global _track, _grip, _slide
    _track, _grip, _slide = tracks.load(track_id), grip, slide


def evaluate(w):
    car, reason, score = reference.drive(_track, w, _grip, _slide)
    return score, car.max, car.time, reason


def physics(grip, slide):
    return {"model": "kamm", "grip": grip, "slide": slide} if grip else {"model": "v1"}


def describe(grip, slide):
    """Physik in Worten – gleiche Schreibweise wie im Browser."""
    if not grip:
        return "ohne Haftungsgrenze (v1)"
    g = f"{grip:g}".replace(".", ",")
    return f"mit Haftung {g} g" + (f" + Gleitreibung {round(slide * 100)} %" if slide < 1 else " ohne Gleitreibung")


def algorithm(args):
    return f"Population (genetischer Algorithmus) · {args.pop} Wagen · Python, Seed {args.seed}"


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def export(path, args, track, best, gen, log, tests=()):
    data = {
        "formatVersion": 1, "app": "racing-lab-v2-python",
        "meta": {"exportedAt": now(), "trainingTrack": track.name, "physics": describe(args.grip, args.slide),
                 "algorithm": algorithm(args), "trainedAt": best.get("at")},
        "algorithm": "genetic algorithm: elitism, tournament selection, neuron-block crossover, mutation",
        "population": args.pop, "generation": gen, "seed": args.seed, "physics": physics(args.grip, args.slide),
        "architecture": [9, 10, 2],
        "weightLayout": "hidden: bias then 9 inputs per neuron; output: bias then 10 hidden per neuron",
        "reward": "min(progress, lap) - 0.6*time + 500 for completed lap", "sensorRange": 180,
        "trackId": track.id, "trainingTrackId": track.id,
        "bestProgress": best["progress"], "trainingLength": track.total,
        "bestScore": best["score"], "bestWeights": best["weights"],
        "records": log, "samples": [], "testResults": list(tests),
    }
    with open(path, "w") as f:
        json.dump(data, f, indent=1)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--track", default="training", choices=sorted(tracks.TRAINABLE))
    p.add_argument("--pop", type=int, default=40, help="Wagen je Generation")
    p.add_argument("--generations", type=int, default=30)
    p.add_argument("--seed", type=int, default=1, help="Zufallsstart – gleicher Seed, gleiches Ergebnis")
    p.add_argument("--grip", type=float, default=1.5, help="Haftung µ in g (0 = Physik wie v1)")
    p.add_argument("--init", help="JSON eines vorhandenen Fahrers als Startpunkt")
    p.add_argument("--out", help="Zieldatei (Standard: fahrer-<strecke>-seed<seed>.json)")
    p.add_argument("--slide", type=float, default=0.7,
                   help="Gleitreibung als Anteil der Haftung (1 = v2.1, kein Kontrollverlust)")
    p.add_argument("--workers", type=int, default=os.cpu_count())
    args = p.parse_args()
    out = args.out or f"fahrer-{args.track}-seed{args.seed}.json"

    track = tracks.load(args.track)
    evo = Evolution(args.seed)
    start = json.load(open(args.init))["bestWeights"] if args.init else None
    population = evo.first_generation(args.pop, start)
    best = {"score": float("-inf"), "progress": 0, "weights": None}
    log = []
    phys = describe(args.grip, args.slide)
    print(f"{track.name} · {track.total * .2:.0f} m · {args.pop} Wagen · Seed {args.seed} · {phys} · {args.workers} Kerne\n")
    print(f"{'Gen':>4} {'bester Score':>13} {'Strecke':>8} {'Zeit':>8} {'Runden':>7} {'Rechenzeit':>11}")
    with Pool(args.workers, initializer=_init, initargs=(args.track, args.grip, args.slide)) as pool:
        for gen in range(1, args.generations + 1):
            t0 = time.perf_counter()
            results = pool.map(evaluate, population)
            top = max(range(len(results)), key=lambda k: results[k][0])
            score, prog, t, reason = results[top]
            if score > best["score"]:
                best = {"score": score, "progress": prog, "weights": population[top][:], "at": now()}
            laps = sum(r[3] == "Runde geschafft!" for r in results)
            log.append({"at": now(), "algorithm": algorithm(args), "attempt": gen * args.pop, "generation": gen, "score": score, "progress": prog,
                        "time": t, "reason": reason, "improved": score >= best["score"]})
            print(f"{gen:4d} {score:13.1f} {min(prog / track.total, 1) * 100:7.1f}% {t:7.2f}s {laps:4d}/{args.pop:<3d}"
                  f"{time.perf_counter() - t0:10.1f}s")
            export(out, args, track, best, gen, log)
            population = evo.next_generation([(r[0], w) for r, w in zip(results, population)], best["weights"], args.pop)
    # Abschlussfahrt des besten Fahrers mit eingefrorenen Gewichten – dient im Browser-Test
    # (tests/regression.cjs) als Paritätsreferenz.
    car, reason, _ = reference.drive(track, best["weights"], args.grip, args.slide)
    test = {"date": now(), "physics": describe(args.grip, args.slide), "algorithm": algorithm(args),
            "trainedOn": track.name, "trainedAt": best["at"], "trackId": track.id, "course": track.name, "driver": "Python-Training",
            "progressPercent": max(0, min(100, car.max / track.total * 100)), "time": car.time,
            "completed": reason == "Runde geschafft!", "reason": reason, "weightsUnchanged": True}
    export(out, args, track, best, gen, log, [test])
    print(f"\nGespeichert: {out}  →  im Browser „JSON-Stand laden“ oder: python3 replay.py {out}")


if __name__ == "__main__":
    main()
