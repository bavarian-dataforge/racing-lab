# Racing Lab v2 · many cars, one evolution

As of **2026-10-23** · Browser: JavaScript · Training also in Python

Successor to Racing Lab v1 (folder `racing-lab-quellcode`, unchanged and in German).
New in v2:

- **Population instead of a single car:** 20, 40 or 80 cars drive at the same time. A genetic
  algorithm builds the next generation from them. The v1 method remains selectable as
  "Single car (hill climbing)".
- **Nürburgring GP circuit** to scale (5.14 km, real track widths 7.6–21 m), from the TUM
  racetrack database.
- **Two drivers** with separate states: "trained on test track 01" and "trained on the
  Nürburgring". Each can be tested on all six tracks.
- **Python version** in `python/`, bit-for-bit identical to the browser (see `python/README.md`).
- **Grip limit (v2.1):** Kamm's circle with 1.5 g. Cars that are too fast slide outwards in
  bends, so braking matters. Can be switched back to the v1 physics without a limit.
- **Sliding friction (v2.2):** a sliding car only has 70 % grip left (loss of control).
  Three physics variants: v2.2 (default), v2.1, v1.
- **Scoring options (v2.8, v2.9):** clearance rule (2.5 m to the wall at the side) and
  steering calm (penalty on steering travel), separately or combined.
- **Bilingual interface (v3.0):** English and German, switchable at the top right. The choice
  is remembered in the browser. Logs are always written in English; older German exports
  are still read correctly.
- Scoring bug fixed: progress counts at most one lap (details in `docs/technical-notes.md`).

Physics, sensors, network (9–10–2) and weight format are identical to v1. A driver trained in
v1 can be loaded via JSON and drives the same times.

## Running

In the folder `racing-lab-v2`:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open <http://127.0.0.1:8000>.

## Controls (new compared to v1)

| Element | Behaviour |
| --- | --- |
| Driver | Which driver is active. Training only when the track is the driver's training track. |
| Physics | Grip + sliding friction (v2.2), grip without sliding friction (v2.1) or no limit (v1); separate driver states per physics |
| Scoring | Standard, clearance rule, steering calm, or both |
| Learning method | Population (genetic algorithm) or single car as in v1 |
| Cars | Population size 20 / 40 / 80; applies from the next training start |
| Time lapse | additionally 120×; compute time per frame is capped so the page stays responsive |
| Car camera | follows the leading car (largest progress in the current generation) |
| Start over | deletes only the state of the active driver |
| Test log / export | every row with date, track, driver, physics and learning method; JSON header `meta` with the same details |
| EN / DE | interface language |

## Files

```text
racing-lab-v2/
  index.html, sim.js, i18n.js   interface, simulation and texts EN/DE (browser)
  tracks/nuerburgring.js|json   generated track data (do not edit by hand)
  data/Nuerburgring.csv         raw data TUMFTM racetrack-database (LGPL-3.0)
  python/                       Python simulation, training, test runs
  drivers/                      trained drivers (slim copies) + training logs
  tests/regression.cjs          checks without a browser (node tests/regression.cjs)
  tools/screenshots.mjs         creates the README images (headless Chrome, node tools/screenshots.mjs)
  docs/                         technical notes, validation, chronology (German)
```

## License and source of the track data

Code: MIT (see `../LICENSE`). Nürburgring data: TUMFTM racetrack-database,
`tracks/Nuerburgring.csv`, <https://github.com/TUMFTM/racetrack-database>, license LGPL-3.0.
Map data © OpenStreetMap contributors. The data was rotated (84°), converted to 0.2 m units
and otherwise left unchanged (`python/tools/build_nuerburgring.py`). The modified files in
`tracks/` are also under LGPL-3.0. Details: `../NOTICE.md`.
