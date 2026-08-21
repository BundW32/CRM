# Plan: Betreiber-Bereich aufräumen + Produkt-Nutzungstracking

Stand: 21.08.2026 · Branch `claude/super-admin-platform-review-1oz8du`

Zwei Ziele, in dieser Reihenfolge:

1. **Der Betreiber-Bereich `/plattform` wird übersichtlich.** Keine Seite
   verschwindet — SEO, Ads und Newsletter bleiben, sie werden bald befüllt.
   Weg müssen die **Doppelungen** und die drei Wege zum selben Ziel.
2. **Wir messen, wie Kundinnen das Portal tatsächlich benutzen.** Nicht nur den
   Weg bis zum Abschluss (das gibt es), sondern was danach im Produkt passiert —
   als Grundlage für spätere Auswertung und präzisere Ads.

Grundsatz für beides: **erst die Messung, dann die Anzeige.** Was heute nicht
erfasst wird, fehlt später als Historie — der erste echte Kunde ist seit Kurzem
da, jeder Tag ohne Messung ist ein Tag ohne Daten.

---

## Teil 0 — Datenschutz-Rahmen (bindend für Teil 2)

Der Änderungs-Check aus dem Datenschutz-Skill ist vor der Umsetzung
durchgegangen. Die Ergebnisse sind **Vorgaben**, keine Empfehlungen.

**Die entscheidende Grenze:** Für die Inhaltsdaten (Eigentümer, Mieter,
Handwerker, Belege) ist B&W **Auftragsverarbeiterin nach Art. 28** — diese Daten
dürfen wir nicht für eigene Zwecke auswerten. Für die Frage „wie wird das
Produkt benutzt" brauchen wir sie auch nicht. Deshalb gilt:

| Regel | Begründung |
|---|---|
| **Kein `userId`** in den neuen Nutzungsdaten | Sonst entsteht ein Verhaltensprofil einzelner Mieter/Eigentümer — genau das, was Art. 28 uns verbietet |
| Nur `organizationId` + `role` + `feature` + Zeitstempel | Das beantwortet jede Produktfrage und ist gegenüber der Einzelperson pseudonym-aggregiert |
| **Keine Inhalte**, keine Freitexte, keine Ids fremder Datensätze | Ein Ticket-Titel im Tracking wäre eine Zweckentfremdung |
| Roh-Ereignisse **90 Tage**, danach Löschung | Gleiche Frist wie `TrackEvent` — die Zusage in `/datenschutz` gilt dann auch hier |
| Tagesaggregate bleiben dauerhaft | Enthalten nur Zahlen je Organisation, kein Personenbezug |
| Kein Cookie, kein localStorage, keine IP-Speicherung | Wie das bestehende Tracking; § 25 TDDDG bleibt damit unberührt, **kein Consent-Banner nötig** |
| Kein neuer Drittdienst | Alles bleibt in der eigenen Datenbank (Neon, EU). Keine Änderung an `/avv` Ziffer 4, keine 4-Wochen-Ankündigung |

**Zu ändern sind trotzdem:**
- `/datenschutz` Ziffer 4 (Datenkategorien) und die Aussage zum Tracking —
  **beide `isWegSaas()`-Zweige**, Stand-Datum hochsetzen.
- `/avv`: die Nutzungsmessung als eigener, klar begrenzter Zweck benennen.
- `references/datenbestand.md` des Datenschutz-Skills fortschreiben.
- Art.-15-Export und `anonymizeUser`: **keine Änderung nötig** — es liegt kein
  personenbezogenes Feld vor. Das wird im Umsetzungsschritt ausdrücklich geprüft
  und in `DECISIONS.md` festgehalten.

**Nebenbefund, der mitbehoben wird:** Das Snippet (`components/tracking-snippet.tsx`)
hängt im **Root-Layout** und feuert dadurch auch auf eingeloggten Portalseiten.
Damit landen heute schon Pfade wie `/verwaltung/nutzer/…` in `TrackEvent` und
verfälschen zugleich die Marketing-Zahlen. Wird in Schritt 2.1 sauber getrennt.

---

## Teil 1 — `/plattform` übersichtlich machen

### Ist-Zustand und die konkreten Doppelungen

Hauptleiste: `Übersicht · Verwaltungen · Anfragen · Rechnungen · Auswertungen · Analytics · Audit-Log`
Analytics-Unterleiste: `Übersicht · Traffic · SEO · Ads · Abos · Newsletter · System`

| Doppelung | Wo | Auflösung |
|---|---|---|
| Zwei Seiten „Übersicht" | `/plattform`, `/plattform/analytics` | Analytics-Startseite entfällt als eigener Reiter, ihr Inhalt geht in Traffic bzw. Abos |
| „Auswertungen" ≈ „Analytics/Abos" | `statistik/page.tsx` vs. `analytics/abos` | `/plattform/statistik` entfällt; Exporte wandern zu Rechnungen |
| Registrierungen dreifach | Startseite, Analytics-Übersicht, Abos | Genau einmal, in Abos |
| Aktive Abos / MRR doppelt | Analytics-Übersicht + Abos (gleicher Code `letzterStand`) | Nur noch in Abos |
| Kacheln = Leiste | `/plattform` Kachel-Grid | Ersetzt durch „Handlungsbedarf" |
| `DatenSkeleton` 4× kopiert | alle Analytics-Seiten | Eine gemeinsame Komponente |
| Umsatzbegriff doppelt definiert | Rechnungen-brutto vs. `BusinessDaily.mrrCents` | Eine benannte Definition, überall dieselbe |

### Soll-Struktur

```
Übersicht    Handlungsbedarf + die Zahlen, die heute zählen
Verwaltungen Liste + Detail (später: Health, Nutzung)
Nutzung      NEU — was im Produkt passiert (Teil 2)
Analytics    Traffic · SEO · Ads · Abos · Newsletter · System   (bleibt komplett)
Rechnungen   inkl. CSV-/DATEV-Exporte
Anfragen
Audit-Log
```

Von 7+7 = 14 Einstiegen auf 7+6 = 13, aber **ohne jede Doppelung** und mit einer
klaren Regel: *Hauptleiste = Arbeitsbereiche, Analytics-Unterleiste = Kanäle.*

### Schritte

**1.1 Gemeinsame Bausteine ziehen**
`src/app/plattform/_components/`: `DatenSkeleton`, `KpiKachel`, `letzterStand`.
Die vier kopierten Skelette und die doppelte `letzterStand`-Abfrage verschwinden.

**1.2 Umsatzbegriff vereinheitlichen**
In `src/lib/platform-stats.ts` genau zwei benannte Größen mit Kommentar:
`mrrBrutto` (Bestand, aus `BusinessDaily`) und `umsatzBezahlt` (Ist-Zahlungen,
aus `PlatformInvoice`). Jede Anzeige sagt im Titel, welche der beiden sie zeigt.

**1.3 `/plattform/statistik` auflösen**
Charts „Neuanmeldungen" und „Umsatz bezahlter Rechnungen" wandern nach
`analytics/abos` (dort stehen schon die Tagesreihen). Die drei Export-Buttons
wandern in den Kopf von `/plattform/rechnungen`. Route wird eine Weiterleitung
auf `/plattform/rechnungen`, damit Lesezeichen nicht ins Leere laufen.

**1.4 `/plattform/analytics` (Übersicht) auflösen**
Besucherzahlen → Traffic (stehen dort ohnehin). Abos/MRR → Abos. Die Kacheln
„Ads-Kosten –" und „CAC pro Abo –" ziehen auf die Ads-Seite, wo sie hingehören.
`/plattform/analytics` leitet auf `/plattform/analytics/traffic` weiter; die
Unterleiste startet damit bei Traffic. **SEO, Ads, Newsletter bleiben
unangetastet** — ihre Platzhalter beschreiben, was kommt, und das ist richtig so.

**1.5 Startseite `/plattform` neu**
Ersetzt die Kachel-Liste durch drei Blöcke:
- **Handlungsbedarf** (nur was wirklich ansteht): Trial läuft in ≤ 7 Tagen aus ·
  `past_due` · überfällige Rechnung · offene Anfrage älter als 3 Tage ·
  Kunde seit > 14 Tagen ohne Login · letzter Ingest-Lauf fehlerhaft.
  Leer = eine ruhige Bestätigungszeile, keine leeren Karten.
- **Sechs Zahlen**: Verwaltungen aktiv · MRR brutto · aktive Abos · Trials ·
  Nutzer 30 Tage aktiv · Objekte. Nicht neun wie heute.
- **Kunden-Kurzliste** mit Aktivitätsampel (kommt mit Teil 2).

**1.6 Prüfen:** `npm run pruefung`, alle Routen einmal aufrufen.

---

## Teil 2 — Nutzungstracking

### Was wir wissen wollen

| Frage | Wofür |
|---|---|
| Loggt sich der Kunde überhaupt ein? Wie oft, welche Rollen? | Abwanderung erkennen, bevor gekündigt wird |
| Welche Module werden benutzt (Tickets, Dokumente, Nachrichten, WEG-Finanzen, Versammlungen, Übergaben)? | Tote Features erkennen, im Vertrieb das Richtige betonen |
| Kommen die eingeladenen Eigentümer/Mieter an? | Das ist der Kern des Produktversprechens |
| Wie weit kommt eine neue Verwaltung im Onboarding? | Wo bricht es ab — genau da wird nachgebessert |
| Welcher Kanal (UTM) bringt Kunden, die das Produkt **wirklich benutzen**? | **Der Ads-Hebel**: nicht Registrierungen optimieren, sondern aktive Kunden |

Die letzte Zeile ist der Grund, warum Teil 2 vor allem anderen kommt. Ads auf
Registrierungen zu optimieren ist billig und falsch; erst die Verbindung
„Kanal → aktive Nutzung nach 30 Tagen" macht die Aussteuerung präzise.

### 2.1 Erfassung sauber trennen *(Vorarbeit, behebt einen Ist-Fehler)*

`TrackingSnippet` aus `src/app/layout.tsx` herausnehmen und nur in die
öffentlichen Layouts hängen. Portalseiten melden **keine** Pageviews mehr —
sie gehören nicht in die Marketing-Statistik, und ihre Pfade tragen Ids.
Test in `tracking.test.ts` ergänzt.

### 2.2 Datenmodell

Zwei neue Modelle in `prisma/schema.prisma`, plus ein Feld:

```
model UsageEvent {            // Roh-Ereignis, 90 Tage
  id             String
  ts             DateTime
  organizationId String       // Mandantenschlüssel, wie überall
  role           Role         // VERWALTER | EIGENTUEMER | MIETER | HANDWERKER
  feature        String       // "tickets" | "dokumente" | … (feste Liste)
  action         String       // "ansicht" | "erstellt" | "abgeschlossen"
  @@index([organizationId, ts]) @@index([feature, ts]) @@index([ts])
}                             // KEIN userId — bewusst, siehe Teil 0

model UsageDaily {            // Tagesaggregat je Organisation, bleibt dauerhaft
  date, organizationId, aktiveNutzer, aktiveNutzerJeRolle Json,
  logins, ereignisse, featureJson Json
  @@unique([date, organizationId])
}
```

`User.lastLoginAt` (`DateTime?`): heute nur über `AuditLog`-Aggregation
ableitbar, was jede Ansicht teuer macht. Ein Feld, ein Schreibvorgang beim Login.
Zweck: Betriebssicherheit und Vertragserfüllung; Löschung mit dem Konto —
in `anonymizeUser` mitzurücksetzen (wird geprüft und ergänzt).

Migration unter `prisma/migrations/`, Namensschema wie bisher.

### 2.3 Erfassung im Produkt

`src/lib/analytics/usage.ts` mit **einer** Funktion `erfasseNutzung(feature, action)`,
die Organisation und Rolle aus der Session zieht. Gleiche eiserne Regel wie beim
bestehenden Tracking: **Fehler werden gefangen** — eine fehlende Protokollzeile
darf nie einen Geschäftsablauf brechen.

Eingehängt an den fachlich echten Stellen (Server-Actions, nicht im Client):
Login · Ticket erstellt/kommentiert/geschlossen · Dokument hochgeladen/gelesen ·
Nachricht gesendet · Objekt/Einheit angelegt · Nutzer eingeladen ·
WEG-Buchung/Abrechnung · Versammlung/Beschluss · Übergabe · Aktion im Adressbuch.
Die Feature-Liste ist eine `const`-Whitelist — kein Freitext.

### 2.4 Tagesaggregat

`src/lib/analytics/usage-ingest.ts`, angehängt an den bestehenden stündlichen
Ingest (`IngestRun`, Quelle `"usage"`), damit die System-Seite ihn wie die
anderen Quellen anzeigt und der Re-Sync-Knopf funktioniert. Zusätzlich in
`BusinessDaily` zwei Felder für plattformweite Aktivität — so entsteht Historie
ab Tag eins.

Retention: `UsageEvent` nach 90 Tagen löschen, in `runRetentionCleanup`
neben `TrackEvent` — mit derselben Begründung im Kommentar.

### 2.5 Kanal → aktive Nutzung *(der Ads-Teil)*

`Organization.referralSource` und die UTM-Werte des `signup_done`-Ereignisses
gegen die Nutzungsdaten stellen: je Kanal nicht nur „wie viele Registrierungen",
sondern „wie viele davon sind nach 30 Tagen noch aktiv" und „wie viele haben ein
Abo". Das ist die Zahl, nach der Ads später ausgesteuert wird. Angezeigt in
Analytics/Abos; sobald die Ads-Anbindung steht, wandert die Kostenspalte auf der
Ads-Seite daneben.

### 2.6 Anzeige

**Neuer Reiter „Nutzung"** (`/plattform/nutzung`), drei Blöcke:
- **Aktivität plattformweit**: aktive Nutzer je Tag, nach Rolle getrennt
- **Feature-Nutzung**: welches Modul, wie viele Organisationen, wie oft — als
  sortierte Tabelle, nicht als Tortendiagramm
- **Endnutzer-Adoption**: eingeladen vs. jemals eingeloggt vs. 30 Tage aktiv,
  je Rolle

**Kundendetail** (`organisationen/[id]`) bekommt:
- Letzter Login gesamt und je Rolle, aktive Nutzer 7/30 Tage
- Aktivitätsverlauf 90 Tage
- Onboarding-Checkliste: Objekt ✓ · Einheiten ✓ · Nutzer eingeladen ✗ · erstes Ticket ✗
- Ampel gesund / lau / gefährdet **mit Begründungstext** — eine Farbe ohne Grund
  ist Deko

**Kundenliste** bekommt eine Spalte „Aktivität" und einen Filter darauf.

Die Zeitraumwahl ist die bestehende (`ZeitraumFilter`), keine zweite Mechanik.

### 2.7 Rechtstexte und Dokumentation nachziehen

`/datenschutz` (beide Zweige, Stand-Datum), `/avv` (Zweck), `DECISIONS.md`
(Warum kein `userId`), `datenbestand.md` im Datenschutz-Skill.

### 2.8 Prüfen

`npm run pruefung` · `npm run test:db` (Mandantentrennung für die neuen Modelle
in `access.dbtest.ts`) · Unit-Tests für Aggregation und Ampel-Logik.

---

## Reihenfolge der Umsetzung

| # | Schritt | Warum an dieser Stelle |
|---|---|---|
| 1 | 2.1 Snippet trennen | Behebt einen laufenden Messfehler — je früher, desto weniger verfälschte Daten |
| 2 | 2.2 Schema + Migration + `lastLoginAt` | Ohne Speicher keine Messung |
| 3 | 2.3 Erfassung einhängen | **Ab hier laufen Daten auf** |
| 4 | 2.4 Aggregat + Retention | |
| 5 | 1.1–1.2 Bausteine, Umsatzbegriff | Ruhige Basis vor dem Umbau |
| 6 | 1.3–1.4 Doppelungen auflösen | |
| 7 | 2.6 Nutzungs-Seite + Kundendetail | Jetzt gibt es etwas zu zeigen |
| 8 | 1.5 Startseite mit Handlungsbedarf | Braucht die Daten aus 7 |
| 9 | 2.5 Kanal → aktive Nutzung | |
| 10 | 2.7 Rechtstexte, 2.8 Prüfung | Abschluss |

Schritte 1–4 sind zeitkritisch: Historie entsteht erst ab dem Deployment.

## Was dieser Plan bewusst NICHT enthält

- **Keine Seite wird gelöscht.** SEO, Ads und Newsletter bleiben mit ihren
  Platzhaltern in der Unterleiste.
- **Kein Verhaltensprofil einzelner Personen.** Auch nicht „nur intern".
- **Kein externes Analyse-Werkzeug.** Alles First-Party, kein Consent-Banner,
  keine Subprozessoren-Ankündigung.
- **Keine GA4-/Search-Console-/Ads-Anbindung** — das bleibt Phase 4 wie geplant.
