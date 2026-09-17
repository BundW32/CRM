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

## Rohmaterial aus dem Drive (nur lokal auf dem Mac)

Diese Kette braucht das Rohmaterial als Datei. **In einer Cloud-Session geht das
nicht:** Dort gibt es keinen Drive-Ordner, nur den Drive-Connector, und der
deckelt Downloads bei 10 MB — ein Reel-Rohvideo hat 50 bis 300 MB. Läuft die
Session dagegen auf dem Mac (Claude Code im Terminal, `environment_kind:
bridge`), ist Drive ein ganz normaler Ordner und es ist schlichtes Kopieren.

Die Ordner in der geteilten Ablage:

```
B&W / 07_Social Media / Rohmaterial        ← das Gedrehte
B&W / 07_Social Media / Remotion Claude / Renders   ← die fertigen Reels
```

Auf dem Mac liegen sie unter `~/Library/CloudStorage/GoogleDrive-<adresse>/
Geteilte Ablagen/B&W/07_Social Media/` (Pfad einmal nachsehen, er hängt am
Konto).

### Ein Reel von vorn bis hinten

```bash
cd video/reels
npm install
npm run material                      # Schriften + Klänge (einmalig)

DRIVE="$HOME/Library/CloudStorage/GoogleDrive-<adresse>/Geteilte Ablagen/B&W/07_Social Media"
node werkzeuge/normalisieren.mjs "$DRIVE/Rohmaterial/<datei>.MOV"
node werkzeuge/transkribieren.mjs public/roh/<datei>-1080x1920.mp4
node werkzeuge/pausen.mjs public/roh/<datei>-1080x1920.mp4 public/roh/<datei>-1080x1920-transkript.json

# Schnittplan als src/<thema>.tsx schreiben (siehe src/Reelprobe.tsx als Vorlage),
# in src/Root.tsx eintragen, dann:
npm run rendern -- <CompositionId> out/roh.mp4
node werkzeuge/lautheit.mjs out/roh.mp4 "$DRIVE/Remotion Claude/Renders/wegportal24_<thema>_v1.mp4"
```

### Was auf dem Mac anders ist

- **Schneller.** Whisper läuft über Metal statt über vier CPU-Kerne; auch das
  Rendern zieht deutlich an.
- **Remotion lädt seinen eigenen Chrome.** Die Zeile `Config.setBrowserExecutable`
  in `remotion.config.ts` zeigt auf den Browser dieser Cloud-Umgebung — lokal
  greift die Umgebungsvariable `REMOTION_BROWSER`, sonst den Pfad anpassen.
- **Freistellung** braucht ein Python-Environment: `python3 -m venv .venv &&
  .venv/bin/pip install "rembg[cpu]" onnxruntime pillow numpy`.
- Schriften und Klänge kommen weiterhin über `npm run material` lokal ins
  `public/` — das bleibt auch dort die Regel, nicht Nachladen beim Rendern.
