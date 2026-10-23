# Racing Lab · Python

Dieselbe Simulation wie im Browser, in Python. Sie rechnet **bitgenau gleich** wie
`sim.js`: Ein Fahrer fährt in beiden Welten exakt dieselbe Runde. Dadurch kannst du
schnell in Python trainieren und das Ergebnis im Browser anschauen.

Benötigt nur Python 3 (ab 3.9), keine Zusatzpakete.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `racinglab/tracks.py` | Strecken: Catmull-Rom-Kurven der Testkurse, Nürburgring aus `tracks/nuerburgring.json` |
| `racinglab/reference.py` | Ein Wagen: Sensoren, Netz (`predict`), Fahrphysik, Fortschritt, Bewertung |
| `racinglab/ga.py` | Genetischer Algorithmus: Elite, Turnier, Kreuzung, Mutation |
| `train.py` | Training: Population (parallel auf allen CPU-Kernen) oder Einzelwagen wie v1 |
| `replay.py` | Testfahrt mit eingefrorenen Gewichten auf allen Strecken |
| `analyze.py` | Fahrstil: wie oft bremst und rutscht ein Fahrer, welches Tempo |
| `tools/build_nuerburgring.py` | Rechnet die TUM-CSV in Simulationseinheiten um |

## Befehle

Alle Befehle im Ordner `racing-lab-v2/python` ausführen.

Fahrer auf Testkurs 01 trainieren (dauert etwa 15 s):

```bash
python3 train.py --track training --generations 25 --seed 1
```

Fahrer auf dem Nürburgring trainieren:

```bash
python3 train.py --track nuerburgring --generations 40 --seed 1
```

Standard ist Haftung 1,5 g mit Gleitreibung 70 % (v2.2). `--slide 1` entspricht v2.1.
Ohne Haftungsgrenze, also Physik wie v1:

```bash
python3 train.py --track training --grip 0
```

Einzelwagen wie in v1 (Hill Climbing: ein Wagen je Versuch, mutierte Kopie des Besten):

```bash
python3 train.py --method single --attempts 300 --grip 0
```

Jede Fahrer-Datei hält im Kopf `meta` fest, wann, auf welcher Strecke, mit welcher Physik
und mit welchem Verfahren trainiert wurde. Der Browser zeigt diese Angaben im Prüfprotokoll.

Mit Abstandsregel in der Bewertung (seitlich unter 2,5 m zur Wand kostet Punkte):

```bash
python3 train.py --grip 0 --clearance
```

Mit Lenkruhe (jede Lenkänderung kostet Punkte), auch kombiniert mit der Abstandsregel:

```bash
python3 train.py --grip 0 --calm
python3 train.py --grip 0 --clearance --calm
```

Mit Vorwissen starten, also vom Fahrer aus Testkurs 01 aus weitertrainieren:

```bash
python3 train.py --track nuerburgring --init ../../racing-training.json
```

Einen Fahrer auf allen Strecken prüfen:

```bash
python3 replay.py ../fahrer/fahrer-nuerburgring-seed1.json
```

Die erzeugte JSON-Datei lädst du im Browser über **JSON-Stand laden**. Die Datei
weiß, auf welcher Strecke sie trainiert wurde, und landet beim passenden Fahrer.

## So hängt der Code zusammen

```text
train.py
  └─ Evolution.first_generation()      40 Netze (Zufall oder Startfahrer)
  └─ je Generation:
       pool.map(evaluate)               jeder Wagen fährt einen Versuch
         └─ reference.drive()
              └─ advance()  ×N          sense → predict → Physik → Fortschritt
       Evolution.next_generation()      Bester + Elite + Zuwanderer + Kinder
       export()                         JSON für den Browser
```

## Gleicher Seed, gleiches Ergebnis

`--seed` legt den Zufall fest. Mit gleichem Seed und gleicher Population ergibt
`train.py` dieselben Generationen. Das ist die Voraussetzung für faire Vergleiche,
etwa „40 gegen 80 Wagen“: Ändere pro Experiment nur eine Größe und vergleiche
mehrere Seeds.

## Später: Reinforcement Learning (PPO)

`reference.advance()` ist bereits das, was eine RL-Umgebung braucht: Beobachtung
(9 Zahlen) rein, Aktion (2 Zahlen) raus, Belohnung (Änderung des Fortschritts)
und Ende (Wand, Runde, Zeit). Ein `gymnasium.Env` darum herum plus
`stable-baselines3` (PPO) wäre der nächste Schritt. Dafür werden dann PyTorch und
diese beiden Pakete benötigt.
