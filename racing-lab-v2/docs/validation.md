# Validation · v2

As of 2026-10-23.

## Parity v1 → v2 → Python

The basis is Flo's exported v1 driver (`racing-training.json`, 213 attempts, trained on test
track 01). It was driven again with frozen weights:

| Track | v1 log (browser) | v2 browser code (Node) | Python `replay.py` |
| --- | --- | --- | --- |
| Test track 02 · Alternating bends | 16.2833 s ✓ | 16.2833 s | 16.2833 s |
| Test track 03 · Wide arcs | 15.4333 s ✓ | 15.4333 s | 15.4333 s |
| Test track 04 · Tight corners | 18.9833 s ✓ | 18.9833 s | 18.9833 s |
| Test track 05 · Reverse direction | 17.1333 s ✓ | 17.1333 s | 17.1333 s |
| Test track 01 · Training | – | – | 16.6000 s |
| Nürburgring · GP circuit | – | 151.72 s, lap | 151.7167 s, lap |

All three implementations agree to the time step. A driver trained in Python therefore drives
the same lap in the browser.

**Result:** the driver trained only on test track 01 (540 m) also completes the 5.1 km
Nürburgring GP circuit without further learning. Caveat: this model has no tyre grip (see
`technical-notes.md`). The task is therefore easier than in reality.

## Automated checks

`node tests/regression.cjs` checks, with a DOM stand-in:

- Parity of the v1 driver (see above), if `../racing-training.json` is present.
- 6 track profiles, test track 01 control points unchanged, Nürburgring with 1,029 points.
- Test runs change neither weights nor best values.
- Population: 40 cars, generation 1 → 2, new best value ≥ old one.
- Single-car mode still produces attempts as in v1.
- "Nürburgring" driver: own saved state, training possible there.
- Reload restores the state; "Start over" deletes only the active driver.
- Parity of every driver file in `drivers/` (time and score, browser code vs. Python log).
- Language switch: the test log renders in English and German from the same stored data.

## Checked in a real browser

- Page loads without console errors.
- Test track 01, population 40, from scratch: 88 % of the track after 4 generations.
- Nürburgring, population 40, from scratch: 31 % after 5 generations. Overview, car camera
  and telemetry show the leading car.

## Python training (seed 1, 40 cars, 14 CPU cores)

| Run | first full lap | final | compute time |
| --- | --- | --- | --- |
| Test track 01, from scratch, 25 gen. | generation 6 (240 runs) | 16.10 s | ≈ 13 s |
| Nürburgring, from scratch, 40 gen. | generation 8 (320 runs) | 151.00 s | ≈ 60 s |

For comparison, Flo's v1 single car needed 213 attempts for test track 01.
Logs and drivers are in `drivers/`.

### Transfer (frozen weights, `replay.py`)

| Track | Flo's v1 driver (track 01) | GA driver track 01 | GA driver Nürburgring |
| --- | --- | --- | --- |
| Test track 01 | ✓ 16.60 s | ✓ 16.10 s | ✗ 51.7 % |
| Test track 02 | ✓ 16.28 s | ✓ 15.68 s | ✓ 15.75 s |
| Test track 03 | ✓ 15.43 s | ✓ 15.20 s | ✓ 15.23 s |
| Test track 04 | ✓ 18.98 s | ✗ 37.8 % | ✗ 23.7 % |
| Test track 05 | ✓ 17.13 s | ✗ 0.9 % | ✗ 12.1 % |
| Nürburgring | ✓ 151.72 s | ✗ 26.5 % | ✓ 151.00 s |

**Finding:** the GA drivers are faster on their training track but transfer their skill
worse. They have specialised on that one track (overfitting). Flo's v1 driver is slower but
more versatile. That was luck, not a result of the method: single runs are not statistics.
Remedies for later: score on several tracks at once or vary the starting conditions.

## Limits of the checks

No pixel comparisons. The learning curves depend on chance (seed). Single runs are examples,
not a success rate.

## v2.1 · Grip limit 1.5 g

### It no longer works without braking

Flo's v1 driver (frozen) with the grip limit: it only completes test track 03 (wide arcs,
17.80 s). On all other tracks it slides into the wall in the first tight bend: track 01 43 %,
track 02 39 %, track 04 17 %, track 05 13 %, Nürburgring 8 %. With the old physics it still
drives its v1 times (parity verified).

### Training with grip (Python, seed 1, 40 cars)

| Track | first lap | final time with grip | without grip (v2.0) |
| --- | --- | --- | --- |
| Test track 01, 60 gen. | generation 10 (40.30 s) | 24.52 s | 16.10 s |
| Nürburgring, 80 gen. | generation 9 (222.72 s) | 177.47 s | 151.00 s |

Both drivers drive exactly the same time in the browser code (`tests/regression.cjs`, section 8).

### Driving behaviour (share of driving time)

| Driver | brakes (pedal < 0) | slides | speed |
| --- | --- | --- | --- |
| Flo v1, Nürburgring, without grip | 0 % | 0 % | 58–122 km/h |
| GA Nürburgring, with grip | 1.7 % | 12 % | 42–122 km/h |
| GA test track 01, with grip | 5.0 % | 46 % | 45–122 km/h |

**Finding:** with grip the cars drive slower through bends and brake sometimes. Above all,
though, the genetic algorithm discovered that sliding costs speed and uses it deliberately as
a brake (drifting). The model allows this because sliding only costs speed and does not mean
loss of control. Forcing real braking would require making sliding more expensive, e.g. a
score penalty, spinning the car or less lateral grip while sliding. That is a deliberate
modelling decision for later.

## v2.2 · Sliding friction (loss of control while sliding)

Experiment on test track 01: only the sliding friction varies, 3 seeds each, 40 cars,
60 generations. The files are in `drivers/experiment-sliding-friction/`, evaluated with
`python3 analyze.py`.

| Sliding friction | lap time | brakes (pedal < 0) | slides | top speed |
| --- | --- | --- | --- | --- |
| 100 % (= v2.1) | 22.6–24.5 s | 0–5 % | 46–47 % | 122 km/h |
| 85 % | 25.0–25.7 s | 0 % | 43–48 % | 98–122 km/h |
| 70 % (v2.2) | 27.0–29.1 s | 0–0.7 % | 34–60 % | 92–98 km/h |
| 55 % | 28.9–31.4 s | 0–15 % | 33–67 % | 87–97 km/h |

**Result:** loss of control makes sliding more expensive, and laps get slower. But the drivers
do **not** learn to brake with the pedal. They choose a simpler strategy: they no longer drive
fast enough to need braking (top speed drops from 122 to ~95 km/h) and regulate speed by
lifting off and sliding. Only one run (55 %, seed 3) brakes noticeably (15 %).

Possible reasons: the network does not "see" sliding directly; its only inputs are speed,
yaw rate and distances. Also, the strategy "evenly slow" is easier for the genetic algorithm
to find than "brake late, turn in fast".

v2.2 uses sliding friction = 70 %. Drivers: `drivers/driver-training-slide-seed1.json`
(27.33 s) and `drivers/driver-nuerburgring-slide-seed1.json`.

| Nürburgring (80 gen., seed 1) | first lap | final time | brakes | of it hard (< −0.5) | slides | speed |
| --- | --- | --- | --- | --- | --- | --- |
| v2.1 without sliding friction | gen. 9 | 177.47 s | 1.7 % | 0 % | 12.0 % | 42–122 km/h |
| v2.2 sliding friction 70 % | gen. 13 | 197.92 s | 4.1 % | 2.6 % | 12.9 % | 37–106 km/h |

On the Nürburgring with its long straights the v2.2 driver brakes a little more and harder.
The main difference is still the lower top speed.

All four drivers with grip drive exactly their Python times in the browser code.

## v2.3 · Single-car method in Python

`python3 train.py --method single --attempts 300 --grip 0 --seed 1`, i.e. v1 method and
v1 physics:

- First full lap after 54 attempts, 16.05 s after 300 attempts (16 improvements, 17 s compute
  time). Bit-for-bit reproducible with the same seed.
- The same time in the browser code (16.0500 s), and the import sets the learning method to
  "single car".
- Transfer (frozen): track 01 ✓, 02 ✗ 73 %, 03 ✓, 04 ✗ 23 %, 05 ✓, Nürburgring ✗ 8 %.
  Flo's v1 driver (16.60 s) completes all six. Here too: faster does not mean more versatile.
  A single run is not statistics.

## v2.7 · Trained longer, generalised worse (browser, Flo)

Population of 80 cars, v1 physics, test track 01. The same run was exported after generation 44
and after generation 125. Both drivers are in `drivers/`
(`…-80cars-2026-10-23.json` and `…-80cars-gen125-2026-10-23.json`).

| Track | Generation 44 | Generation 125 |
| --- | --- | --- |
| Test track 01 (training) | ✓ 15.95 s | ✓ 15.83 s |
| Test track 02 · Alternating bends | ✓ 15.48 s | ✗ 73 % |
| Test track 03 · Wide arcs | ✓ 15.00 s | ✓ 14.92 s |
| Test track 04 · Tight corners | ✓ 18.20 s | ✗ 23 % |
| Test track 05 · Reverse direction | ✗ 49 % | ✗ 12 % |
| Nürburgring | ✗ 23 % | ✗ 23 % |

81 more generations of training gained 0.12 s on test track 01 (score 3188.82 → 3188.89,
last improvement in generation 124) and cost two test tracks. The weights moved by 0.14 on
average. Generation 44 is the better driver, generation 125 the faster one on its own track.
`replay.py` reproduces both results exactly.

## v2.8 · Clearance rule in the score

Idea (Flo): the rays should not fall below a limit. Implemented as part of the score
("path 1", reward shaping). Any time in which the lateral distance (left or right ray) is below
2.5 m costs 100 points per second at full violation, proportionally less for smaller
violations. The physics stays unchanged.

**Preliminary measurement on existing drivers** (test track 01, v1 physics): time close to
the wall correlates with versatility.

| Driver | time below 2.5 m | test tracks |
| --- | --- | --- |
| Flo's v1 driver | 0.4 s | 5 of 5 |
| 80 cars, gen. 44 | 7.7 s | 3 of 5 |
| 80 cars, gen. 125 | 10.4 s | 1 of 5 |

**Experiment** (Python, v1 physics, 40 cars, 60 generations, seeds 1–3, otherwise identical;
files in `drivers/experiment-clearance/`):

| Run | 1st lap | lap track 01 | below 2.5 m | steering reversals/s | 02 03 04 05 Ring |
| --- | --- | --- | --- | --- | --- |
| without, seed 1 | gen 6 | 15.95 s | 4.0 s | 1.13 | ✓ ✓ ✓ · · (3/5) |
| without, seed 2 | gen 10 | 15.95 s | 8.1 s | 2.01 | · · ✓ · · (1/5) |
| without, seed 3 | gen 9 | 15.85 s | 9.5 s | 1.77 | ✓ ✓ · · · (2/5) |
| **with, seed 1** | gen 5 | 16.30 s | 0.0 s | 2.94 | ✓ ✓ ✓ ✓ · (4/5) |
| **with, seed 2** | gen 13 | 16.27 s | 0.0 s | 1.84 | ✓ ✓ ✓ ✓ · (4/5) |
| **with, seed 3** | gen 6 | 16.20 s | 0.0 s | 0.62 | ✓ ✓ · · · (2/5) |

| Mean | without | with clearance rule |
| --- | --- | --- |
| Test tracks | 2.0 of 5 | **3.3 of 5** |
| Time close to the wall | 7.2 s | 0.0 s |
| Lap time test track 01 | 15.92 s | 16.26 s |
| Steering reversals/s | 1.63 | 1.80 |

**Result:** with the clearance rule the drivers generalise clearly better. Two of three also
complete the reverse direction, which so far only Flo's first driver could do. The price is
about 0.3 s on the training track. The wobbling does not go away: keeping clearance and
steering calmly are two different goals. None completes the Nürburgring, but the best one
(seed 1) gets 45 % of the way instead of 23 %. Three seeds are a small sample. The direction
is clear, the exact numbers are not.

Python and browser compute identically with the clearance rule, lap time and score
(`tests/regression.cjs`, driver `driver-training-v1physics-clearance-seed1.json`).

## v2.9 · Steering calm in the score

**Observation (Flo):** even the driver with the clearance rule fails on the Nürburgring when
exiting the hairpin. It oscillates with steering inputs of ±0.5–0.8 and hits the wall while
counter-steering. In control-engineering terms: gain too high, too little damping. In our
physics the effective gain also grows with speed (yaw rate ≈ speed × steering angle).

**Trade-off:** two approaches were discussed.
- A) Limit the steering angle depending on speed (gain scheduling, a physics change).
- B) Reward calm steering (a change of the score).

B was chosen because the physics stays unchanged and everything remains comparable with the
previous experiments. A remains a more realistic addition for later.

**Metric:** steering travel Σ|Δsteer| over the drive, i.e. how far the steering wheel moves in
total. Squared changes were rejected: they would have punished Flo's calm v1 driver harder than
oscillating drivers because of a single large input at the start.

**Calibration** (test track 01, v1 physics): steering travel of calm drivers 32–43, nervous
ones ~60. Weight 2 points per unit, so roughly 35 points difference between calm and nervous.
A few tenths of lap time make less than 1 point; the lap bonus (500) stays dominant.

**Experiment** (Python, v1 physics, 40 cars, 60 generations, seeds 1–3; the same settings as
the clearance experiment; files in `drivers/experiment-steering-calm/`):

| Score | Seed | 1st lap | lap track 01 | steering travel | steering reversals/s | 02 03 04 05 Ring |
| --- | --- | --- | --- | --- | --- | --- |
| Steering calm | 1 | gen 10 | 17.30 s | 7.0 | 0.23 | ✓ ✓ ✓ · · (3/5), Ring 87 % |
| Steering calm | 2 | gen 7 | 17.72 s | 6.6 | 0.23 | · ✓ ✓ · ✓ (3/5), Ring 153.3 s |
| Steering calm | 3 | gen 6 | 17.33 s | 7.6 | 0.23 | · ✓ ✓ ✓ ✓ (4/5), Ring 153.0 s |
| Clearance + calm | 1 | gen 6 | 18.07 s | 7.5 | 0.22 | ✓ · ✓ · ✓ (3/5), Ring 157.5 s |
| **Clearance + calm** | **2** | gen 7 | 16.72 s | 8.9 | 0.24 | **✓ ✓ ✓ ✓ ✓ (5/5), Ring 152.1 s** |
| **Clearance + calm** | **3** | gen 5 | 17.03 s | 8.6 | 0.23 | **✓ ✓ ✓ ✓ ✓ (5/5), Ring 152.7 s** |

| Mean (3 seeds each) | test tracks | Nürburgring completed | steering travel | steering reversals/s | lap track 01 |
| --- | --- | --- | --- | --- | --- |
| Standard | 2.0 / 5 | 0 / 3 | 52.7 | 1.63 | 15.92 s |
| Clearance rule | 3.3 / 5 | 0 / 3 | 50.2 | 1.80 | 16.26 s |
| Steering calm | 3.3 / 5 | 2 / 3 | 7.0 | 0.23 | 17.45 s |
| **Clearance + calm** | **4.3 / 5** | **3 / 3** | 8.4 | 0.23 | 17.27 s |

**Result:** steering calm reduces steering travel to about a seventh and thereby makes the
drivers clearly more versatile. Combined with the clearance rule, all three complete the
Nürburgring and two complete all test tracks. For the first time the versatility of Flo's
first driver is reproducible instead of luck. The price is about 1.3 s per lap on the training
track: calm and clearance cost speed but generalise better. Three seeds per variant are a small
sample, but the difference is very clear.

Browser and Python compute identically, lap time and score
(`drivers/driver-training-v1physics-clearance+calm-seed2.json`).

## v2.9 · Browser drivers with grip and steering calm (Flo, 2026-10-23)

Flo tried the new scores in the browser with grip: 40 cars, population, test track 01, each
started from scratch. `replay.py` reproduces all results exactly.

| Physics | Score | Generation | Track 01 | 02 | 03 | 04 | 05 | Ring | total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Grip + sliding friction | Standard | 60 | 27.63 s | ✗ 74 % | 20.38 s | ✗ 17 % | ✗ 13 % | ✗ 8 % | 2/6 |
| Grip + sliding friction | Clearance + calm | 70 | 29.67 s | ✗ 41 % | 26.83 s | ✗ 24 % | ✗ 49 % | ✗ 8 % | 2/6 |
| Grip without sliding friction | Steering calm | 73 | 26.10 s | ✗ 76 % | 22.85 s | ✗ 38 % | ✗ 3 % | ✗ 45 % | 2/6 |
| **Grip + sliding friction** | **Steering calm** | **68** | **29.25 s** | **29.58 s** | **23.23 s** | **34.25 s** | ✗ 50 % | **234.27 s** | **5/6** |

**Finding:** the driver with grip + sliding friction and steering calm is the first with
realistic physics to complete the Nürburgring. Until now none got past half. It steers calmly
(steering travel 11.8, 0.14 steering reversals/s), slides only 27 % of the driving time
(standard: 58 %) and drives at most 82 km/h. It still never brakes: it has found an even speed
at which grip suffices. The price is time: Nürburgring 234 s instead of 152 s without grip.

**Caveat:** these are single drivers, trained in the browser without a fixed seed. Notably,
the combination with the clearance rule did worse under grip (2/6). Whether the clearance rule
really hurts with grip is open and needs an experiment with several seeds.

Files (slim copies in `drivers/`, same order as the table):
`driver-training-slide-browser-gen60-2026-10-23.json`,
`driver-training-slide-clearance+calm-browser-2026-10-23.json`,
`driver-training-grip-calm-browser-2026-10-23.json`,
`driver-training-slide-calm-browser-2026-10-23.json`.
Plus Flo's browser driver without grip with clearance + calm (generation 62, 5 of 6 tracks,
Nürburgring 152.55 s, fails only at the start of the reverse direction):
`driver-training-v1physics-clearance+calm-browser-2026-10-23.json`.
