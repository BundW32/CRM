// Baut die „Chat-Vorschau": eine selbsttragende HTML-Datei der öffentlichen
// Startseite, die ohne Server, ohne React und ohne externe Anfragen läuft.
//
// Grundsatz wie beim Werbevideo: kein von Hand gepflegter Nachbau. Genommen
// wird das SERVERGERENDERTE Markup der laufenden App; ein kleiner
// Vanilla-Treiber übernimmt danach genau die Arbeit, die sonst React macht —
// Scroll-Fortschritt der Bau-Szene und das Einblenden der Abschnitte. Er
// steuert dieselben `data-`-Attribute, die `scrolly-build.tsx` setzt.
//
// Aufruf (App muss unter PREVIEW_BASE_URL laufen, APP_MODE=weg):
//   node video/build-chat-vorschau.mjs > out/vorschau.html

import sharp from "sharp";
import { readFileSync } from "node:fs";

const BASE = process.env.PREVIEW_BASE_URL ?? "http://127.0.0.1:3200";
const PORTAL = new URL("../portal/", import.meta.url).pathname;

const holen = async (pfad) => {
  const r = await fetch(BASE + pfad);
  if (!r.ok) throw new Error(`${pfad} → ${r.status}`);
  return r.text();
};

const roh = await holen("/");

// ── CSS einbetten ──────────────────────────────────────────────────────────
const cssPfade = [...roh.matchAll(/href="(\/_next\/[^"]+\.css)"/g)].map((m) => m[1]);
if (cssPfade.length === 0) throw new Error("Kein Stylesheet im Markup gefunden");
let css = (await Promise.all([...new Set(cssPfade)].map(holen))).join("\n");

// ── Schriften einbetten ────────────────────────────────────────────────────
// Inter und Plus Jakarta Sans liegen selbst gehostet unter /fonts. Bleiben die
// Verweise stehen, lädt die Vorschau sie nicht (kein Server, und die CSP lässt
// ohnehin nichts nach außen) — und fällt STILL auf Systemschriften zurück. Das
// sieht man erst im Vergleich, deshalb wird hier hart abgebrochen, wenn eine
// Datei fehlt, statt eine halb richtige Vorschau auszuliefern.
const schriften = [...new Set([...css.matchAll(/url\((\/fonts\/[^)]+\.woff2)\)/g)].map((m) => m[1]))];
if (schriften.length === 0) throw new Error("Keine Schriftverweise im CSS – Muster prüfen");
for (const pfad of schriften) {
  const datei = readFileSync(`${PORTAL}public${pfad}`); // wirft, wenn sie fehlt
  css = css.replaceAll(
    `url(${pfad})`,
    `url(data:font/woff2;base64,${datei.toString("base64")})`,
  );
  process.stderr.write(`${pfad}: ${(datei.length / 1024).toFixed(0)} KB eingebettet\n`);
}

// ── Body herauslösen, Next-Skripte entfernen ───────────────────────────────
let body = roh.slice(roh.indexOf(">", roh.indexOf("<body")) + 1, roh.lastIndexOf("</body>"));
body = body.replace(/<script\b[\s\S]*?<\/script>/g, "");
// Next-Platzhalterkommentare und der versteckte Suspense-Anker tragen nichts bei.
body = body.replace(/<!--\/?\$[^>]*-->/g, "").replace(/<div hidden=""><\/div>/g, "");

// ── Fotos als data:-URI einbetten ──────────────────────────────────────────
// Die Bilder laufen über `next/image`, stehen im Markup also als
// `/_next/image?url=%2Fimages%2F…` und nicht als direkter Pfad. Zuerst fliegt
// das `srcSet` heraus — sonst stünde jede der acht Breiten als eigene Kopie
// derselben eingebetteten Datei da —, danach wird das verbleibende `src`
// ersetzt. Eingebettet wird verkleinert: Das Original hat rund 1 MB, und die
// Vorschau darf nichts nachladen (die CSP lässt keine externe Anfrage zu).
body = body.replace(/\ssrcSet="[^"]*"/g, "");
const bilder = [
  ...new Set(
    [...body.matchAll(/%2Fimages%2Fmarketing%2F([a-z-]+)\.jpg/g)].map((m) => m[1]),
  ),
];
// Kein harter Abbruch mehr, wenn gar kein Foto vorkommt: Seit dem Umbau
// arbeitet die Startseite ohne Fotos. Der Wächter, der wirklich zählt, steht
// unten je Bild – wird eines REFERENZIERT und lässt sich nicht ersetzen, ist
// das ein Fehler im Muster und bricht ab.
if (bilder.length === 0) process.stderr.write("Kein Foto im Markup – nichts einzubetten\n");
for (const name of bilder) {
  const buf = await sharp(`${PORTAL}public/images/marketing/${name}.jpg`)
    .resize({ width: 1500 })
    .jpeg({ quality: 68, mozjpeg: true })
    .toBuffer();
  const uri = `data:image/jpeg;base64,${buf.toString("base64")}`;
  const muster = new RegExp(
    `src="/_next/image\\?url=%2Fimages%2Fmarketing%2F${name}\\.jpg[^"]*"`,
    "g",
  );
  const treffer = body.match(muster)?.length ?? 0;
  if (treffer === 0) throw new Error(`${name}: kein src gefunden`);
  body = body.replace(muster, `src="${uri}"`);
  process.stderr.write(`${name}: ${(buf.length / 1024).toFixed(0)} KB, ${treffer}× eingebettet\n`);
}

// Links zeigen ins Leere – in der Vorschau gibt es keinen Server dahinter.
body = body.replace(/href="\/(?!\/)[^"]*"/g, 'href="#" data-tot');

// ── Umlaute kodierungsunabhängig machen ────────────────────────────────────
// Die Datei wird an Stellen geöffnet, die keinen Charset-Header mitschicken
// (Datei-Vorschau, Chat-Einbettung). Ohne Angabe liest der Browser Latin-1 —
// aus „Eigentümer" wird dann „EigentÃŒmer". Ein `<meta charset>` hilft hier
// nicht: Es müsste in den ersten 1024 Byte stehen, und davor liegt das
// eingebettete Stylesheet. Numerische Entities gelten dagegen in JEDER
// Kodierung.
//
// Nur das Markup wird umgesetzt: Im Stylesheet gibt es kein Zeichen über
// ASCII, und im Treiber stehen sie ausschließlich in Kommentaren. Entities
// würden dort ohnehin nicht aufgelöst.
body = body.replace(/[^\x00-\x7F]/g, (c) => `&#${c.codePointAt(0)};`);

const treiber = readFileSync(new URL("./chat-vorschau-treiber.js", import.meta.url), "utf8");

process.stdout.write(`<title>Wegportal24 – Vorschau der Startseite</title>
<style>
${css}
/* Die Vorschau steht für sich: Der dunkle Grund der App-Shell gehört zum
   Portal und hätte hier nur den Rand gefärbt. */
:root, body { background: #faf8f4; }
[data-tot] { cursor: default; }
</style>
<div class="mk-light">
${body}
</div>
<script>
${treiber}
</script>
`);
