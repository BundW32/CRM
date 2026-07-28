# Sprechertext für das Werbevideo (Vollversion, 51,7 s)

Gerechnet auf den Schnitt aus `out/manifest.json`. Grundlage: **13,5 Zeichen
pro Sekunde** — ein ruhiges Tempo, das zu einer teils älteren Zielgruppe passt.
Jede Zeile füllt nur etwa 85 % ihrer Einstellung, der Rest bleibt Atem: Ein
Sprechertext, der bis zum Schnitt läuft, klingt gehetzt.

**Der Text wiederholt die Einblendungen bewusst.** Das Auge liest das kurze
Schlagwort, das Ohr bekommt den ganzen Satz. Zwei verschiedene Aussagen
gleichzeitig — gelesen und gehört — kosten Verständnis, statt es zu erhöhen.

**Die Loop-Fassung im Hero bleibt stumm.** Autoplay mit Ton wird von Browsern
blockiert und von Besuchern als Zumutung empfunden. Der Sprechertext gehört zur
Vollversion hinter dem Klick.

## Zeitplan

| Timecode | Bild | Sprechertext | Zeichen |
|---|---|---|---|
| 0:00,0 | Titeltafel | Keine Verwaltung für Ihre WEG? | 30 |
| 0:02,8 | Stammdaten, Anteile | Dann verwalten Sie selbst. Anteile erfassen Sie einmal. | 54 |
| 0:07,7 | Wirtschaftsplan | Der Wirtschaftsplan verteilt nach dem richtigen Schlüssel. | 57 |
| 0:12,7 | Hausgeld je Einheit | Das Hausgeld je Einheit rechnet er centgenau. | 44 |
| 0:16,7 | Konten | Die Erhaltungsrücklage bleibt getrennt. | 38 |
| 0:20,0 | CSV-Import | Den Kontoauszug lesen Sie als CSV-Datei ein. | 43 |
| 0:24,4 | Rückstandsliste | Sie sehen sofort, wer gezahlt hat. | 34 |
| 0:27,5 | Mahnwesen | Die Erinnerung kommt als fertiger Brief. | 39 |
| 0:31,1 | Abrechnung anlegen | Die Jahresabrechnung starten Sie per Klick. | 42 |
| 0:34,6 | Abrechnung fertig | Gesamt- und Einzelabrechnung, centgenau geprüft. | 47 |
| 0:39,1 | Versammlung | Versammlungen mit Tagesordnung. | 31 |
| 0:42,0 | Beschluss-Sammlung | Beschlüsse gesammelt, lückenlos. | 32 |
| 0:45,0 | Vorgänge | Schäden melden alle im Haus. | 28 |
| 0:48,1 | Endtafel | Ihre Gemeinschaft. Ihre Zahlen. | 31 |

Gesprochen rund 41 s in 51,7 s Bild — die Differenz sind die Pausen zwischen
den Einstellungen.

## Fließtext (zum Einfügen in ein Sprachwerkzeug)

```
Keine Verwaltung für Ihre WEG?
Dann verwalten Sie selbst. Anteile erfassen Sie einmal.
Der Wirtschaftsplan verteilt nach dem richtigen Schlüssel.
Das Hausgeld je Einheit rechnet er centgenau.
Die Erhaltungsrücklage bleibt getrennt.
Den Kontoauszug lesen Sie als CSV-Datei ein.
Sie sehen sofort, wer gezahlt hat.
Die Erinnerung kommt als fertiger Brief.
Die Jahresabrechnung starten Sie per Klick.
Gesamt- und Einzelabrechnung, centgenau geprüft.
Versammlungen mit Tagesordnung.
Beschlüsse gesammelt, lückenlos.
Schäden melden alle im Haus.
Ihre Gemeinschaft. Ihre Zahlen.
```

## SSML mit passenden Pausen

Die Pausen sind so gerechnet, dass jeder Satz auf seiner Einstellung landet.
Für Azure, Google Cloud TTS oder Amazon Polly direkt verwendbar.

```xml
<speak version="1.0" xml:lang="de-DE">
  <prosody rate="0.97">
    Keine Verwaltung für Ihre WEG?<break time="600ms"/>
    Dann verwalten Sie selbst. Anteile erfassen Sie einmal.<break time="900ms"/>
    Der Wirtschaftsplan verteilt nach dem richtigen Schlüssel.<break time="800ms"/>
    Das Hausgeld je Einheit rechnet er centgenau.<break time="750ms"/>
    Die Erhaltungsrücklage bleibt getrennt.<break time="600ms"/>
    Den Kontoauszug lesen Sie als CSV-Datei ein.<break time="1200ms"/>
    Sie sehen sofort, wer gezahlt hat.<break time="600ms"/>
    Die Erinnerung kommt als fertiger Brief.<break time="600ms"/>
    Die Jahresabrechnung starten Sie per Klick.<break time="500ms"/>
    Gesamt- und Einzelabrechnung, centgenau geprüft.<break time="900ms"/>
    Versammlungen mit Tagesordnung.<break time="600ms"/>
    Beschlüsse gesammelt, lückenlos.<break time="650ms"/>
    Schäden melden alle im Haus.<break time="1100ms"/>
    Ihre Gemeinschaft. Ihre Zahlen.
  </prosody>
</speak>
```

## Einstellungen für die Stimme

- **Sprache:** Deutsch (de-DE), keine österreichische oder Schweizer Variante.
- **Charakter:** ruhig, warm, mittlere Lage — jemand, der erklärt, nicht verkauft.
  Werbe- oder Radiopresets („excited", „promo") passen nicht: Die Zielgruppe
  sucht Verlässlichkeit, kein Tempo.
- **Tempo:** 0,95–1,0. Läuft eine Zeile über ihre Einstellung, das Tempo
  anpassen — nicht den Text kürzen, er trägt jeweils genau eine Aussage.
- **Aussprache prüfen:** „WEG" muss **W-E-G** buchstabiert klingen, nicht „Weg".
  Falls das Werkzeug es verschluckt: `<say-as interpret-as="characters">WEG</say-as>`
  oder ersatzweise „Eigentümergemeinschaft" sprechen.
  Ebenso prüfen: „CSV-Datei" (C-S-V) und „centgenau".

## Ton unter das Video legen

```bash
FF=$(node -p "require('ffmpeg-static')")
"$FF" -y -i out/werbevideo.mp4 -i sprecher.mp3 \
  -c:v copy -c:a aac -b:a 160k -shortest out/werbevideo-vertont.mp4
```

Danach gegenprüfen, ob Satz und Bild zusammenfallen — dieselbe Sichtprüfung wie
beim Schnitt, nur mit Ton:

```bash
"$FF" -i out/werbevideo-vertont.mp4 2>&1 | grep -E "Duration|Stream"
```

Sitzt eine Zeile zu früh oder zu spät, wird **nicht** das Video geschnitten,
sondern die Pause davor in der SSML angepasst.
