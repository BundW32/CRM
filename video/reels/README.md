# Instagram-Reels (Remotion)

Schnitt-Kette für die Reels von wegportal24. Der Stil steht im Skill
`wegportal24-reel-schnitt`; hier steht nur, wie man die Kette bedient.

Wie beim Werbevideo gilt: **Das Reel ist ein Skript, kein Videoprojekt.** Der
Schnitt liegt als Code vor, nicht als Zeitleiste in einem Programm.

## Ablauf

```bash
cd video/reels
npm install
npm run material                       # Schriften + Klänge nach public/ (einmalig)

node werkzeuge/normalisieren.mjs <roh.MOV>          # → public/roh/…-1080x1920.mp4
node werkzeuge/transkribieren.mjs public/roh/<datei>.mp4   # → …-transkript.json

npm run rendern -- <CompositionId> out/<name>.mp4
```

Erster Lauf von `transkribieren.mjs` baut whisper.cpp und lädt das Modell
(~4 Minuten, ~3 GB nach `.whisper/`, außerhalb von Git).

## Drei Eigenheiten dieser Umgebung

1. **Zur Renderzeit darf nichts aus dem Netz kommen.** Der Render-Browser kennt
   die CA des Agent-Proxys nicht; `fonts.gstatic.com` und `remotion.media`
   scheitern mit `ERR_CERT_AUTHORITY_INVALID` — und zwar still: der Frame
   erscheint einfach in der Ersatzschrift. Deshalb `npm run material` vorher.
2. **Der Browser liegt schon im Image.** `remotion.config.ts` zeigt auf den
   `headless_shell` unter `/opt/pw-browsers`. Ohne das versucht Remotion einen
   eigenen Download.
3. **Schrift-Familien bleiben einwortig.** `Source Sans 3 Black` wäre als
   unquotierter CSS-Bezeichner ungültig (Ziffer als eigenes Wort) und fällt
   lautlos auf eine Serifenschrift zurück.

## Prüfbild

`Gruesttest` ist kein Reel, sondern der Nachweis, dass die Kette trägt:
Schrift geladen, Kinetic-Text gestapelt, Untertitel mit aktivem Wort, Klang,
Safe-Zone eingezeichnet.

```bash
npm run rendern -- Gruesttest out/gruesttest.mp4
```

## Was NICHT ins Repo gehört

Rohmaterial, geladene Schriften/Klänge und fertige Reels stehen in
`.gitignore`. Im Repo liegt der Bauplan, nicht die Bytes.
