---
title: Racing Lab – Chronologie und Erkenntnisse
created: 2026-10-23
updated: 2026-10-23
status: funktionsfähiger-prototyp
tags:
  - projekt/racing-lab
  - ki/neuronale-netze
  - ki/neuroevolution
  - simulation
  - javascript
  - lernen
---

# Racing Lab – Chronologie und Erkenntnisse

> [!abstract] Projektidee
> Ein einzelner Formelwagen lernt in einer gut sichtbaren 2D-Simulation, eine Strecke zu bewältigen. Sein Können wird anschließend mit unveränderten Gewichten auf weiteren Strecken geprüft. Wir wollen das Prinzip verstehen, die Entwicklung dokumentieren und später belastbare Ergebnisse veröffentlichen.

**Projektstart und bisherige Entwicklung:** 23. Oktober 2026. Die folgenden Stationen geben die Reihenfolge unserer Unterhaltung wieder; es wurden keine nachträglichen minutengenauen Zeitstempel erfunden.

**Aktueller technischer Stand:** JavaScript, HTML, CSS, Canvas und SVG. Kein Python-Trainingsprogramm, kein PyTorch, kein Blender und noch keine ROS-2-Anbindung.

**Simulation:** <https://flo-racing-evolution.florianbert.chatgpt.site>

## 1. Ausgangsidee: ein lernender Rennwagen

Ausgangspunkt war ein auf LinkedIn gesehenes Video: Ein Formelwagen lernte auf einer begrenzten Strecke nach vielen Fehlversuchen zu fahren. In der Beschreibung wurden zwei Stellgrößen genannt:

- Lenkung zwischen −1 und +1.
- Fahrpedal zwischen −1 (Bremsen) und +1 (Beschleunigen), mit 0 als neutralem Befehl.

Der genaue Algorithmus des Videos wurde nicht identifiziert. Besprochen wurden Reinforcement Learning mit PPO sowie Neuroevolution. Für unseren ersten direkt ausführbaren Prototyp wurde eine einfache Suche über veränderte Netzgewichte gewählt.

## 2. Ziel und Bewertung geklärt

Die gewünschte Aufgabe lautet: auf der Strecke weiterkommen, eine vollständige Runde schaffen und anschließend eine bessere Rundenzeit erreichen.

Wichtige Erkenntnis: Eine Belohnung nur für kollisionsfreies Verweilen könnte Stehenbleiben begünstigen. Eine Belohnung nur für gefahrene Meter könnte Hin-und-her-Fahren oder Abkürzungen begünstigen. Deshalb wird gerichteter Fortschritt entlang der Strecke gemessen.

Die tatsächlich umgesetzte Bewertung eines abgeschlossenen Versuchs ist:

```text
Score = gerichteter Streckenfortschritt − 0,6 × Fahrzeit
        + 500 bei einer vollständigen Runde
```

Der Fortschritt wird in den internen Streckeneinheiten der Simulation gemessen, die Zeit in Simulationssekunden. Ein Wandkontakt beendet den Versuch. Es gibt im aktuellen Code **keinen separaten zusätzlichen Kollisions-Punktabzug**. Weitere Abbruchgründe sind fehlender Fortschritt über drei Sekunden oder eine Fahrzeit über 70 Sekunden.

Bei gleicher vollständig absolvierter Strecke bekommt eine kürzere Fahrzeit die höhere Bewertung.

## 3. Ein Wagen und eine verständliche Darstellung

Zunächst war eine Population mehrerer Wagen im Gespräch. Flo begrenzte den ersten Schritt ausdrücklich auf **einen Wagen**.

Gewünschte Gestaltung:

- Vogelperspektive.
- Klare Comic-Anmutung.
- Erkennbarer Formelwagen mit passenden Größenverhältnissen zur Fahrbahn.
- Sichtbare Bewegung, Sensoren, Kollisionen und Neustarts.

Dafür entstand eine 2D-Webanwendung. Blender wurde für diesen Schritt nicht benötigt.

## 4. Das Netz sichtbar gemacht

Das Netz besitzt **9 Eingänge, 10 versteckte Neuronen und 2 Ausgänge**.

| Ebene | Inhalt |
| --- | --- |
| Eingänge 1–7 | Abstände zur Streckenbegrenzung in sieben Richtungen |
| Eingang 8 | Geschwindigkeit |
| Eingang 9 | Drehrate |
| Versteckte Ebene | Zehn Neuronen mit `tanh`-Aktivierung |
| Ausgang 1 | Lenkbefehl |
| Ausgang 2 | Fahrpedal für Beschleunigen/Bremsen |

Insgesamt gibt es **110 Verbindungsgewichte und 12 Biaswerte**, also 122 veränderbare Parameter.

Die Darstellung zeigt Vorzeichen und Stärke der Gewichte sowie die aktuellen Aktivierungen. Beim Anklicken einer Verbindung erscheint ihr genauer Wert.

> [!tip] Zwei unterschiedliche Änderungen
> **Aktivierungen** ändern sich während der Fahrt mit den Sensorwerten. **Gewichte** werden zwischen Trainingsversuchen verändert und bleiben während einer einzelnen Fahrt konstant.

## 5. Sichtbarkeit korrigiert

Flo meldete, dass Beschriftungen die Darstellung störten und der Wagen während des Trainings nicht ausreichend sichtbar war.

Umgesetzt wurden:

- Beschriftungen außerhalb der Fahrfläche.
- Entfernung der Schrift in der Streckenmitte.
- Eigene SVG-Ebene für die Fahrzeugposition.
- Heller Positionsring um den Wagen.
- Vergrößerter Ausschnitt neben der Strecke.
- Rote Markierung am Kollisionsort.

Die Positionsberechnung und ihre Übergabe an die Darstellung wurden automatisiert geprüft. Die optische Prüfung im steuerbaren Browser blieb wegen wiederholter Timeouts unvollständig. Die späteren positiven Rückmeldungen von Flo stammen aus seiner tatsächlichen Nutzung.

## 6. Wie das Lernen tatsächlich funktioniert

Der erste Versuch verwendet ein zufälliges Netz. Nach jedem Trainingslauf wird sein Score mit dem bisherigen besten Score verglichen.

1. Ist der neue Score höher, werden Netz und Bewertung zum neuen besten Stand.
2. Der nächste Versuch verwendet normalerweise eine veränderte Kopie dieses besten Netzes.
3. Etwa 5 % der Versuche beginnen mit einem vollständig neuen zufälligen Netz.
4. Ein schlechter Versuch überschreibt den besten Fahrer nicht.

Das ist eine **sequenzielle evolutionäre Gewichtssuche mit Bestenauswahl**. Es ist kein implementiertes PPO, kein Training mit Gradienten und kein NEAT-Verfahren mit veränderlicher Netzstruktur.

Aufzeichnungen von Sensorwerten werden derzeit zur Nachvollziehbarkeit gespeichert. Sie werden nicht als Replay-Datensatz erneut zum Training verwendet. Die für das weitere Lernen genutzte Erfahrung steckt in den ausgewählten Gewichten.

## 7. Speicherung ergänzt

Anfangs blieben die Gewichte nur im Arbeitsspeicher. Nach Flos Rückfrage wurde automatische Speicherung im Browser ergänzt.

Nach abgeschlossenen Versuchen werden gesichert:

- Das beste Netz mit seinen Gewichten.
- Bester Score und Fortschritt.
- Versuchszähler und Verlauf der letzten besten Bewertungen.
- Die letzten 200 Versuchsprotokolle.
- Die letzten 1.000 Sensor-/Aktivierungs-/Aktionsstichproben.
- Die letzten 50 Ergebnisse unveränderter Testfahrten.

Im Arbeitsspeicher werden bis zu 10.000 Messstichproben gehalten. Der JSON-Export enthält den jeweils verfügbaren Stand einschließlich Gewichten. CSV enthält die Tabelle der Trainingsversuche.

Ein JSON-Import ermöglicht die Übernahme zwischen Online-Version, lokaler Kopie und anderen Geräten. Ein beliebiger Browser-Speicher ist keine geräteübergreifende Sicherung; regelmäßige JSON-Exporte bleiben sinnvoll.

## 8. Training und Testfahrt unterschieden

Warum kann ein Wagen nach einer erfolgreichen Runde im Training erneut kollidieren? Weil beim Training weitere veränderte Varianten ausprobiert werden.

**„Besten Fahrer testen“** verwendet dagegen die gespeicherten Gewichte unverändert. Bei gleicher Physik und gleichen Anfangsbedingungen sollte dieses deterministische Modell denselben Verlauf wiederholen.

**„Training starten“** lernt auf Grundlage des besten Fahrers weiter. Der Wagen startet räumlich erneut am Streckenanfang; der beste Lernstand bleibt erhalten.

**„Neu beginnen“** löscht dagegen den gespeicherten Stand und startet ein neues Training.

Das Training läuft bis zur manuellen Pause. Eine automatische Regel wie „Zielzeit erreicht“ oder „500 Versuche ohne Verbesserung“ wurde besprochen, aber noch nicht umgesetzt.

## 9. Fünf feste Streckenprofile ergänzt

Flo wollte den Fahrer auf unbekannten Strecken prüfen und den ursprünglichen Testkurs erhalten. Das Menü liegt oben links über der Fahrbahn.

| Kurs | Profil | Zweck im aktuellen Programm |
| --- | --- | --- |
| Testkurs 01 | Ursprüngliche Trainingsstrecke | Training und Testfahrten |
| Testkurs 02 | Wechselkurven | Prüfung mit eingefrorenen Gewichten |
| Testkurs 03 | Weite Bögen | Prüfung mit eingefrorenen Gewichten |
| Testkurs 04 | Enge Kurven | Prüfung mit eingefrorenen Gewichten |
| Testkurs 05 | Ursprüngliche Strecke in Gegenrichtung | Prüfung mit eingefrorenen Gewichten |

Der Verlauf von Testkurs 01 wurde mit der vorherigen Version verglichen und blieb unverändert. Die Profile sind als feste Koordinaten im Quellcode gespeichert. Die zuletzt gewählte Strecke wird im Browser gemerkt.

Auf Kurs 02–05 wird nicht weitertrainiert. So vermischen wir das Prüfen der Übertragbarkeit nicht mit einem Nachlernen auf genau diesen Prüfstrecken. Fortschritt, Fahrzeit und Abbruchgrund werden protokolliert.

## 10. Erste Beobachtung zur Generalisierung

> [!success] Beobachtung von Flo
> Der auf einer anderen Strecke angelernte Fahrer bewältigte **Testkurs 04 mit engen Kurven nach Flos Beobachtung ohne Probleme**. Die Testfahrt verwendete dieselben gespeicherten Gewichte.

Das ist ein interessanter qualitativer Hinweis auf Übertragbarkeit: Das Netz erhält keine Streckenkarte, sondern lokale Abstandswerte, Geschwindigkeit und Drehrate. Seine gelernte Zuordnung kann offenbar auch auf diesem anderen Kurvenprofil funktionieren.

**Grenze der Aussage:** Es liegen in dieser Dokumentation noch keine zugehörige Modelldatei, keine systematische Testserie und keine belastbare Erfolgsquote vor. Ein erfolgreicher neuer Kurs beweist keine allgemeine Fahrfähigkeit auf beliebigen Strecken. Derselbe erfolgreiche Fahrer sollte deshalb exportiert und zusammen mit den Testergebnissen archiviert werden.

## 11. Quellcode und Dokumentation gesichert

Flo wünschte das Programm als Datei und eine Markdown-Chronologie für Obsidian. Zunächst war eine Python-Version angesprochen. Nach seiner Klarstellung wurde entschieden, die bestehende JavaScript-Version zu erhalten und als lokales Quellcodepaket zu übergeben.

Das Paket enthält die ausführbare Oberfläche, den Simulationscode, Startanleitung, technische Erläuterung und automatisierte Prüfungen. Es enthält **keinen aus Flos Browser ausgelesenen trainierten Fahrer**. Dieser wird separat über den JSON-Export übernommen.

## 12. v2: Population, Nürburgring, Python

- **Ziel:** Das Verfahren aus dem LinkedIn-Video nachvollziehen: viele Wagen, echte Strecke, Training auch in Python.
- **Ausgangsmodell:** `racing-training.json` (v1, 213 Versuche, trainiert auf Testkurs 01).
- **Codeversion:** Ordner `racing-lab-v2`. v1 bleibt unverändert in `racing-lab-quellcode`.
- **Änderungen:**
  - Genetischer Algorithmus mit 20/40/80 Wagen: Elite, Turnierauswahl, Kreuzung ganzer Neuronen, Mutation, Zuwanderer. Der v1-Einzelwagen bleibt wählbar.
  - Nürburgring GP-Strecke maßstäblich (TUMFTM racetrack-database, LGPL-3.0) mit echten Breiten.
  - Zwei getrennte Fahrer: „Testkurs 01“ und „Nürburgring“.
  - Python-Version, bitgenau gleich wie der Browser; Training parallel auf allen Kernen.
  - Bewertungsfehler behoben: Fortschritt zählt höchstens eine Runde (vorher „100,1 %“; eine langsamere Runde konnte gewinnen).
- **Beobachtungen / Messwerte:**
  - Flos v1-Fahrer fährt in v2 und Python exakt dieselben Zeiten wie im v1-Protokoll.
  - Derselbe Fahrer schafft ohne Nachlernen den Nürburgring: 151,72 s.
  - GA in Python, Seed 1: Testkurs 01 ab Generation 6, Nürburgring von Null ab Generation 8 (Endstand 151,00 s).
  - Die GA-Fahrer sind auf ihrer Strecke schneller, scheitern aber auf mehreren Prüfstrecken (Details in `Validierung.md`).
- **Erkenntnisse:**
  - Schnell auf einer Strecke heißt nicht vielseitig. Das ist Überanpassung.
  - Ohne Reifenhaftung muss der Wagen nie bremsen. Der Nürburgring ist im Modell leichter als in echt.
- **Offene Punkte:**
  - [ ] Haftungsgrenze (Querbeschleunigung) in die Physik aufnehmen.
  - [ ] Auf mehreren Strecken gleichzeitig trainieren, um besser zu generalisieren.
  - [ ] Mehrere Seeds je Einstellung vergleichen statt Einzelläufen.
  - [ ] PPO über eine `gymnasium`-Umgebung um `reference.advance()`.

## Technische Vereinfachungen

Das Fahrzeug verwendet ein vereinfachtes kinematisches Modell mit Lenkung, Beschleunigen, Bremsen und geschwindigkeitsabhängigem Widerstand. Es werden keine Federung, Dämpfung, Reifenschlupf, Motorkennfelder oder Drehzahl simuliert.

Auch die Kollision ist vereinfacht: Ein Sicherheitsabstand des Fahrzeugmittelpunkts zur Streckenmittellinie entscheidet über Wandkontakt; es gibt keine exakte gedrehte Karosserie-Kollision. Lernfortschritt und Fahrfähigkeit gelten zunächst für dieses Modell.

Die Architektur 9–10–2 ist unsere Ausgangsbasis, nicht ein nachgewiesenes Optimum. Vor Änderungen an der Netzgröße sind Vergleichsläufe, reproduzierbare Startbedingungen und klare Messgrößen sinnvoll.

## Nächste Schritte – bewusst noch offen

- [ ] Erfolgreichen Fahrer aus dem Browser als JSON archivieren.
- [ ] Denselben Fahrer auf allen fünf Profilen testen und Ergebnisse festhalten.
- [ ] Für Robustheit später Startposition, Richtung und Anfangsgeschwindigkeit variieren.
- [ ] Zufalls-Seed und nachvollziehbare Modellkennungen ergänzen.
- [ ] Bei Bedarf Lernverfahren und Netzgröße mit festen Versuchsbedingungen vergleichen.
- [ ] Später das gelernte Netz an weitere Wagen übertragen; bisher fährt ein Wagen.
- [ ] Später ROS 2 mit einer Turtle-Simulation untersuchen. Noch klären: `turtlesim` oder ein TurtleBot-Szenario?
- [ ] Nach technischem Review Lizenz und öffentliches GitHub-Repository festlegen.
- [ ] Danach eine kurze Demonstration mit belegbaren Ergebnissen für LinkedIn erstellen.

> [!important] Auftragsgrenze
> In diesem Schritt wurden **keine ROS-2-Umsetzung und keine Veröffentlichung auf GitHub oder LinkedIn** beauftragt. Die Punkte werden für später festgehalten.

## Vorlage für den nächsten Eintrag

### YYYY-MM-DD – Titel

- **Ziel:**
- **Ausgangsmodell / JSON-Datei:**
- **Codeversion:**
- **Strecke und Startbedingungen:**
- **Änderung:**
- **Beobachtung / Messwerte:**
- **Erkenntnis:**
- **Offene Punkte:**
