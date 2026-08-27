# Marke wegportal24

## Die Quelle ist ab jetzt Vektor

`portal/public/wegportal24-logo.svg` ist die maßgebliche Fassung der
Wort-Bild-Marke, `portal/public/wegportal24-mark.svg` die quadratische
Bildmarke. Beide sind bei jeder Größe scharf — vom Favicon bis zum Bauzaun.

Das bisherige `wegportal24-logo.png` (1473 × 300) bleibt liegen, weil es an
Stellen gebraucht wird, die **kein** SVG verarbeiten:

- **PDF-Erzeugung** (`lib/documents/…`) bettet Rasterbilder ein.
- **E-Mail** — SVG im `<img>` wird von Outlook und Gmail nicht gerendert.

`defaultLogoPath()` in `lib/branding.ts` zeigt deshalb bewusst weiter auf das
PNG. Wer das umstellt, prüft beide Wege gegen.

## Farben

| Rolle | Hex |
|---|---|
| Dunkelgrün (Schrift, zwei Quadrate) | `#00241f` |
| Orange (Balken, „24") | `#f69018` — identisch mit `DEFAULT_PRIMARY` |
| Papierton (heller Grund) | `#faf8f4` |

## Aufbau der Bildmarke

Reine Geometrie, keine nachgezeichnete Kurve: zwei Quadrate 96 × 96 mit 24
Abstand, daneben (Abstand 24) ein Balken 96 × 216. Eckradius durchgehend 15.
Wer die Marke neu aufbaut, kommt mit diesen fünf Zahlen exakt auf dasselbe
Ergebnis.

Der Schriftzug liegt **in Kurven** vor. Damit braucht keine Anwendung die
Originalschrift, und es kann keine Ersatzschrift einspringen.

## Fertige Ausgaben in diesem Ordner

| Datei | Wofür |
|---|---|
| `wegportal24-profil-hell-1080.png` | Profilbild Instagram / LinkedIn, heller Grund |
| `wegportal24-profil-dunkel-1080.png` | dieselbe Marke auf Dunkelgrün |
| `wegportal24-mark-1024.png` | Bildmarke transparent, für Overlays und Video |
| `wegportal24-logo-1600.png` / `-3200.png` | volle Marke transparent, wo kein SVG geht |

**Profilbilder sind bewusst die Bildmarke allein.** Instagram beschneidet rund
und zeigt das Bild oft mit 110 px Kantenlänge — ein Schriftzug ist dort nicht
mehr lesbar, sondern nur noch ein grauer Streifen. Die Marke sitzt auf 60 % der
Kantenlänge, damit der Rundbeschnitt sie nirgends anschneidet.

**Kein Alphakanal in den Profilbildern.** Instagram legt transparente Flächen
je nach Ansicht schwarz oder weiß unter; der Grund ist deshalb fest eingebaut.

## Schutzraum

Rundherum mindestens die Breite eines Quadrats (also 96 Einheiten bzw. ein
Viertel der Markenbreite) frei lassen. Die Marke nie verzerren, nie umfärben,
nie mit Schlagschatten hinterlegen.
