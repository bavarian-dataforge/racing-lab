# Validierung · v2

Stand: 23. Oktober 2026.

## Parität v1 → v2 → Python

Grundlage ist Flos exportierter v1-Fahrer (`racing-training.json`, 213 Versuche,
trainiert auf Testkurs 01). Er wurde mit eingefrorenen Gewichten erneut gefahren:

| Strecke | v1-Protokoll (Browser) | v2 Browser-Code (Node) | Python `replay.py` |
| --- | --- | --- | --- |
| Testkurs 02 · Wechselkurven | 16,2833 s ✓ | 16,2833 s | 16,2833 s |
| Testkurs 03 · Weite Bögen | 15,4333 s ✓ | 15,4333 s | 15,4333 s |
| Testkurs 04 · Enge Kurven | 18,9833 s ✓ | 18,9833 s | 18,9833 s |
| Testkurs 05 · Gegenrichtung | 17,1333 s ✓ | 17,1333 s | 17,1333 s |
| Testkurs 01 · Training | – | – | 16,6000 s |
| Nürburgring · GP-Strecke | – | 151,72 s, Runde | 151,7167 s, Runde |

Alle drei Implementierungen stimmen auf den Zeitschritt genau überein. Ein in Python
trainierter Fahrer fährt im Browser also dieselbe Runde.

**Ergebnis:** Der nur auf Testkurs 01 (540 m) trainierte Fahrer schafft ohne weiteres
Lernen auch die 5,1 km lange Nürburgring-GP-Strecke. Einschränkung: Das Modell hat
keine Reifenhaftung (siehe `Technik-und-Grenzen.md`). Die Aufgabe ist daher leichter
als in der Realität.

## Automatische Prüfungen

`node tests/regression.cjs` prüft mit DOM-Ersatz:

- Parität des v1-Fahrers (siehe oben), falls `../racing-training.json` vorhanden ist.
- 6 Streckenprofile, Testkurs-01-Kontrollpunkte unverändert, Nürburgring mit 1.029 Punkten.
- Testfahrten ändern weder Gewichte noch Bestwerte.
- Population: 40 Wagen, Generation 1 → 2, neuer Bestwert ≥ alter.
- Einzelwagen-Modus erzeugt weiter Versuche wie in v1.
- Fahrer „Nürburgring“: eigener Speicherstand, Training dort möglich.
- Neustart lädt den Stand, „Neu beginnen“ löscht nur den aktiven Fahrer.

## Im echten Browser geprüft

- Seite lädt ohne Konsolenfehler.
- Testkurs 01, Population 40, von Null: nach 4 Generationen 88 % Strecke.
- Nürburgring, Population 40, von Null: nach 5 Generationen 31 %. Übersicht, Wagenkamera
  und Telemetrie zeigen den führenden Wagen.

## Python-Training (Seed 1, 40 Wagen, 14 CPU-Kerne)

| Lauf | erste volle Runde | Ende | Rechenzeit |
| --- | --- | --- | --- |
| Testkurs 01, von Null, 25 Gen. | Generation 6 (240 Fahrten) | 16,10 s | ≈ 13 s |
| Nürburgring, von Null, 40 Gen. | Generation 8 (320 Fahrten) | 151,00 s | ≈ 60 s |

Zum Vergleich hat Flos v1-Einzelwagen 213 Versuche für Testkurs 01 gebraucht.
Protokolle und Fahrer liegen in `fahrer/`.

### Übertragbarkeit (eingefrorene Gewichte, `replay.py`)

| Strecke | Flos v1-Fahrer (Kurs 01) | GA-Fahrer Kurs 01 | GA-Fahrer Nürburgring |
| --- | --- | --- | --- |
| Testkurs 01 | ✓ 16,60 s | ✓ 16,10 s | ✗ 51,7 % |
| Testkurs 02 | ✓ 16,28 s | ✓ 15,68 s | ✓ 15,75 s |
| Testkurs 03 | ✓ 15,43 s | ✓ 15,20 s | ✓ 15,23 s |
| Testkurs 04 | ✓ 18,98 s | ✗ 37,8 % | ✗ 23,7 % |
| Testkurs 05 | ✓ 17,13 s | ✗ 0,9 % | ✗ 12,1 % |
| Nürburgring | ✓ 151,72 s | ✗ 26,5 % | ✓ 151,00 s |

**Erkenntnis:** Die GA-Fahrer sind auf ihrer Trainingsstrecke schneller, übertragen
ihr Können aber schlechter. Sie haben sich auf die eine Strecke spezialisiert
(Überanpassung). Flos v1-Fahrer ist langsamer, aber vielseitiger. Das war Glück und
kein Ergebnis des Verfahrens: Einzelne Läufe sind keine Statistik. Gegenmittel für
später: auf mehreren Strecken gleichzeitig bewerten oder Startbedingungen variieren.

## Grenzen der Prüfung

Keine Pixelvergleiche. Die Lernkurven hängen vom Zufall (Seed) ab. Einzelne Läufe sind
Beispiele und keine Erfolgsquote.
