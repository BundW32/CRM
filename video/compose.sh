#!/usr/bin/env bash
# Schnitt der Vorschau. Aus den Rohaufnahmen (2560×1440) entsteht der Master
# in 1280×720 — der Weg über die doppelte Auflösung ist der Grund, warum die
# Zoomfahrten scharf bleiben statt zu verwaschen.
set -euo pipefail
cd "$(dirname "$0")"

FF=$(node -p "require('ffmpeg-static')")
RAW=out/raw
CUT=out/cut
mkdir -p "$CUT" out

hook=$(find $RAW/01-hook -name '*.webm')
ki=$(find $RAW/02-ki   -name '*.webm')
cta=$(find $RAW/03-cta -name '*.webm')

# ── Klappe 1: Hook. Ganz leichte Zufahrt, damit das Bild nicht tot steht —
#    aber wirklich leicht (1.00 → 1.04), sonst wird es zur Dauer-Zoomerei.
"$FF" -y -loglevel error -ss 0.35 -t 3.0 -i "$hook" \
  -vf "fps=30,scale=2560:1440,zoompan=z='min(1.04,1+0.04*on/90)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=2560x1440:fps=30,scale=1280:720:flags=lanczos,fps=30,format=yuv420p" \
  -an "$CUT/01.mp4"

# ── Klappe 2: die KI-Szene. Drei Einstellungen aus einer Aufnahme:
#    a) weit, der Zeiger fährt zum Auslöser und klickt
#    b) das Widget öffnet sich und die Frage wird getippt
#    c) Zufahrt auf die Antwort samt Quellen — hier liegt der Beleg
#
#    Die Zufahrt kommt an und STEHT dann. Kein Weiterlaufen bis zum Schnitt:
#    das Auge liest nichts Bewegtes.
"$FF" -y -loglevel error -ss 2.85 -t 1.45 -i "$ki" \
  -vf "fps=30,scale=1280:720:flags=lanczos,format=yuv420p" -an "$CUT/02a.mp4"

"$FF" -y -loglevel error -ss 4.35 -t 3.3 -i "$ki" \
  -vf "fps=30,crop=1990:1120:570:120,scale=1280:720:flags=lanczos,format=yuv420p" -an "$CUT/02b.mp4"

# Zufahrt auf die Antwort: 1.0 → 1.22 über 1,2 s mit weichem Abbremsen, danach Stillstand.
"$FF" -y -loglevel error -ss 10.55 -t 4.1 -i "$ki" \
  -vf "fps=30,crop=1200:675:1360:210,scale=2560:1440,zoompan=z='if(lt(on,36),1+0.15*(1-pow(1-on/36,3)),1.15)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=2560x1440:fps=30,scale=1280:720:flags=lanczos,format=yuv420p" \
  -an "$CUT/02c.mp4"

# ── Klappe 3: Endtafel. Steht völlig still — sie ist das Plakat.
"$FF" -y -loglevel error -ss 0.3 -t 3.2 -i "$cta" \
  -vf "fps=30,scale=1280:720:flags=lanczos,format=yuv420p" -an "$CUT/03.mp4"

# ── Zusammenfügen. Harte Schnitte, keine Überblendungen: Durchgehendes
#    Kreuzblenden ist genau der Diashow-Look, den wir vermeiden wollen.
printf "file '01.mp4'\nfile '02a.mp4'\nfile '02b.mp4'\nfile '02c.mp4'\nfile '03.mp4'\n" > "$CUT/list.txt"

"$FF" -y -loglevel error -f concat -safe 0 -i "$CUT/list.txt" \
  -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -movflags +faststart -an out/vorschau.mp4

"$FF" -y -loglevel error -i out/vorschau.mp4 \
  -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 -an out/vorschau.webm

# Plakat = letzter Frame, exakt das Bild, das bei pausiertem Video steht.
"$FF" -y -loglevel error -sseof -0.2 -i out/vorschau.mp4 -vframes 1 -q:v 3 out/vorschau-poster.jpg

ls -lh out/vorschau.* | awk '{print $9, $5}'
"$FF" -i out/vorschau.mp4 2>&1 | grep -E "Duration|Stream #0:0"
