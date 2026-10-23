# Lizenzen und Quellen

## Eigener Code und eigene Inhalte – MIT

Alles in diesem Repository steht unter der MIT-Lizenz (`LICENSE`), **außer** den unten
genannten Streckendaten. Das gilt für Quellcode (JavaScript, HTML, CSS, Python), Tests,
Dokumentation, die Testkurse 01–05 und die trainierten Fahrer (`*.json` mit Netzgewichten).

## Streckendaten Nürburgring – LGPL-3.0

| Datei | Inhalt |
| --- | --- |
| `racing-lab-v2/data/Nuerburgring.csv` | unverändertes Original |
| `racing-lab-v2/tracks/nuerburgring.json` | Bearbeitung: gespiegelt, um 84° gedreht, in 0,2-m-Einheiten umgerechnet |
| `racing-lab-v2/tracks/nuerburgring.js` | dieselbe Bearbeitung als JavaScript-Datei für den Browser |

- **Quelle:** TUMFTM racetrack-database, Lehrstuhl für Fahrzeugtechnik, Technische
  Universität München – <https://github.com/TUMFTM/racetrack-database>, Datei `tracks/Nuerburgring.csv`.
- **Lizenz:** GNU Lesser General Public License v3.0 (`LICENSES/LGPL-3.0.txt`, die LGPL
  ergänzt die GPL-3.0: `LICENSES/GPL-3.0.txt`). Die bearbeiteten Dateien stehen ebenfalls
  unter LGPL-3.0. Das Umrechnungsskript `racing-lab-v2/python/tools/build_nuerburgring.py`
  ist eigener Code (MIT) und macht die Bearbeitung nachvollziehbar.
- **Herkunft laut TUMFTM:** Mittellinie aus OpenStreetMap-GPS-Punkten (geglättet),
  Streckenbreiten aus Satellitenbildern. Kartendaten © OpenStreetMap-Mitwirkende
  (<https://www.openstreetmap.org/copyright>).

Die Simulation liest diese Daten nur ein. Der MIT-lizenzierte Code wird dadurch nicht
zu LGPL-Code.

## Name „Nürburgring“

„Nürburgring“ ist eine eingetragene Marke. Der Name wird hier nur beschreibend
verwendet: Die Strecke bildet den Verlauf der GP-Strecke nach. Racing Lab ist ein
privates, nicht-kommerzielles Lernprojekt und steht in keiner Verbindung zur
Nürburgring 1927 GmbH & Co. KG oder anderen Rechteinhabern.
