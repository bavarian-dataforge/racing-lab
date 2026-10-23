# Licenses and sources

## Own code and content – MIT

Everything in this repository is under the MIT license (`LICENSE`), **except** the track
data listed below. This covers source code (JavaScript, HTML, CSS, Python), tests,
documentation, test tracks 01–05 and the trained drivers (`*.json` with network weights).

## Nürburgring track data – LGPL-3.0

| File | Content |
| --- | --- |
| `racing-lab-v2/data/Nuerburgring.csv` | unmodified original |
| `racing-lab-v2/tracks/nuerburgring.json` | modified: mirrored, rotated by 84°, converted to 0.2 m units |
| `racing-lab-v2/tracks/nuerburgring.js` | the same modification as a JavaScript file for the browser |

- **Source:** TUMFTM racetrack-database, Chair of Automotive Technology, Technical
  University of Munich – <https://github.com/TUMFTM/racetrack-database>, file `tracks/Nuerburgring.csv`.
- **License:** GNU Lesser General Public License v3.0 (`LICENSES/LGPL-3.0.txt`; the LGPL
  supplements the GPL-3.0: `LICENSES/GPL-3.0.txt`). The modified files are also under
  LGPL-3.0. The conversion script `racing-lab-v2/python/tools/build_nuerburgring.py`
  is own code (MIT) and makes the modification reproducible.
- **Origin according to TUMFTM:** centre line from OpenStreetMap GPS points (smoothed),
  track widths from satellite images. Map data © OpenStreetMap contributors
  (<https://www.openstreetmap.org/copyright>).

The images `docs/images/02-nuerburgring.png` and `docs/images/de/02-nuerburgring.png` show a
rendering of this data. The attribution above applies to them as well.

The simulation only reads this data. The MIT-licensed code does not become LGPL code
as a result.

## The name "Nürburgring"

"Nürburgring" is a registered trademark. The name is used here descriptively only: the
track follows the layout of the GP circuit. Racing Lab is a private, non-commercial
learning project and has no connection to Nürburgring 1927 GmbH & Co. KG or any other
rights holder.
