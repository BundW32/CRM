# Erklärvideo Kundenportal

Ein rund 53 Sekunden langes Erklärvideo (1920×1080, 30 fps, deutscher Sprecher)
für Kundenpräsentationen und die Website. Fertige Datei:
`kundenportal-erklaervideo.mp4`.

Das Video besteht ausschließlich aus echten Screenshots des laufenden Portals –
keine Mockups. Grundlage sind die Demodaten aus `portal/prisma/seed.ts` plus
`portal/prisma/demo-content.ts`.

## Aufbau

| Block | Sprechertext (Kurzform)              | Screens                                  |
| ----- | ------------------------------------ | ---------------------------------------- |
| 1     | Problem & Portal                     | `login`, `eig-verbrauch`                 |
| 2     | Alles auf einen Blick                | `eig-dashboard`                          |
| 3     | Vorgänge live verfolgen              | `eig-vorgaenge`, `vw-verwaltung`         |
| 4     | WEG-Finanzen nachvollziehbar         | `vw-weg-wirtschaftsplan`, `vw-weg-detail` |
| 5     | Digital abstimmen, alles dokumentiert| `eig-beschluesse`, `eig-dokumente`       |
| 6     | Abspann mit Call-to-Action           | `endcard`                                |

Die Sprechertexte stehen als Liste in `build.py` (`BLOCKS`), die zugehörigen
Aufnahmen liegen als `vo/01.wav` … `vo/06.wav` bei. Die Länge jedes Blocks
richtet sich automatisch nach der Länge seiner Sprachaufnahme.

## Neu bauen

```bash
cd marketing/erklaervideo
python3 build.py          # braucht ffmpeg/ffprobe
```

Das Skript rendert je Screen einen Clip mit langsamer Kamerafahrt
(Ken-Burns), blendet die Bauchbinden ein, verkettet alles mit Kreuzblenden und
legt die auf −16 LUFS normalisierte Tonspur darunter.

## Screenshots neu aufnehmen

Voraussetzung: Portal läuft lokal auf `http://localhost:3000` mit gesetzten
Demodaten (`npx prisma db seed && npx tsx prisma/demo-content.ts`).

```bash
node shots.mjs          # Eigentümer- und Verwaltersichten
node shots2.mjs         # WEG-Finanzen im Detail
node shot-endcard.mjs   # Abspann aus endcard.html
```

Aufnahme erfolgt mit 2× Pixeldichte (2880×1800), damit die Kamerafahrten im
Video scharf bleiben.

## Sprecherstimme

Die Aufnahmen wurden lokal mit [Piper](https://github.com/rhasspy/piper) und der
deutschen Stimme `de-thorsten-low` erzeugt. Für eine neue Fassung genügt es, die
Texte in `build.py` zu ändern und die WAV-Dateien neu zu synthetisieren:

```bash
pip install piper-tts
curl -sSL -O https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-de-thorsten-low.tar.gz
tar xzf voice-de-thorsten-low.tar.gz
```

Soll das Video mit einer professionell eingesprochenen Stimme erscheinen,
reicht es, `vo/01.wav` … `vo/06.wav` durch die neuen Aufnahmen zu ersetzen und
`build.py` erneut laufen zu lassen – die Bildlängen passen sich an.

## Hinweis zu den Demodaten

Die gezeigten Beträge, Namen und Objekte stammen aus den Demodaten
(`Demo-Objekt Goethestraße 42`, `WEG Musterstraße 12`, `Erika Eigentümerin`).
Vor einer Veröffentlichung prüfen, ob diese Beispieldaten so gezeigt werden
sollen.
