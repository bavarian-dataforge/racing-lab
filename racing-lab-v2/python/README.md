# Racing Lab · Python

The same simulation as in the browser, in Python. It computes **bit-for-bit identically** to
`sim.js`: a driver drives exactly the same lap in both worlds. So you can train quickly in
Python and watch the result in the browser.

Needs only Python 3 (3.9 or later), no extra packages.

## Files

| File | Content |
| --- | --- |
| `racinglab/tracks.py` | Tracks: Catmull-Rom curves of the test tracks, Nürburgring from `tracks/nuerburgring.json` |
| `racinglab/reference.py` | One car: sensors, network (`predict`), vehicle physics, progress, score |
| `racinglab/ga.py` | Genetic algorithm: elite, tournament, crossover, mutation |
| `train.py` | Training: population (parallel on all CPU cores) or single car as in v1 |
| `replay.py` | Test run with frozen weights on all tracks |
| `analyze.py` | Driving style: how often a driver brakes and slides, at what speed |
| `tools/build_nuerburgring.py` | Converts the TUM CSV into simulation units |

## Commands

Run all commands in the folder `racing-lab-v2/python`.

Train a driver on test track 01 (takes about 15 s):

```bash
python3 train.py --track training --generations 25 --seed 1
```

Train a driver on the Nürburgring:

```bash
python3 train.py --track nuerburgring --generations 40 --seed 1
```

The default is grip 1.5 g with 70 % sliding friction (v2.2). `--slide 1` corresponds to v2.1.
Without a grip limit, i.e. physics as in v1:

```bash
python3 train.py --track training --grip 0
```

Single car as in v1 (hill climbing: one car per attempt, mutated copy of the best):

```bash
python3 train.py --method single --attempts 300 --grip 0
```

Every driver file records in its `meta` header when, on which track, with which physics and
with which method it was trained. The browser shows these details in the test log.

With the clearance rule in the score (less than 2.5 m to the wall at the side costs points):

```bash
python3 train.py --grip 0 --clearance
```

With steering calm (every steering change costs points), also combined with the clearance rule:

```bash
python3 train.py --grip 0 --calm
python3 train.py --grip 0 --clearance --calm
```

Start with prior knowledge, i.e. continue training from the test-track-01 driver:

```bash
python3 train.py --track nuerburgring --init ../../racing-training.json
```

Test a driver on all tracks:

```bash
python3 replay.py ../drivers/driver-nuerburgring-seed1.json
```

Analyse the driving style of all drivers:

```bash
python3 analyze.py ../drivers/*.json
```

Load the generated JSON file in the browser with **Load JSON state**. The file knows which
track it was trained on and ends up with the matching driver.

## How the code fits together

```text
train.py
  └─ Evolution.first_generation()      40 networks (random or starting driver)
  └─ per generation:
       pool.map(evaluate)               every car drives one attempt
         └─ reference.drive()
              └─ advance()  ×N          sense → predict → physics → progress
       Evolution.next_generation()      best + elite + immigrants + children
       export()                         JSON for the browser
```

## Same seed, same result

`--seed` fixes the randomness. With the same seed and the same population, `train.py`
produces the same generations. That is the precondition for fair comparisons such as
"40 vs. 80 cars": change only one variable per experiment and compare several seeds.

`seeds.py` does exactly that in one command: it trains with every seed (via `train.py`),
tests each driver with frozen weights on all tracks and prints how many seeds completed
each track. Drivers, logs and a `summary.json` land in `../drivers/seeds-<settings>-<date>/`.

```bash
python3 seeds.py --seeds 1 2 3 4 5 --generations 14 --pop 80 --grip 0 --clearance
python3 seeds.py --seeds 1 2 3 4 5 --generations 14 --pop 80 --grip 0   # same without the rule
```

## Later: reinforcement learning (PPO)

`reference.advance()` already is what an RL environment needs: observation (9 numbers) in,
action (2 numbers) out, reward (change in progress) and termination (wall, lap, time).
A `gymnasium.Env` around it plus `stable-baselines3` (PPO) would be the next step. That
needs PyTorch and these two packages.
