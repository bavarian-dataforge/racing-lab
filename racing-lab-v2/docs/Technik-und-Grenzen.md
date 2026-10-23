# Technik und Grenzen · v2

## Datenfluss

```mermaid
flowchart TD
  S["7 Abstandssensoren + Tempo + Drehrate"] --> N["Netz: 9 → 10 → 2"]
  N --> A["Lenkung + Fahrpedal"]
  A --> P["Fahrzeugmodell: fester Zeitschritt"]
  P --> S
  P --> E["Versuchsende + Score"]
  E --> G["Generation fertig?"]
  G --> R["Rangliste"]
  R --> X["Bester bisher + Elite + Zuwanderer + Kinder"]
  X --> N
```

## Unverändert gegenüber v1

Netz, Eingaben, Sensoren, Fahrzeugmodell, Zeitschritt und Gewichtsformat (122 Werte)
sind identisch. Nachgewiesen wird das in `tests/regression.cjs`: Flos v1-Fahrer fährt in
v2 auf Testkurs 02–05 dieselben Zeiten wie im v1-Protokoll, auf 1/60 s genau. Auch
`python/replay.py` reproduziert sie exakt.

| Parameter | Wert |
| --- | --- |
| Architektur | 9 → 10 → 2, `tanh` |
| Eingaben | 7 Sensorabstände / 180, Geschwindigkeit / 160, Drehrate / 4 |
| Sensorrichtungen | −1,55; −1,05; −0,5; 0; 0,5; 1,05; 1,55 rad |
| Zeitschritt | 1/60 s |
| Höchstgeschwindigkeit | 170 Einheiten/s ≈ 34 m/s ≈ 122 km/h |

## Genetischer Algorithmus (neu)

Nach jeder Generation, wenn alle Wagen ausgeschieden sind:

| Schritt | Anzahl (bei 40 Wagen) | Zweck |
| --- | --- | --- |
| Bester Fahrer bisher | 1 | geht nie verloren |
| Elite | bis 3 weitere | die besten der Generation, unverändert |
| Zuwanderer | 2 | ganz neue Zufallsnetze, gegen Einseitigkeit |
| Kinder | Rest | 2 Eltern per Turnier (3 zufällige, bester gewinnt) → Kreuzung → Mutation |

- **Kreuzung je Neuron:** Ein Kind übernimmt jedes Neuron (Bias + eingehende Gewichte)
  komplett von einem der beiden Eltern. Gewichte, die zusammenarbeiten, bleiben so beisammen.
- **Mutation:** 15 % der Gewichte werden verschoben, meist um ±0,12…0,32 und in 10 % der
  Fälle um bis zu ±0,7. Im Einzelwagen-Modus wie in v1: 65 %.
- **Start mit Vorwissen:** Existiert schon ein bester Fahrer, besteht die erste Generation
  aus ihm und mutierten Kopien.

Alle Wagen starten am selben Punkt und behindern sich nicht (Geisterwagen). Da die
Simulation deterministisch ist, erreicht ein unverändert übernommenes Elite-Netz
denselben Score erneut.

## Bewertung (korrigiert)

```text
Score = min(Fortschritt, Rundenlänge) − 0,6 × Fahrzeit + 500 bei vollständiger Runde
```

In v1 zählte der Überschuss hinter der Ziellinie mit. Daher kam die Anzeige auf
„100,1 %“. In der Python-Trainingsreihe bekam so eine Runde in 16,65 s mehr Punkte als
eine in 16,37 s, weil der langsamere Wagen im letzten Zeitschritt weiter über die Linie
schoss. Mit der Begrenzung gewinnt bei vollständigen Runden immer die schnellere.
Gespeicherte v1-Scores können deshalb um bis zu ~3 Punkte höher sein als neu berechnete.

## Nürburgring

- Quelle: TUMFTM racetrack-database (`Nuerburgring.csv`, LGPL-3.0). Die Mittellinie hat
  einen Punkt alle 5 m und Breiten je Seite.
- Umrechnung (`python/tools/build_nuerburgring.py`): y gespiegelt (Bildschirm-y zeigt
  nach unten), um 84° gedreht, damit die Strecke die 3:2-Fläche füllt, 1 m = 5 Einheiten.
- 1.029 Punkte, 5.144 m, Breite 7,6–21 m. Zeitlimit 600 s, Sensorfenster ±12 Segmente.
- **Wandkontakt** jetzt seitenabhängig: Abstand zur Mittellinie > Breite der jeweiligen
  Seite − 7 Einheiten (1,4 m). Bei den Testkursen (30 je Seite) ergibt das wie in v1 23.
- Darstellung: Übersicht 1,44 m pro Pixel. Die Wagen werden dort vergrößert gezeichnet,
  sonst wären sie nur einen Pixel groß. Die Wagenkamera zeigt den echten Maßstab.

## Wichtige Grenze: keine Reifenhaftung

Das Fahrzeugmodell begrenzt nur den Lenkwinkel, nicht die Querbeschleunigung. Der
kleinste Kurvenradius beträgt bei jedem Tempo 22 / tan(0,52) ≈ 38 Einheiten ≈ 7,7 m.
Ein Wagen muss deshalb **nie bremsen**. Flos v1-Fahrer umrundet den Nürburgring in
151,7 s mit durchschnittlich ~122 km/h, also fast immer mit Höchstgeschwindigkeit.
Ein echter Formelwagen könnte das so nicht.

Sinnvolle Erweiterung: maximale Querbeschleunigung (z. B. `v² / r ≤ µ·g`). Bei zu
schneller Kurvenfahrt rutscht der Wagen dann nach außen. Erst dadurch wird das
Fahrpedal mit Bremsen wirklich wichtig. Das ändert die Physik: Vergleiche mit v1 sind
danach nicht mehr direkt möglich.

## Weitere Grenzen

- Alle Wagen starten identisch. Robustheit gegen andere Startbedingungen wird nicht trainiert.
- Kollision über den Mittelpunktabstand, keine gedrehte Karosserie.
- Sensoren prüfen nur Begrenzungen im lokalen Fenster um den Wagen.
- Es gibt keine Garantie, dass der GA das Optimum findet. Unterschiedliche Seeds liefern
  unterschiedliche Fahrer.

## Speicherung

`localStorage`-Schlüssel: `racing-lab-v2-driver-training`, `racing-lab-v2-driver-nuerburgring`,
`racing-lab-v2-course`, `racing-lab-v2-active-driver`. Wird unter derselben Adresse ein
v1-Stand (`racing-lab-single-driver-v1`) gefunden, wird er als Fahrer „Testkurs 01“ übernommen.

JSON-Export: Format v1-kompatibel (`formatVersion: 1`, `bestWeights`) plus
`trainingTrackId`, `population`, `generation`. Im Arbeitsspeicher werden bis zu 5.000
Versuchsprotokolle gehalten, exportiert werden die letzten 2.000.
