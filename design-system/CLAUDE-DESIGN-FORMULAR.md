# Das Einrichtungsformular von Claude Design ausfüllen

Zum Abschreiben. Die Überschriften sind die Feldnamen aus dem Formular.

---

## 1 · Company name and blurb (or name of design system)

**Name**

```
wegportal24
```

Klein und ohne Punkt — so heißt die Marke. Nicht „WegPortal24“, nicht
„wegportal24.de“.

**Blurb**

```
wegportal24 ist das Portal für selbstverwaltete Wohnungseigentümer-
gemeinschaften – von der ersten Buchung über Versammlung und Beschluss bis
zur revisionssicheren Jahresabrechnung.

Die Marke tritt ruhig und verlässlich auf, ohne amtlich zu wirken: ein tiefes
Grün als Fläche, die alles trägt, ein warmes Orange für die eine Handlung, die
eine Seite will, und dieselbe Schrift, in der das Portal später den
Wirtschaftsplan druckt. Angesprochen werden Eigentümerinnen und Eigentümer
ohne Verwalter-Erfahrung – die Sprache ist Deutsch, die Anrede „Sie“, und
jeder Fachbegriff wird erklärt, bevor er benutzt wird.
```

---

## 2 · Examples of your design system and products

Der Ordner `design-system/vorschau/` ist genau dafür gemacht: elf
eigenständige HTML-Bögen, die Farbe, Schrift, Form, Bewegung, Marke,
Komponenten und Seitenaufbau zeigen. Sie sind aus `globals.css` erzeugt und
damit der aktuelle Stand, nicht eine Momentaufnahme.

---

## 3 · Link code

**Link code from GitHub** ist der bessere Weg — dann bleibt der Bezug zum
Repo bestehen.

```
Repo:   BundW32/CRM
Zweig:  claude/wegportal24-design-rhl6p1
```

Falls nur ein Ordner ausgewählt werden kann, in dieser Reihenfolge:

| Priorität | Ordner | Warum |
| --- | --- | --- |
| 1 | `design-system/vorschau/` | Das ganze System auf elf Seiten, ohne Anwendungscode drumherum. Die konzentrierteste Fassung. |
| 2 | `portal/src/components/marketing/` | Die echten Bausteine der öffentlichen Seiten: Kopf-/Fußzeile, Bänder, Wortmarke, Knöpfe. |
| 3 | `portal/src/app/globals.css` und `portal/src/components/ui.tsx` | Die Tokens selbst und die Bausteine hinter dem Login. |

**Nicht** das ganze `portal/` anhängen: Darin steckt überwiegend
Buchhaltungs- und WEG-Fachlogik, die für die Gestaltung nichts hergibt und
die Auswahl nur verwässert.

---

## 4 · Upload a .fig file

**Überspringen.** Es gibt keine Figma-Datei — dieses Design ist nie in Figma
entstanden, es lebt im Code. Genau deshalb ist der Ordner aus Feld 3 der
Ersatz dafür.

---

## 5 · Add fonts, logos and assets

**Schriften** (die der öffentlichen Seiten — das ist die Marken-Schrift):

```
portal/public/fonts/sourcesans-400.woff2
portal/public/fonts/sourcesans-600.woff2
portal/public/fonts/LICENSE-SourceSans3.md
```

Nur wenn auch das Portal hinter dem Login gestaltet werden soll, zusätzlich
`inter-400/500/600/700.woff2` und `jakarta-600/700/800.woff2` aus demselben
Ordner.

**Logos und Symbole:**

```
portal/public/wegportal24-logo.png
portal/public/icon-wegportal24-512.png
portal/public/icon-wegportal24-192.png
portal/public/apple-touch-icon-wegportal24.png
portal/public/favicon-wegportal24.ico
```

> **Diese Dateien gehören NICHT dazu:** `bw-logo.png`, `favicon-bw.ico`,
> `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`. Das sind die
> Symbole der Verwaltungs-Variante, also einer anderen Marke im selben Repo.
> Wandern sie mit hinein, schlägt Claude Design früher oder später etwas mit
> dem falschen Logo vor. Ebenso wenig gehören `next.svg`, `vercel.svg`,
> `globe.svg`, `window.svg` und `file.svg` dazu — das sind Reste aus der
> Next.js-Vorlage.

Die Wortmarke selbst gibt es bewusst **nicht** als Bilddatei: Sie ist Text
plus ein Bildzeichen aus vier Rechtecken
(`portal/src/components/marketing/wordmark.tsx`), damit sie scharf skaliert,
vorlesbar bleibt und keine Datei im Build braucht. Wie sie aussehen muss,
steht auf dem Bogen `marke/wortmarke.html`.

---

## 6 · Any other notes?

```
Zwei Marken liegen in diesem Repo. wegportal24 ist die öffentliche
SaaS-Variante; daneben läuft eine Verwaltungs-Variante in denselben Tönen.
Die Farben sind einmal übernommen worden, aber NICHT verbunden: eigene
--color-wp-*-Tokens. Nie vermischen, und auf den öffentlichen Seiten nie ein
anderes Unternehmen nennen – die Betreiberin steht im Impressum, wo sie nach
§ 5 DDG hingehört.

Farbe: Orange ist auf hellem Grund eine FLÄCHE, kein Text – als Text erreicht
es nur 2,4:1. Als Schrift auf hell nur --color-wp-accent-ink, auf dunkel
--color-wp-accent-bright. Der orange Knopf trägt dunkle Tinte, nie Weiß.

Handlung: Auf den öffentlichen Seiten gibt es genau eine – registrieren.
Höchstens einmal je Blickachse, daneben höchstens eine Neben-Handlung mit
Umriss statt Fläche.

Bewegung: eine einzige Kurve, --ease-mk-out. Keine Sprungkurven, kein
Überschwinger, kein animate-bounce. Wer Bewegung abschaltet, darf keine
Information verlieren.

Bausteine: kein ShadCN und keine UI-Bibliothek. Das Repo hat eigene
Komponenten und ESLint-Regeln gegen Nachbauten. Vorschläge bitte mit
components/marketing/* und components/ui.tsx bauen, nicht mit neuen
Inline-Klassensträngen.

Flächen: Die öffentlichen Seiten laufen hell auf Papierton #faf8f4, das
Portal hinter dem Login dunkel auf #1a1512. Daran liest ein Besucher ab, ob
er vor der Tür steht oder schon drin ist – nicht vertauschen.

Mobil: jedes Tap-Ziel mindestens 44 px. Höhen in svh, nie vh.

Inhalt: keine erfundenen Kundenstimmen, keine erfundenen Zahlen, keine
erzählten Einzelpersonen. Das Portal ist neu; Vertrauen entsteht hier über
Produkt- und Gesetzes-Fakten. Paragraphen nur, wenn sie stimmen.

Sprache: Deutsch, Anrede „Sie“. Zielgruppe sind Eigentümer ohne
Verwalter-Erfahrung.
```

---

Ausführlich steht das alles auf den Bögen `muster/seitenaufbau.html`,
`grundlagen/farben.html` und `grundlagen/bewegung.html` — und in
`.claude/skills/marken-seiten/SKILL.md`, der verbindlichen Fassung.
