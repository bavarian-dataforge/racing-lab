"""Genetischer Algorithmus – dieselben Bausteine wie im Browser (sim.js, evolve)."""
import random

from .reference import N_WEIGHTS

ELITE = 4          # beste Netze unverändert übernehmen
IMMIGRANTS = 2     # komplett neue Zufallsnetze je Generation (Vielfalt)
TOURNAMENT = 3     # Turniergröße bei der Elternwahl
GENE_RATE = .15    # Anteil der Gewichte, die ein Kind mutiert

# Ein "Gen" ist ein ganzes Neuron: Bias + eingehende Gewichte.
# So bleiben zusammenarbeitende Gewichte beim Kreuzen beisammen.
BLOCKS = [(j * 10, j * 10 + 10) for j in range(10)] + [(100, 111), (111, 122)]


class Evolution:
    def __init__(self, seed=None):
        self.rng = random.Random(seed)

    def rand(self):
        return self.rng.random() * 2 - 1

    def fresh(self):
        return [self.rand() * .8 for _ in range(N_WEIGHTS)]

    def mutate(self, w, rate=GENE_RATE):
        # meist kleine Schritte (±0,12…0,32), gelegentlich ein großer Sprung (±0,7)
        scale = .7 if self.rng.random() < .1 else .12 + self.rng.random() * .2
        return [v + self.rand() * scale if self.rng.random() < rate else v for v in w]

    def crossover(self, a, b):
        child = a[:]
        for s, e in BLOCKS:
            if self.rng.random() < .5:
                child[s:e] = b[s:e]
        return child

    def tournament(self, ranked):
        return max((self.rng.choice(ranked) for _ in range(TOURNAMENT)), key=lambda r: r[0])

    def first_generation(self, size, start=None):
        if start is None:
            return [self.fresh() for _ in range(size)]
        return [start[:]] + [self.mutate(start) for _ in range(size - 1)]

    def next_generation(self, results, best_ever, size):
        """results: Liste (Score, Gewichte). Gibt die neuen Gewichte zurück."""
        ranked = sorted(results, key=lambda r: r[0], reverse=True)
        nxt = [best_ever[:]]
        for _, w in ranked:
            if len(nxt) >= min(ELITE, size):
                break
            if w not in nxt:
                nxt.append(w[:])
        for _ in range(IMMIGRANTS):
            if len(nxt) < size:
                nxt.append(self.fresh())
        while len(nxt) < size:
            a, b = self.tournament(ranked), self.tournament(ranked)
            nxt.append(self.mutate(self.crossover(a[1], b[1])))
        return nxt
