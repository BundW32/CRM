# Auftrag: zwei Instagram-Reels schneiden

Übergabe an eine Session, die **auf dem Mac** läuft. Dort liegt der Drive als
Ordner — in einer Cloud-Session ist der Connector bei 10 MB gedeckelt und das
Rohmaterial (48 und 60 MB) kommt nicht durch.

## Material

Geteilte Ablage `B&W / 07_Social Media`:

| | |
|---|---|
| Rohmaterial | `Rohmaterial/B1FC77F9-A395-4F06-A51E-69443AD8BA98.MOV` (48 MB, ~0:08) |
| | `Rohmaterial/E98B4F4D-63B5-4475-8364-42026B9AD0D1.MOV` (60 MB, ~0:50) |
| Ziel | `Remotion Claude/Renders/wegportal24_<thema>_v1.mp4` |

Gedreht am 16.09.2026 vor **Greenscreen**. Das ist ein Vorteil: Für „Text
hinter der Person" reicht ein Chroma-Key (`colorkey`/`chromakey` in ffmpeg),
sauberer und schneller als die KI-Freistellung in `werkzeuge/freistellen.py`.
Die bleibt als Rückfall, falls der Key an Haaren ausfranst.

## Entschieden (nicht neu aufrollen)

- **Schrift der Kinetic-Texte:** Montserrat Black. Alex hat zwischen
  Montserrat, Poppins, Source Sans 3 Black und Anton an gerenderten Proben
  gewählt.
- **Ansprache in den Overlays:** Ihr/Euch. Untertitel bleiben wörtlich am
  Gesprochenen.
- **B-Roll:** aus dem laufenden Portal selbst aufnehmen (Playwright-Kette unter
  `video/`), nicht aus Screenrecordings. Schärfer, Demo-Daten statt echter
  Eigentümer, jederzeit wiederholbar.
- **Freigabe:** Schnittplan **und** ein 8-Sekunden-Hook zusammen zeigen, bevor
  das ganze Reel rendert. Alex entscheidet am Bild, nicht an der Tabelle.

## Noch offen — vor dem Rendern bei Alex klären

1. **Abbinder/CTA:** Was steht in den letzten ~2 Sekunden? Domain, Handle,
   Satz? Gibt es einen festen Wortlaut?
2. **Darf die Reihenfolge geändert werden** — also der stärkste Satz aus der
   Mitte nach vorn als Hook, oder bleibt es chronologisch?
3. **Namens-Insert:** Wer spricht, und soll kurz „Alex · Hausverwalter" o. ä.
   eingeblendet werden?

## Ablauf

Stil und Regeln stehen im Skill `wegportal24-reel-schnitt`; die Werkzeuge und
die drei Umgebungs-Eigenheiten stehen in `README.md`. Kurzform:

```bash
cd video/reels && npm install && npm run material
node werkzeuge/normalisieren.mjs "<Drive>/Rohmaterial/<datei>.MOV"
node werkzeuge/transkribieren.mjs public/roh/<datei>-1080x1920.mp4
node --experimental-strip-types werkzeuge/pausen.ts public/roh/<datei>-1080x1920.mp4 public/roh/<datei>-1080x1920-transkript.json
# Schnittplan als src/<thema>.tsx (Vorlage: src/Reelprobe.tsx), in src/Root.tsx eintragen
npm run rendern -- <CompositionId> out/roh.mp4
node werkzeuge/lautheit.mjs out/roh.mp4 "<Drive>/Remotion Claude/Renders/wegportal24_<thema>_v1.mp4"
```

Zuerst Versprecher, „äh" und Denkpausen herausnehmen, damit die Länge stimmt —
`werkzeuge/pausen.ts` liefert die Fundstellen aus zwei Quellen, entschieden
wird im Schnittplan. Ein kurzer Bruch vor der wichtigsten Aussage bleibt
bewusst stehen.

## Was schon geprüft ist

Die Kette ist nicht nur gebaut, sondern an echtem Material durchgefahren:
Transkription deutsch mit korrekten Fachbegriffen, Pausen-Erkennung,
Zeitachse (Untertitel sitzen nach jedem Schnitt noch auf dem Wort),
Freistellung, Lautheit auf −14 LUFS, Untertitel und Kinetic-Texte im Bild.
`npm run pruefen` fährt die Prüfungen.

Offen und ungeprüft ist nur, was Material braucht: der Chroma-Key auf dem
Greenscreen und die B-Roll-Aufnahme aus dem Portal.
