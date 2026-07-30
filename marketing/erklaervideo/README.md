# Erklärvideo Kundenportal

Ein rund 65 Sekunden langes Erklärvideo (1920×1080, 30 fps, deutscher Sprecher)
für Kundenpräsentationen und die Website. Fertige Datei:
`kundenportal-erklaervideo.mp4`.

Es beginnt mit einem animierten Firmen-Intro, zeigt danach ausschließlich echte
Screenshots des laufenden Portals – keine Mockups – und endet mit einem
animierten Abspann. Grundlage sind die Demodaten aus `portal/prisma/seed.ts`
plus `portal/prisma/demo-content.ts`.

## Aufbau

| Block | Sprechertext (Kurzform)               | Screens                                                              |
| ----- | ------------------------------------- | -------------------------------------------------------------------- |
| 0     | Firmen-Intro (animiert)               | `intro.html`                                                          |
| 1     | Problem & Portal                      | `login`, `eig-verbrauch`                                              |
| 2     | Alles auf einen Blick                 | `eig-dashboard`, `vw-weg-detail`                                      |
| 3     | Vorgänge live verfolgen               | `eig-vorgaenge`, `vw-verwaltung`                                      |
| 4     | WEG-Finanzen nachvollziehbar          | `vw-weg-wirtschaftsplan`, `vw-plan-detail`, `vw-weg-erhaltungsplanung` |
| 5     | Digital abstimmen, alles dokumentiert | `eig-beschluesse`, `eig-dokumente`                                    |
| 6     | Abspann mit Call-to-Action (animiert) | `endcard.html`                                                        |

Die Sprechertexte stehen als Liste in `build.py` (`BLOCKS`), die zugehörigen
Aufnahmen liegen als `vo/00.wav` … `vo/06.wav` bei. Die Länge jedes Blocks
richtet sich automatisch nach der Länge seiner Sprachaufnahme; die Screens
teilen sich diese Zeit nach dem Gewicht, das in `BLOCKS` hinterlegt ist.

## Schnitt und Bewegung

Kein Bild steht still. Je Screen legt `BLOCKS` eine Kamerafahrt fest:

| Fahrt   | Wirkung                                        |
| ------- | ---------------------------------------------- |
| `in`    | langsam heranfahren                            |
| `out`   | langsam herausfahren                           |
| `down`  | Schwenk nach unten über die Seite              |
| `push`  | auf einen Fokuspunkt zufahren                  |
| `pull`  | vom Fokuspunkt wegfahren                       |
| `still` | ruhig stehen (für die animierten HTML-Szenen)  |

Der Fokuspunkt ist ein Anteil von Breite und Höhe – `(0.72, 0.34)` zielt also
auf das rechte obere Drittel. Die Übergänge wechseln bewusst: `slideleft`
innerhalb eines Themas, `fade` beim Themenwechsel, `fadeblack` vor dem Abspann.

## Neu bauen

```bash
cd marketing/erklaervideo
python3 build.py          # braucht ffmpeg/ffprobe
```

Das Skript rendert je Screen einen Clip mit Kamerafahrt, blendet die
Bauchbinden ein, verkettet alles mit den hinterlegten Übergängen und legt die
auf −16 LUFS normalisierte Tonspur darunter. Die Zwischendateien in `clips/`
und `frames/` sind Wegwerfware und nicht eingecheckt.

## Intro und Abspann ändern

Beides sind normale HTML-Seiten mit CSS-Animationen (`intro.html`,
`endcard.html`). `capture.mjs` nimmt sie Bild für Bild auf: die Animationen
werden angehalten und je Einzelbild exakt positioniert, damit die Aufnahme
unabhängig von der Rechenleistung immer gleich aussieht.

```bash
node capture.mjs intro.html   frames/intro   5.6 30
node capture.mjs endcard.html frames/endcard 9.7 30
python3 build.py
```

Die Sekundenzahl muss mindestens so groß sein wie der zugehörige Block, sonst
friert `build.py` das letzte Bild ein, um die Lücke zu füllen.

## Screenshots neu aufnehmen

Voraussetzung: Portal läuft lokal auf `http://localhost:3000` mit gesetzten
Demodaten (`npx prisma db seed && npx tsx prisma/demo-content.ts`).

```bash
node shots.mjs          # Eigentümer- und Verwaltersichten
node shots2.mjs         # WEG-Finanzen im Detail
```

Aufnahme erfolgt mit 2× Pixeldichte (2880×1800), damit die Kamerafahrten im
Video scharf bleiben.

Alle Node-Skripte brauchen Playwright. Ist es global installiert, genügt ein
Symlink im Ordner: `ln -s "$(npm root -g)" node_modules`.

## Musik

Ohne Musikbett wirkt jedes Erklärvideo nüchterner, als es müsste. `build.py`
mischt automatisch eine Datei `music.mp3` unter, sobald sie in diesem Ordner
liegt: 20 dB unter der Stimme, mit weichem Ein- und Ausblenden und einer
automatischen Absenkung, sobald gesprochen wird. Es ist bewusst keine Musik
eingecheckt – dafür braucht es eine Lizenz für die geplante Nutzung.

## Sprecherstimme

Die Aufnahmen sind synthetisch und liegen in zwei Fassungen bei. `build.py`
nimmt standardmäßig `vo/`; über die Umgebungsvariable `VOICE` lässt sich eine
andere Aufnahme wählen, der Dateiname des Videos bekommt dann ein Suffix.

| Ordner     | Modell                                  | Qualität                    |
| ---------- | --------------------------------------- | --------------------------- |
| `vo/`      | Coqui VITS, deutsche Stimme „Thorsten"  | 22 kHz, ruhiger Erzählton   |
| `vo-piper/`| Piper `de-thorsten-low`                 | 16 kHz, knapper und schneller |

```bash
python3 build.py                 # Standardstimme aus vo/
VOICE=vo-piper python3 build.py  # ergibt kundenportal-erklaervideo-piper.mp4
```

Die Texte stehen in `build.py` unter `BLOCKS`. Neu einsprechen lassen sie sich
mit Coqui:

```bash
python3 -m venv venv && ./venv/bin/pip install coqui-tts "gruut[de]"
curl -sSLO https://github.com/coqui-ai/TTS/releases/download/v0.7.0_models/tts_models--de--thorsten--vits.zip
unzip tts_models--de--thorsten--vits.zip -d coqui
# in coqui/.../config.json steuert model_args.length_scale das Sprechtempo
#   (0.9 = etwas zügiger als das Original)
./venv/bin/tts --model_path coqui/.../model_file.pth \
               --config_path coqui/.../config.json \
               --text "…" --out_path vo/01.wav
```

Soll das Video mit einer professionell eingesprochenen Stimme erscheinen,
reicht es, `vo/00.wav` … `vo/06.wav` durch die neuen Aufnahmen zu ersetzen und
`build.py` erneut laufen zu lassen – die Bildlängen passen sich automatisch an.

Die Sprecherspur wird beim Bauen noch aufbereitet (`VOICE_FX` in `build.py`):
Rumpeln raus, weniger Kastenklang, mehr Präsenz, Zischlaute gebändigt, sanfte
Kompression und am Ende eine Normalisierung auf −16 LUFS.

## Hinweis zu den Demodaten

Die gezeigten Beträge, Namen und Objekte stammen aus den Demodaten
(`Demo-Objekt Goethestraße 42`, `WEG Musterstraße 12`, `Erika Eigentümerin`).
Vor einer Veröffentlichung prüfen, ob diese Beispieldaten so gezeigt werden
sollen.
