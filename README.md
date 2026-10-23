# Racing Lab · ein Wagen lernt fahren

Lernprojekt: Ein Formelwagen mit sieben Abstandssensoren und einem kleinen
neuronalen Netz (9–10–2) lernt durch Versuch und Auswahl, eine Strecke zu fahren.
Angeregt durch ein LinkedIn-Video: Formelwagen, Nürburgring, Lenkung und Gas
jeweils von −1 bis +1.

## Entwicklungsstufen

| Version | Ordner | Was neu ist |
| --- | --- | --- |
| **v1.0** | `racing-lab-quellcode/` | Ein Wagen, Hill Climbing (Mutation des besten Netzes), fünf Testkurse |
| **v2.0** | `racing-lab-v2/` | Population mit genetischem Algorithmus, Nürburgring GP maßstäblich, Python-Version, Bewertungsfehler behoben |

Jede Stufe hat ein Git-Tag (`git tag -n`). Ältere Ordner bleiben unverändert, damit
Vergleiche reproduzierbar sind. Die Änderungen sind in den Commits nachvollziehbar.

## Schnellstart (aktuelle Version)

```bash
cd racing-lab-v2
python3 -m http.server 8000 --bind 127.0.0.1
```

Danach <http://127.0.0.1:8000> öffnen. Training in Python: siehe `racing-lab-v2/python/README.md`.

## Weitere Dateien

- `Racing-Lab-Chronologie.md`: Chronologie von v1. Die fortgeschriebene Fassung liegt in `racing-lab-v2/docs/`.
- `racing-training.json`: Flos im Browser trainierter v1-Fahrer (Referenz für Paritätstests).

## Lizenz

Noch nicht festgelegt. Die Nürburgring-Daten stammen aus der
[TUMFTM racetrack-database](https://github.com/TUMFTM/racetrack-database) (LGPL-3.0).
