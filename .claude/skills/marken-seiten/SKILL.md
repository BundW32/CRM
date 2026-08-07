---
name: marken-seiten
description: Regeln für die öffentlichen Seiten von wegportal24 (portal/src/app/page.tsx, /funktionen/*, /so-funktionierts, components/marketing/*). Immer heranziehen, wenn an Aufbau, Typografie, Farbe oder Bewegung dieser Seiten gearbeitet wird — auch bei kleinen Änderungen. Enthält den verbindlichen Seitenaufbau (11 Elemente), die Inhaltsregeln und den Prüfbefehl.
---

# Öffentliche Seiten von wegportal24

Der Auftraggeber hat den Aufbau zweimal entschieden: Ein „Dokument"-Layout aus
Haarlinien und Marginalspalten wurde verworfen; verbindlich ist der
**11-Elemente-Rahmen** des Skills `landing-page-guide` (Logo, SEO-Titel,
Haupt-CTA, Vertrauens-Fakten, Bilder, Nutzen-Karten, Stimmen, FAQ,
Abschluss-CTA, Fußzeile). Wer den Aufbau erneut ändern will, fragt zuerst.

## Der Prüfbefehl

```bash
npx --yes impeccable@latest detect portal/src/app/page.tsx portal/src/app/preise \
  portal/src/app/funktionen portal/src/app/so-funktionierts portal/src/components/marketing
```

**Auf diesen Pfaden gilt: null Befunde**, vor und nach jeder Änderung. Der
Detektor läuft offline aus dem npm-Paket. `globals.css` ist ausgenommen — die
dortigen Resttreffer betreffen das ganze Portal, nicht diese Seiten.

## Umsetzung des Rahmens in diesem Repo

- **Kein ShadCN.** Das Repo hat eigene Bausteine und harte ESLint-Regeln
  gegen Nachbauten. Der Rahmen wird mit `components/marketing/*` umgesetzt:
  `MarketingHeader`/`MarketingFooter`, `KenBurnsBackdrop`, `PhotoBand`,
  `StatsBand`, `CtaBand`, `Reveal`, `ScrollyBuild`, Wortmarke aus
  `wordmark.tsx`, Knöpfe aus `brand.tsx`.
- **FAQ als natives `<details>`** — kein Client-JS, kein Accordion-Paket.
- **Das Comic-Haus (`scrolly-build.tsx`) ist das Bewegtbild-Element** der
  Startseite und bleibt.

## Inhaltsregeln (nicht verhandelbar)

- **Keine erfundenen Kundenstimmen.** Das Portal ist neu. Der Stimmen-Slot
  wird mit Rollen in DIREKTER ANSPRACHE gefüllt („Sie übernehmen das Amt"),
  nie mit erfundenen Namen, Fotos, Sternen — und auch nicht mit erzählten
  Einzelpersonen („Die Eigentümerin, die …"): Ein Fallbericht über eine
  Person, die es nicht gibt, ist eine erfundene Referenz.
- **Vertrauens-Fakten sind Produkt- oder Gesetzes-Fakten** (kostenlos, ohne
  Zahlungsdaten, §-Angaben, echte Zahlen aus dem Demo-Datenbestand). Keine
  „500+ zufriedene Kunden".
- **Jede Funktionsbehauptung ist am Code geprüft**, bevor sie auf die Seite
  kommt. Paragraphen nur, wenn sie stimmen.
- **Nur selbstverwaltete WEGs ansprechen.** Die Registrierung der
  SaaS-Variante kennt genau einen Kontotyp (`selbstverwalter`, serverseitig
  erzwungen in `registrieren/actions.ts`) — die Seiten bieten nichts anderes
  an.
- **Preise haben EINE Quelle:** `src/app/preise/preise-daten.ts`. Das Modell:
  BEIDE Tarife je Einheit/Monat (Basic 10 €, Verwalter-Plus 13,90 € mit
  Ticket-Weg zu einem zertifizierten Verwalter nach § 26a WEG), alle Zugänge
  immer inklusive — keine Preisspaltung nach Nutzern. Stellplätze & Garagen
  (Einheiten vom Typ STELLPLATZ): pauschal 1 € je Stellplatz/Monat in beiden
  Bezahltarifen, ohne Staffel, ohne Einfluss auf Rabattstufen und
  12er-Grenze; im Start-Tarif kostenlos. Mengenstaffel: je mehr
  Einheiten, desto günstiger je Einheit (Sätze in `RABATT_STAFFEL`, vom
  Auftraggeber noch zu bestätigen). Grenze 12 Einheiten; darüber Hinweisfeld
  mit Kontakt zur Verwaltung hinter dem Portal (ohne Namensnennung). Start
  bleibt kostenlos. Seit den AGB vom 05.08.2026 festgelegt und auf den
  Seiten ausgespielt: Alle Preise sind **Bruttopreise** (Gesamtpreise inkl.
  MwSt., AGB Ziffer 6 der WEG-Fassung), **keine Mindestlaufzeit**, Kündigung
  jederzeit zum Ende des Abrechnungsmonats (AGB Ziffer 8). Die
  Brutto-Transparenz ist Verkaufsargument („10 € sind bei uns 10 €") — nicht
  wieder entfernen.
- **Der Einheiten-Regler steht über den Tarifkarten** (`tarif-bereich.tsx`):
  Beim Aufschlagen zeigen die Karten den Preis **je Einheit** — die Zahl zum
  Vergleichen. Erst wenn jemand den Regler anfasst, wird daraus der
  Monatsbetrag und die Zeile darunter sagt „Preis für Ihre WEG". Diese
  Reihenfolge ist gewollt; sie nicht umdrehen.
- **Herkunft ohne Namen:** Erfinder des Portals ist der Geschäftsführer der
  Betreiberin (einer Hausverwaltung). Auf den Seiten wird weder Firma noch
  Person genannt — nur „die Verwaltung hinter wegportal24"; Namen stehen im
  Impressum.

## Marke

- **Name:** wegportal24 (ohne Punkt). Wortmarke + Anteile-Glyph aus
  `components/marketing/wordmark.tsx`; Name/Domain/E-Mail aus `brand.tsx`.
  Kein anderes Unternehmen auf den Seiten — die Betreiberin steht im
  Impressum (§ 5 DDG), dort muss sie stehen.
- **Farben:** Grün/Orange über die `--color-wp-*`-Tokens in `globals.css`.
  Eigene Werte, kein `var()`-Verweis auf die B&W-Tokens — übernommen, nicht
  verbunden. Kontraste sind am Token-Block dokumentiert; wer ändert, rechnet
  nach. Orange auf Weiß nur als `-ink`-Variante.
- **Schrift:** Source Sans 3 (`--font-mk`, `.mk-light` setzt sie samt
  Überschriften). Es ist die Schrift der gedruckten Dokumente des Portals
  (`lib/documents/kit/fonts.ts`). Inter/Jakarta bleiben dem Portal hinter dem
  Login vorbehalten. Achtung: `h1, h2, h3` bekommen global die
  Display-Schrift — `.mk-light :is(h1,h2,h3)` überschreibt das; nicht
  entfernen.
- **Login/Registrierung/Passwort-Seiten** tragen im SaaS-Modus `wp-brand`
  (Token-Umlenkung in `globals.css`) — nie auf Mandanten-Subdomains, dort
  gilt deren White-Label-Branding.

## Bewegung

`--ease-mk-out` (exponentielles Auslaufen), sonst nichts. Keine Sprungkurven
(`cubic-bezier(.34,1.56,.64,1)`), kein `animate-bounce` — beides meldet der
Detektor. `prefers-reduced-motion` schaltet ab, ohne dass Information
verlorengeht.

## Reihenfolge beim Arbeiten

1. Detektor laufen lassen — vorher, um den Ausgangsstand zu kennen.
2. Ändern.
3. Detektor erneut: null Befunde auf den vier Pfaden.
4. `npm run pruefung` im Ordner `portal`.
5. Ansehen. `next dev` funktioniert hier nicht (CSP verbietet `eval`) —
   immer `APP_MODE=weg next build && next start`. Vorschau über
   `video/build-chat-vorschau.mjs`.

## Mobil (messbar, nicht verhandelbar)

- **Jedes Tap-Ziel ≥ 44 px** — nachmessen, nicht schätzen.
- **Der Registrieren-Weg ist auf jeder Breite dauerhaft erreichbar**: Knopf in
  der Kopfzeile plus `MobileCtaBar` (blendet sich ab ~25 % Scrolltiefe ein und
  am Abschluss-Block `#schluss-cta` wieder aus — die Fußzeile gehört mit in
  diesen Block, sonst taucht die Leiste am Seitenende wieder auf).
- **Kopfzeile einzeilig**, Navigation auf Mobil im `MobileMenu`-Overlay.
  Falle: Der Header trägt `backdrop-blur`, ein Backdrop-Filter macht sein
  Element zum Bezugsrahmen für `fixed` — Overlays deshalb per `createPortal`
  an `<body>`, nie im Header montieren.
- **Höhen in `svh`, nie `vh`** — iOS rechnet `vh` mit eingeklappter URL-Leiste,
  beim ersten Scroll springt sonst der Inhalt.
- **Scroll-Pinning nur ab `lg`.** Unter `lg` die gestapelte Fassung — per CSS
  geschaltet (`hidden lg:block` / `lg:hidden`), nicht per Client-Weiche: Der
  Server kennt die Breite nicht, ein Umschalten nach der Hydratation springt.
- **Falz-Prüfung:** Auf 375×667 (iPhone SE) liegt der Haupt-CTA ohne Scrollen
  im Bild. Mit Playwright messen (`getBoundingClientRect().bottom ≤ 667`).
