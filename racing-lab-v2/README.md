# Racing Lab v2 · Viele Wagen, eine Evolution

Stand: **23. Oktober 2026** · Browser: JavaScript · Training zusätzlich in Python

Weiterentwicklung von Racing Lab v1 (Ordner `racing-lab-quellcode`, unverändert).
Neu in v2:

- **Population statt Einzelwagen:** 20, 40 oder 80 Wagen fahren gleichzeitig. Daraus
  entsteht per genetischem Algorithmus die nächste Generation. Das v1-Verfahren bleibt
  als „Einzelwagen (Hill Climbing)“ wählbar.
- **Nürburgring GP-Strecke**, maßstäblich (5,14 km, echte Streckenbreiten 7,6–21 m),
  aus der TUM-Rennstrecken-Datenbank.
- **Zwei Fahrer** mit getrennten Ständen: „trainiert auf Testkurs 01“ und „trainiert
  auf Nürburgring“. Jeder kann auf allen sechs Strecken geprüft werden.
- **Python-Version** in `python/`, bitgenau gleich wie der Browser (siehe `python/README.md`).
- **Haftungsgrenze (v2.1):** Kammscher Kreis mit 1,5 g. Zu schnelle Wagen rutschen in Kurven
  nach außen, Bremsen wird wichtig. Umschaltbar auf die v1-Physik ohne Grenze.
- Bewertungsfehler behoben: Der Fortschritt zählt höchstens eine Runde (Details in `docs/Technik-und-Grenzen.md`).

Physik, Sensoren, Netz (9–10–2) und Gewichtsformat sind identisch mit v1. Ein in v1
trainierter Fahrer lässt sich per JSON übernehmen und fährt dieselben Zeiten.

## Starten

Im Ordner `racing-lab-v2`:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Danach <http://127.0.0.1:8000> öffnen.

## Bedienung (neu gegenüber v1)

| Element | Verhalten |
| --- | --- |
| Fahrer | Welcher Fahrer aktiv ist. Training nur, wenn Strecke = Trainingsstrecke des Fahrers. |
| Physik | mit Haftungsgrenze 1,5 g oder ohne (v1); eigene Fahrerstände je Physik |
| Lernverfahren | Population (genetischer Algorithmus) oder Einzelwagen wie in v1 |
| Wagen | Populationsgröße 20 / 40 / 80; gilt ab dem nächsten Trainingsstart |
| Zeitraffer | zusätzlich 120×; die Rechenzeit je Bild ist begrenzt, die Seite bleibt bedienbar |
| Kamera am Wagen | folgt dem führenden Wagen (größter Fortschritt in der laufenden Generation) |
| Neu beginnen | löscht nur den Stand des aktiven Fahrers |

## Dateien

```text
racing-lab-v2/
  index.html, sim.js            Oberfläche und Simulation (Browser)
  tracks/nuerburgring.js|json   erzeugte Streckendaten (nicht von Hand ändern)
  data/Nuerburgring.csv         Rohdaten TUMFTM racetrack-database (LGPL-3.0)
  python/                       Python-Simulation, Training, Testfahrten
  fahrer/                       in Python trainierte Fahrer + Trainingsprotokolle
  tests/regression.cjs          Prüfungen ohne Browser (node tests/regression.cjs)
  docs/                         Technik, Validierung, Chronologie
```

## Quelle der Streckendaten

Nürburgring: TUMFTM racetrack-database, `tracks/Nuerburgring.csv`,
<https://github.com/TUMFTM/racetrack-database>, Lizenz LGPL-3.0. Die Daten wurden
gedreht (84°), in 0,2-m-Einheiten umgerechnet und sonst nicht verändert
(`python/tools/build_nuerburgring.py`). Vor einer Veröffentlichung die
Lizenzbedingungen prüfen.
