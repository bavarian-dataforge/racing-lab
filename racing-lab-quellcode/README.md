# Racing Lab — ein Wagen lernt fahren

Stand: **23. Oktober 2026** · Sprache: **JavaScript** · Oberfläche: HTML/CSS/Canvas/SVG

Eine lokale Kopie unseres sichtbaren Lernexperiments: Ein Formelwagen fährt mit sieben virtuellen Abstandssensoren. Ein kleines neuronales Netz steuert Lenkung und Fahrpedal. Das Training verbessert die Gewichte durch zufällige Veränderungen und Auswahl erfolgreicher Varianten.

Die aktuelle Online-Version: <https://flo-racing-evolution.florianbert.chatgpt.site>

## Schnell starten

1. ZIP-Datei vollständig entpacken.
2. `index.html` im Browser öffnen.
3. Auf Testkurs 01 **Training starten** wählen oder einen vorhandenen Fahrer als JSON laden.

Für zuverlässig zugeordnete Browser-Speicherung und eine konstante lokale Adresse empfehlen wir, den Ordner über einen kleinen lokalen Webserver zu öffnen. Falls Python installiert ist, im entpackten Projektordner:

```bash
python -m http.server 8000 --bind 127.0.0.1
```

Auf Systemen mit dem Befehl `python3` entsprechend:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Anschließend <http://127.0.0.1:8000> öffnen. Im Terminal beendet `Strg+C` den Server.

**Das Programm selbst bleibt JavaScript.** Python dient hier ausschließlich als optionaler Dateiserver. Zum Ausführen der Simulation sind keine Python-Pakete, kein PyTorch und kein Node.js erforderlich.

Bei direktem Öffnen über `file://` hängt die Verfügbarkeit von `localStorage` vom Browser ab. Ein Hinweis in der Oberfläche zeigt fehlgeschlagene automatische Speicherung an; JSON-Export bleibt die übertragbare Sicherung.

## Den erfolgreichen Fahrer übernehmen

Deine im Browser trainierten Gewichte sind **nicht in diesem Quellcodepaket enthalten**. Sie liegen in deinem Browser und können von hier nicht ausgelesen werden.

1. In der bisher verwendeten Online-Simulation **Protokoll als JSON** herunterladen.
2. Die lokale Kopie öffnen.
3. **JSON-Stand laden** wählen und die exportierte Datei auswählen.
4. Testkurs wählen und **Besten Fahrer testen** anklicken.

Online-Seite und lokale Adresse haben getrennte Browser-Speicher. Auch unterschiedliche Geräte, Browserprofile, Ports oder die Adressen `localhost` und `127.0.0.1` teilen den gespeicherten Stand nicht automatisch. Der JSON-Export ist der Weg dazwischen.

## Bedienung

| Element | Verhalten |
| --- | --- |
| Streckenauswahl oben links | Wählt eines von fünf festen Profilen; pausiert die Fahrt. |
| Training starten / Pause | Verbessert den Fahrer auf Testkurs 01 oder pausiert. |
| Besten Fahrer testen | Fährt mit exakt den gespeicherten besten Gewichten; kein weiteres Lernen. |
| Neu beginnen | Löscht den gespeicherten Trainingsstand und beginnt mit einem zufälligen Netz. |
| Zeitraffer | 1×, 4×, 12× oder 40× Simulationsgeschwindigkeit. Für das Beobachten 1× verwenden. |
| Sensoren | Zeigt oder verbirgt die sieben Messstrahlen. |
| Verbindung im Netz anklicken | Zeigt Bezeichnung und aktuellen Gewichtswert. |
| Protokoll als JSON | Exportiert Modellgewichte, Versuche, Messpunkte, Strecken und Prüfergebnisse. |
| Versuche als CSV | Exportiert die Tabelle der Trainingsversuche; kein vollständiges Modell. |
| JSON-Stand laden | Importiert ein kompatibles Modell mit Architektur 9–10–2. |

Testkurse 02–05 sind Prüfstrecken. Das Training ist dort bewusst gesperrt, damit eine Testfahrt die Übertragbarkeit des auf Kurs 01 trainierten Netzes misst. Es fährt genau **ein Wagen**.

## Dateien

```text
racing-lab-quellcode/
  index.html                    Oberfläche und Gestaltung
  sim.js                        Simulation, Netz, Training und Speicherung
  README.md                     Startanleitung
  package.json                  Optionaler Node-Testbefehl
  docs/
    Racing-Lab-Chronologie.md    Notiz für Obsidian
    Technik-und-Grenzen.md      Aufbau, Parameter und Grenzen
    Validierung.md              Durchgeführte Prüfungen
    Quellstand.json             Versionsstand und SHA-256-Prüfsummen
  tests/
    regression.cjs              Prüfungen ohne Browser und ohne Zusatzpakete
```

## Optional: Prüfungen ausführen

Mit installiertem Node.js im Projektordner:

```bash
node tests/regression.cjs
```

Alternativ `npm test`. Es ist keine Paketinstallation erforderlich. Diese Prüfungen kontrollieren Berechnungen und Zustandswechsel mit einem vereinfachten DOM-Ersatz. Sie ersetzen keine optische Prüfung im echten Browser.

## Spätere Schritte

Die Chronologie hält ROS 2 mit einer Turtle-Simulation, die Übertragung auf weitere Wagen sowie eine spätere Veröffentlichung auf GitHub und LinkedIn fest. Diese Schritte sind **noch nicht umgesetzt**. Vor einer Veröffentlichung sollten Lizenz, Messprotokolle, reproduzierbare Experimente und eine kurze Demonstration gemeinsam festgelegt werden.
