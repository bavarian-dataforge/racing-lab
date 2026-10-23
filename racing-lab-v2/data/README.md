# Track data

`Nuerburgring.csv` is taken unmodified from the
[TUMFTM racetrack-database](https://github.com/TUMFTM/racetrack-database) and is under
**LGPL-3.0** (see `../../NOTICE.md` and `../../LICENSES/`). Map data
© OpenStreetMap contributors.

Columns: `x_m, y_m, w_tr_right_m, w_tr_left_m` (centre line and width per side in metres).
Conversion for the simulation: `python3 python/tools/build_nuerburgring.py`.
