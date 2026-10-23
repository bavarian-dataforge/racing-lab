# Validierung des übergebenen Quellcodepakets

Stand: 23. Oktober 2026.

## Ergebnis

- `node --check sim.js`: erfolgreich.
- `node tests/regression.cjs`: erfolgreich.
- Die ausführbaren Dateien `index.html` und `sim.js` wurden unverändert aus dem aktuellen Projektstand übernommen; SHA-256-Prüfsummen stehen in `Quellstand.json`.

Die Prüfungen verwenden einen künstlichen Controller als technische Testvorgabe. Dieser Controller ist **kein trainierter erfolgreicher Fahrer** und wird nicht als Modell mitgeliefert.

## Geprüft

- Alle fünf festen Streckenprofile sind vorhanden.
- Die zwölf Original-Kontrollpunkte von Testkurs 01 sind erhalten.
- Die abgetasteten Mittellinien liegen innerhalb der Zeichenfläche und haben keine echten Segmentkreuzungen.
- Die eingefrorenen Gewichte verändern sich während einer Testfahrt nicht.
- Testfahrten auf anderen Kursen verändern den gespeicherten besten Trainingsscore und das Modell nicht.
- Der JSON-Import und -Export sowie das Wiederladen aus dem simulierten Browser-Speicher funktionieren.
- Die Ergebnisse der fünf Prüfstrecken bleiben nach einem Wiederladen erhalten.
- Die gewählte Strecke wird wiederhergestellt.
- Die Fahrzeugtransformation entspricht der berechneten Position; geprüfte Zeichenkoordinaten sind endlich.
- Training lässt sich auf Testkurs 01 fortsetzen; „Neu beginnen“ löscht den gespeicherten Trainingsstand.

## Prüfgrenzen

Die Prüfungen führen den JavaScript-Code in Node mit einem vereinfachten DOM-/Canvas-Ersatz aus. Sie prüfen Berechnung, Zeichenaufrufe und Zustandsverwaltung, **keine gerenderten Pixel und keine echte Browserbedienung**. Eine vollständige visuelle Prüfung im steuerbaren Browser war wegen wiederholter Timeouts nicht möglich.

Flos gemeldete erfolgreiche Fahrt auf Testkurs 04 ist eine Benutzerbeobachtung. Da sein exportiertes Modell und seine Messdaten nicht vorlagen, wurde diese Fahrleistung nicht unabhängig reproduziert. Das Paket enthält keine behauptete Erfolgsquote oder optimale Rundenzeit.
