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

## v2.1 · Haftungsgrenze 1,5 g

### Ohne Bremsen geht es nicht mehr

Flos v1-Fahrer (eingefroren) mit Haftungsgrenze: Er schafft nur noch Testkurs 03 (weite
Bögen, 17,80 s). Auf allen anderen Strecken rutscht er in der ersten engen Kurve gegen die
Wand: Kurs 01 43 %, Kurs 02 39 %, Kurs 04 17 %, Kurs 05 13 %, Nürburgring 8 %. Mit alter
Physik fährt er unverändert seine v1-Zeiten (Parität geprüft).

### Training mit Haftung (Python, Seed 1, 40 Wagen)

| Strecke | erste Runde | Endzeit mit Haftung | ohne Haftung (v2.0) |
| --- | --- | --- | --- |
| Testkurs 01, 60 Gen. | Generation 10 (40,30 s) | 24,52 s | 16,10 s |
| Nürburgring, 80 Gen. | Generation 9 (222,72 s) | 177,47 s | 151,00 s |

Beide Fahrer fahren im Browser-Code exakt dieselbe Zeit (`tests/regression.cjs`, Abschnitt 8).

### Fahrverhalten (Anteil der Fahrzeit)

| Fahrer | bremst (Pedal < 0) | rutscht | Tempo |
| --- | --- | --- | --- |
| Flo v1, Nürburgring, ohne Haftung | 0 % | 0 % | 58–122 km/h |
| GA Nürburgring, mit Haftung | 1,7 % | 12 % | 42–122 km/h |
| GA Testkurs 01, mit Haftung | 5,0 % | 46 % | 45–122 km/h |

**Erkenntnis:** Mit Haftung fahren die Wagen langsamer in Kurven und bremsen teilweise.
Der genetische Algorithmus hat aber vor allem entdeckt, dass Rutschen Tempo kostet, und
setzt es gezielt als Bremse ein (Drift). Das ist im Modell erlaubt, weil Rutschen nur Tempo
kostet und keinen Kontrollverlust bedeutet. Wer echtes Bremsverhalten erzwingen will,
müsste Rutschen teurer machen, z. B. durch Abzug im Score, Drehen des Wagens oder
weniger Seitenführung beim Rutschen. Das ist eine bewusste Modellentscheidung für später.

## v2.2 · Gleitreibung (Kontrollverlust beim Rutschen)

Experiment auf Testkurs 01: nur die Gleitreibung variiert, je 3 Seeds, 40 Wagen,
60 Generationen. Die Dateien liegen in `fahrer/experiment-gleitreibung/`, ausgewertet mit
`python3 analyze.py`.

| Gleitreibung | Rundenzeit | bremst (Pedal < 0) | rutscht | Höchsttempo |
| --- | --- | --- | --- | --- |
| 100 % (= v2.1) | 22,6–24,5 s | 0–5 % | 46–47 % | 122 km/h |
| 85 % | 25,0–25,7 s | 0 % | 43–48 % | 98–122 km/h |
| 70 % (v2.2) | 27,0–29,1 s | 0–0,7 % | 34–60 % | 92–98 km/h |
| 55 % | 28,9–31,4 s | 0–15 % | 33–67 % | 87–97 km/h |

**Ergebnis:** Kontrollverlust macht Rutschen teurer, und die Runden werden langsamer.
Bremsen mit dem Pedal lernen die Fahrer dadurch aber **nicht**. Sie wählen eine
einfachere Strategie: Sie fahren nicht mehr so schnell, dass Bremsen nötig wäre (Höchsttempo
sinkt von 122 auf ~95 km/h), und regulieren das Tempo über Gaswegnehmen und Rutschen.
Nur ein Lauf (55 %, Seed 3) bremst nennenswert (15 %).

Mögliche Gründe: Das Netz „sieht“ das Rutschen nicht direkt, es hat nur Tempo, Drehrate und
Abstände als Eingänge. Außerdem bleibt die Strategie „gleichmäßig langsam“ für den
genetischen Algorithmus leichter zu finden als „spät bremsen, schnell einlenken“.

Für v2.2 gilt Gleitreibung = 70 %. Fahrer: `fahrer/fahrer-training-slide-seed1.json`
(27,33 s) und `fahrer/fahrer-nuerburgring-slide-seed1.json`.

| Nürburgring (80 Gen., Seed 1) | erste Runde | Endzeit | bremst | davon kräftig (< −0,5) | rutscht | Tempo |
| --- | --- | --- | --- | --- | --- | --- |
| v2.1 ohne Gleitreibung | Gen. 9 | 177,47 s | 1,7 % | 0 % | 12,0 % | 42–122 km/h |
| v2.2 Gleitreibung 70 % | Gen. 13 | 197,92 s | 4,1 % | 2,6 % | 12,9 % | 37–106 km/h |

Auf dem Nürburgring mit seinen langen Geraden bremst der v2.2-Fahrer etwas mehr und auch
kräftiger. Der Hauptunterschied bleibt aber das niedrigere Höchsttempo.

Alle vier Fahrer mit Haftung fahren im Browser-Code exakt ihre Python-Zeiten.


## v2.3 · Einzelwagen-Verfahren in Python

`python3 train.py --method single --attempts 300 --grip 0 --seed 1`, also v1-Verfahren
und v1-Physik:

- Erste volle Runde nach 54 Versuchen, nach 300 Versuchen 16,05 s (16 Verbesserungen,
  17 s Rechenzeit). Mit gleichem Seed bitgenau reproduzierbar.
- Im Browser-Code dieselbe Zeit (16,0500 s), und der Import stellt das Lernverfahren auf
  „Einzelwagen“.
- Übertragbarkeit (eingefroren): Kurs 01 ✓, 02 ✗ 73 %, 03 ✓, 04 ✗ 23 %, 05 ✓, Nürburgring ✗ 8 %.
  Flos v1-Fahrer (16,60 s) schafft alle sechs. Auch hier gilt: schneller heißt nicht vielseitiger.
  Ein Einzellauf ist keine Statistik.

## v2.7 · Länger trainiert, schlechter verallgemeinert (Browser, Flo)

Population mit 80 Wagen, Physik wie v1, Testkurs 01. Derselbe Lauf wurde nach Generation 44
und nach Generation 125 exportiert. Beide Fahrer liegen in `fahrer/`
(`…-80wagen-2026-10-23.json` und `…-80wagen-gen125-2026-10-23.json`).

| Strecke | Generation 44 | Generation 125 |
| --- | --- | --- |
| Testkurs 01 (Training) | ✓ 15,95 s | ✓ 15,83 s |
| Testkurs 02 · Wechselkurven | ✓ 15,48 s | ✗ 73 % |
| Testkurs 03 · Weite Bögen | ✓ 15,00 s | ✓ 14,92 s |
| Testkurs 04 · Enge Kurven | ✓ 18,20 s | ✗ 23 % |
| Testkurs 05 · Gegenrichtung | ✗ 49 % | ✗ 12 % |
| Nürburgring | ✗ 23 % | ✗ 23 % |

81 Generationen mehr Training brachten 0,12 s auf Testkurs 01 (Score 3188,82 → 3188,89,
letzte Verbesserung in Generation 124) und kosteten zwei Prüfstrecken. Die Gewichte
verschoben sich im Mittel um 0,14. Generation 44 ist der bessere Fahrer, Generation 125 der
schnellere auf seiner Strecke. Beide Ergebnisse reproduziert `replay.py` exakt.

## v2.8 · Abstandsregel im Gütekriterium

Idee (Flo): Die Strahlen sollen eine Grenze nicht unterschreiten. Umgesetzt als Teil der
Bewertung („Weg 1“, Reward Shaping). Jede Zeit, in der der seitliche Abstand (Strahl links
oder rechts) unter 2,5 m liegt, kostet 100 Punkte je Sekunde bei voller Unterschreitung,
anteilig weniger bei geringer. Die Physik bleibt unverändert.

**Vorab-Messung an vorhandenen Fahrern** (Testkurs 01, Physik v1): Die Zeit nahe der Wand
hängt mit der Vielseitigkeit zusammen.

| Fahrer | Zeit unter 2,5 m | Prüfstrecken |
| --- | --- | --- |
| Flos v1-Fahrer | 0,4 s | 5 von 5 |
| 80 Wagen, Gen. 44 | 7,7 s | 3 von 5 |
| 80 Wagen, Gen. 125 | 10,4 s | 1 von 5 |

**Experiment** (Python, Physik v1, 40 Wagen, 60 Generationen, Seeds 1–3, sonst identisch;
Dateien in `fahrer/experiment-abstandsregel/`):

| Lauf | 1. Runde | Runde Kurs 01 | unter 2,5 m | Lenkwechsel/s | 02 03 04 05 Ring |
| --- | --- | --- | --- | --- | --- |
| ohne, Seed 1 | Gen 6 | 15,95 s | 4,0 s | 1,13 | ✓ ✓ ✓ · · (3/5) |
| ohne, Seed 2 | Gen 10 | 15,95 s | 8,1 s | 2,01 | · · ✓ · · (1/5) |
| ohne, Seed 3 | Gen 9 | 15,85 s | 9,5 s | 1,77 | ✓ ✓ · · · (2/5) |
| **mit, Seed 1** | Gen 5 | 16,30 s | 0,0 s | 2,94 | ✓ ✓ ✓ ✓ · (4/5) |
| **mit, Seed 2** | Gen 13 | 16,27 s | 0,0 s | 1,84 | ✓ ✓ ✓ ✓ · (4/5) |
| **mit, Seed 3** | Gen 6 | 16,20 s | 0,0 s | 0,62 | ✓ ✓ · · · (2/5) |

| Mittelwert | ohne | mit Abstandsregel |
| --- | --- | --- |
| Prüfstrecken | 2,0 von 5 | **3,3 von 5** |
| Zeit nahe der Wand | 7,2 s | 0,0 s |
| Rundenzeit Testkurs 01 | 15,92 s | 16,26 s |
| Lenkwechsel/s | 1,63 | 1,80 |

**Ergebnis:** Mit Abstandsregel verallgemeinern die Fahrer deutlich besser. Zwei von drei
schaffen auch die Gegenrichtung, was bisher nur Flos erster Fahrer konnte. Der Preis sind
rund 0,3 s auf der Trainingsstrecke. Das Wackeln verschwindet dadurch nicht: Abstand halten
und ruhig lenken sind zwei verschiedene Ziele. Den Nürburgring schafft keiner, der beste
(Seed 1) kommt aber 45 % weit statt 23 %. Drei Seeds sind eine kleine Stichprobe. Die
Richtung ist eindeutig, die genauen Zahlen sind es nicht.

Python und Browser rechnen mit Abstandsregel identisch, Rundenzeit und Punktzahl
(`tests/regression.cjs`, Fahrer `fahrer-training-v1physik-abstand-seed1.json`).

## v2.9 · Lenkruhe im Gütekriterium

**Beobachtung (Flo):** Auch der Fahrer mit Abstandsregel scheitert am Nürburgring beim
Herausfahren aus der Haarnadel. Er pendelt mit Lenkausschlägen von ±0,5–0,8 und schlägt beim
Gegenlenken an. Regelungstechnisch: zu hohe Verstärkung, zu wenig Dämpfung. In unserer Physik
wächst die wirksame Verstärkung zudem mit dem Tempo (Drehrate ≈ Tempo × Lenkwinkel).

**Abwägung:** Zwei Wege wurden diskutiert.
- A) Lenkwinkel abhängig vom Tempo begrenzen (Gain Scheduling, Änderung der Physik).
- B) Ruhiges Lenken belohnen (Änderung des Gütekriteriums).

Gewählt wurde B, weil die Physik unverändert und alles mit den bisherigen Experimenten
vergleichbar bleibt. A bleibt als realistischere Ergänzung für später.

**Kennzahl:** Lenkweg Σ|ΔLenkung| über die Fahrt, also wie weit das Lenkrad insgesamt bewegt
wird. Quadrierte Änderungen wurden verworfen: Sie hätten Flos ruhigen v1-Fahrer wegen eines
einzigen großen Einschlags am Start stärker bestraft als pendelnde Fahrer.

**Kalibrierung** (Testkurs 01, Physik v1): Lenkweg ruhiger Fahrer 32–43, nervöser ~60. Gewicht
2 Punkte je Einheit, also rund 35 Punkte Unterschied zwischen ruhig und nervös. Ein paar
Zehntel Rundenzeit machen weniger als 1 Punkt aus, der Rundenbonus (500) bleibt dominant.

**Experiment** (Python, Physik v1, 40 Wagen, 60 Generationen, Seeds 1–3; dieselben
Einstellungen wie beim Abstandsregel-Experiment; Dateien in `fahrer/experiment-lenkruhe/`):

| Bewertung | Seed | 1. Runde | Runde Kurs 01 | Lenkweg | Lenkwechsel/s | 02 03 04 05 Ring |
| --- | --- | --- | --- | --- | --- | --- |
| Lenkruhe | 1 | Gen 10 | 17,30 s | 7,0 | 0,23 | ✓ ✓ ✓ · · (3/5), Ring 87 % |
| Lenkruhe | 2 | Gen 7 | 17,72 s | 6,6 | 0,23 | · ✓ ✓ · ✓ (3/5), Ring 153,3 s |
| Lenkruhe | 3 | Gen 6 | 17,33 s | 7,6 | 0,23 | · ✓ ✓ ✓ ✓ (4/5), Ring 153,0 s |
| Abstand + Lenkruhe | 1 | Gen 6 | 18,07 s | 7,5 | 0,22 | ✓ · ✓ · ✓ (3/5), Ring 157,5 s |
| **Abstand + Lenkruhe** | **2** | Gen 7 | 16,72 s | 8,9 | 0,24 | **✓ ✓ ✓ ✓ ✓ (5/5), Ring 152,1 s** |
| **Abstand + Lenkruhe** | **3** | Gen 5 | 17,03 s | 8,6 | 0,23 | **✓ ✓ ✓ ✓ ✓ (5/5), Ring 152,7 s** |

| Mittelwert (je 3 Seeds) | Prüfstrecken | Nürburgring geschafft | Lenkweg | Lenkwechsel/s | Runde Kurs 01 |
| --- | --- | --- | --- | --- | --- |
| Standard | 2,0 / 5 | 0 / 3 | 52,7 | 1,63 | 15,92 s |
| Abstandsregel | 3,3 / 5 | 0 / 3 | 50,2 | 1,80 | 16,26 s |
| Lenkruhe | 3,3 / 5 | 2 / 3 | 7,0 | 0,23 | 17,45 s |
| **Abstand + Lenkruhe** | **4,3 / 5** | **3 / 3** | 8,4 | 0,23 | 17,27 s |

**Ergebnis:** Lenkruhe senkt den Lenkweg auf etwa ein Siebtel und macht die Fahrer dadurch
deutlich vielseitiger. Kombiniert mit der Abstandsregel schaffen alle drei den Nürburgring und
zwei alle Prüfstrecken. Erstmals ist die Vielseitigkeit von Flos erstem Fahrer reproduzierbar
statt Zufall. Der Preis sind rund 1,3 s pro Runde auf der Trainingsstrecke: Ruhe und Abstand
kosten Tempo, verallgemeinern aber besser. Drei Seeds je Variante sind eine kleine Stichprobe,
der Unterschied ist aber sehr deutlich.

Browser und Python rechnen identisch, Rundenzeit und Punktzahl
(`fahrer/fahrer-training-v1physik-abstand+ruhe-seed2.json`).
