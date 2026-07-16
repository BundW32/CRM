# Umsetzungsplan — WEG-Selbstverwaltung, Schritt 1: Finanz-Fundament

Stand: 16.07.2026 · Basis: `Konzept_WEG-Selbstverwaltung.pdf` + `VibeCodingPrompt_WEGApp.md`

## Ziel dieses Schritts

Das bestehende Portal (`portal/`, Next.js 16 + Prisma + Postgres) wird **erweitert**
(nicht neu gebaut). Vorhandenes wird wiederverwendet: `Property`/`Unit`/`Ownership`,
Versammlungen (`OwnersMeeting`, `Resolution`, `weg-voting.ts`), Beschluss-Sammlung,
Anträge/Umlaufbeschluss, Dokumente, Aushänge, Mängel/Aufgaben, Audit-Log, DSGVO-Export.

Damit sind aus dem Prompt bereits abgedeckt: **M2, M6, M7** im Kern, große Teile von M8–M10.

**Die Lücke = der komplette Finanzblock.** Dieser Schritt legt das Fundament dafür
(Prompt M1 Stammdaten-Erweiterung + M3 Buchhaltung). Wirtschaftsplan (M4/M11) und
Jahresabrechnung/Vermögensbericht (M5/M12) folgen im nächsten Schritt und setzen
direkt auf den hier gebauten Modellen und der Verteilungs-Engine auf.

Nicht in diesem Schritt: Wirtschaftsplan, Jahresabrechnung, §35a-Ausweis,
Vermögensbericht, Mahnwesen, PDF-Generatoren.

## Harte Prinzipien (aus dem Prompt, immer einhalten)

1. **Zero-Key:** Alles ohne externen API-Key nutzbar. Bankumsätze nur per **CSV-Import
   + manueller Einzelbuchung**. Kein finAPI/Open-Banking in diesem Schritt — aber die
   Import-Logik hinter einem Adapter-Interface, damit ein API-Adapter später andockt.
2. **Geld = Integer-Cent**, nie Float. Es gibt schon `src/lib/money.ts`
   (`parseEuroToCents`, `formatCents`). Verteilungsdifferenzen (Restcent) der **größten
   Position** zuschlagen.
3. **Rücklage strikt getrennt** vom laufenden Konto (eigenes Konto, eigene Bilanz).
4. **Mandanten-/Scope-Wand:** jede schreibende Action prüft
   `canVerwalterAccessProperty` **und** `property.managementType === "WEG"`. Kein
   Cross-Org/Cross-Objekt-Zugriff. Muster: `src/lib/access.ts`.
5. **Audit-Log** für jede schreibende Aktion (`logAudit`, neue Konstanten in `AUDIT`).
6. **Zeitzone Europe/Berlin.** Deutsche UI, fachlich korrekte Begriffe.

---

> **An Fable:** Arbeite die Pakete AP0 → AP5 **in dieser Reihenfolge** ab. AP0 ist
> blockierend (alles baut auf dem Schema auf); AP1 (reine Logik + Tests) danach, weil
> AP3 darauf zugreift. Nach jedem Paket: `npx prisma generate`, `next build` und
> `npm test` müssen grün bleiben. Entscheide offene Detailfragen selbst und dokumentiere
> sie in `portal/DECISIONS.md` (Prompt-Vorgabe). Frage nur bei echten Widersprüchen nach.

## AP0 — Datenmodell + Migration (zuerst)

Prisma-Schema `portal/prisma/schema.prisma` erweitern, Migration erzeugen,
`prisma generate`. **Alle anderen APs bauen hierauf auf.**

### Neue Enums

```prisma
enum UnitType { WOHNUNG TEILEIGENTUM STELLPLATZ SONSTIGES }

// Umlageschlüssel je Kostenart
enum DistributionKey { MEA FLAECHE EINHEITEN PERSONEN VERBRAUCH FESTBETRAG INDIVIDUELL }

enum CostCategory { BETRIEBSKOSTEN INSTANDHALTUNG VERWALTUNG RUECKLAGENZUFUEHRUNG SONSTIGES }

// §35a EStG — Lohnanteil-Klassifizierung
enum LaborShareType { KEINE HAUSHALTSNAHE_DIENSTLEISTUNG HANDWERKERLEISTUNG }

enum LedgerAccountKind { GIRO RUECKLAGE }

// Buchungsrichtung; Betrag immer positiv, Richtung über kind
enum BookingKind { EINNAHME AUSGABE UMBUCHUNG }
```

### Felderweiterungen

`Property` +:
- `meaTotal Int?`  — MEA-Nenner (Summe aller Anteile, z. B. 1000)
- `fiscalYearStartMonth Int @default(1)` — Wirtschaftsjahr-Beginn (1 = Januar)

`Unit` +:
- `unitType UnitType @default(WOHNUNG)`
- `mea Int?` — MEA-**Zähler** dieser Einheit (Kostenverteilung; NICHT zu verwechseln
  mit `Ownership.mea` = Stimmgewicht des Eigentümers)
- `livingArea Float?` — Wohn-/Nutzfläche m²
- `personCount Int?` — Personenzahl (Schlüssel PERSONEN)
- `orderIndex Int @default(0)`
- Relationen: `bookings Booking[]` entfällt (Buchung hängt am Objekt, nicht an Einheit)

### Neue Modelle

```prisma
model CostType {                 // Kostenart
  id String @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  propertyId String
  property   Property @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  name String
  category CostCategory @default(BETRIEBSKOSTEN)
  distributionKey DistributionKey @default(MEA)
  laborShareType LaborShareType @default(KEINE)   // §35a
  recoverableBetrKV Boolean @default(false)        // umlagefähig nach BetrKV (Mieter)
  active Boolean @default(true)
  orderIndex Int @default(0)
  createdAt DateTime @default(now())
  bookings Booking[]
  @@index([propertyId])
}

model LedgerAccount {            // Konto
  id String @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  propertyId String
  property   Property @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  name String
  kind LedgerAccountKind @default(GIRO)
  iban String?
  openingBalanceCents Int @default(0)
  openingBalanceDate DateTime?
  active Boolean @default(true)
  createdAt DateTime @default(now())
  bookings Booking[]
  importBatches BankImportBatch[]
  @@index([propertyId])
}

model Booking {                  // Buchung
  id String @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  propertyId String
  property   Property @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  accountId String
  account   LedgerAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  costTypeId String?
  costType   CostType? @relation(fields: [costTypeId], references: [id], onDelete: SetNull)
  kind BookingKind
  bookingDate DateTime
  valueDate   DateTime?          // Wertstellung (aus Bankimport)
  amountCents Int                // immer positiv; Richtung über kind
  text String
  counterparty String?           // Zahlungspartner
  reference String?              // Verwendungszweck
  // Bankimport / Duplikaterkennung
  importBatchId String?
  importBatch   BankImportBatch? @relation(fields: [importBatchId], references: [id], onDelete: SetNull)
  dedupeHash String?             // Hash aus Konto+Datum+Betrag+Verwendungszweck
  // Umbuchung Giro<->Rücklage: verbindet die zwei Gegenbuchungen
  transferGroupId String?
  // Beleg (gleiche Storage-Konvention wie Handover: storedName/fileName/mimeType)
  belegStoredName String?
  belegFileName   String?
  belegMimeType   String?
  createdById String
  createdBy   User @relation(fields: [createdById], references: [id])
  createdAt DateTime @default(now())
  @@unique([accountId, dedupeHash])   // verhindert Doppelimport (NULL = manuell, mehrfach erlaubt)
  @@index([propertyId])
  @@index([accountId])
  @@index([costTypeId])
}

model BankImportBatch {          // ein CSV-Import-Vorgang (für Anzeige + Rückgängig)
  id String @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  propertyId String
  accountId String
  account   LedgerAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  fileName String
  source String @default("CSV")   // CSV | CAMT053 | MT940 (später)
  rowsTotal Int
  rowsImported Int
  rowsSkipped Int
  createdById String
  createdBy   User @relation(fields: [createdById], references: [id])
  createdAt DateTime @default(now())
  bookings Booking[]
  @@index([accountId])
}
```

Gegenrelationen an `Organization`, `Property`, `User` ergänzen
(`costTypes`, `ledgerAccounts`, `bookings`, `bankImportBatches`).

**Nebenprodukt AP0:** `portal/DECISIONS.md` anlegen und alle Selbstentscheidungen
dokumentieren (Prompt verlangt das), u. a.:
- Betrag positiv + `BookingKind` statt signiert (klare Einnahmen/Ausgaben-Reports;
  Kontostand = Anfangsbestand + Σ EINNAHME − Σ AUSGABE, Umbuchung über zwei
  Gegenbuchungen mit gemeinsamer `transferGroupId`).
- `Unit.mea` (Kostenanteil) vs. `Ownership.mea` (Stimmgewicht) bewusst getrennt.
- MEA-Nenner am Objekt (`Property.meaTotal`), Zähler je Einheit.

---

## AP1 — Reine Logik-Libs mit Unit-Tests (nach AP0)

Kein UI, keine DB — nur pure Funktionen + Vitest. Klare Contracts, ideal isoliert baubar.
Ablage: `portal/src/lib/weg/`.

### `distribution.ts`
```ts
export type Share = { unitId: string; weight: number };
// Verteilt totalCents nach Gewichten. Largest-Remainder; Restcent auf die
// betragsgrößte Position. Summe der Rückgabe == totalCents (centgenau).
export function distributeByWeight(totalCents: number, shares: Share[]): Map<string, number>;

export type UnitForDistribution = {
  id: string; mea: number | null; livingArea: number | null; personCount: number | null;
};
// Liefert die Gewichte je Einheit für einen Schlüssel (MEA/FLAECHE/EINHEITEN/PERSONEN).
// VERBRAUCH/FESTBETRAG/INDIVIDUELL werden separat (mit Zusatzdaten) behandelt.
export function weightsForKey(units: UnitForDistribution[], key: DistributionKey): Share[];
```
Tests: gleichmäßige/ungleiche Gewichte, Restcent-Regel, Summe == total, 0-Gewicht,
Einzeleinheit, negative/0 total abgefangen.

### `cost-catalog.ts`
```ts
export type CatalogEntry = {
  name: string; category: CostCategory; distributionKey: DistributionKey;
  laborShareType: LaborShareType; recoverableBetrKV: boolean;
};
export const WEG_COST_CATALOG: CatalogEntry[];  // vorbefüllter WEG-Standardkatalog
```
Inhalt (Startset): Hausmeister (haushaltsnah, MEA), Gartenpflege (haushaltsnah, MEA),
Allgemeinstrom (MEA), Wasser/Abwasser (VERBRAUCH bzw. PERSONEN), Müllabfuhr (PERSONEN),
Heizung/Warmwasser (VERBRAUCH), Gebäudeversicherung (MEA), Haftpflichtversicherung (MEA),
Aufzug (FLAECHE, Handwerkerleistung), Treppenhausreinigung (haushaltsnah, FLAECHE),
Winterdienst (haushaltsnah, FLAECHE), Verwaltungskosten (EINHEITEN, nicht umlagefähig),
Kontoführung (EINHEITEN, nicht umlagefähig), Rücklagenzuführung (MEA, Kategorie
RUECKLAGENZUFUEHRUNG). Alle editierbar nach Übernahme.

### `bank-import.ts` (Adapter-Interface + manueller CSV-Adapter)
```ts
export type RawRow = string[];
export type ColumnMapping = { date: number; amount: number; purpose: number; counterparty?: number };
export function parseCsv(content: string): { header: string[]; rows: RawRow[] };  // ; oder , autodetect
export function guessMapping(header: string[]): Partial<ColumnMapping>;            // Sparkasse/Volksbank-Header
export type ParsedBooking = {
  bookingDate: Date; amountCents: number; kind: BookingKind;
  text: string; counterparty?: string; reference: string; dedupeHash: string;
};
export function mapRows(rows: RawRow[], mapping: ColumnMapping, accountId: string): ParsedBooking[];
export function dedupeHash(accountId: string, date: Date, amountCents: number, reference: string): string;
```
Deutsche Formate: Datum `dd.mm.yyyy`, Betrag über `parseEuroToCents` (Vorzeichen →
`kind` EINNAHME/AUSGABE). Tests: Sparkasse- und Volksbank-CSV-Beispiel, Semikolon vs.
Komma, negativer Betrag → AUSGABE, Hash stabil/kollisionsfrei.

---

## AP2 — Stammdaten-UI (nach AP1)

Neuer, objektbezogener Bereich. Route-Segment: `portal/src/app/(portal)/verwaltung/weg/`.
- `weg/page.tsx` — Objektauswahl (nur `managementType=WEG` im Scope).
- `weg/[propertyId]/stammdaten/page.tsx` + `actions.ts`:
  - **Einheiten-Editor:** je Einheit `unitType`, `mea`, `livingArea`, `personCount`.
    **MEA-Summenprüfung:** Σ `Unit.mea` muss `Property.meaTotal` ergeben — verständliche
    Fehlermeldung bei Abweichung (z. B. „Summe der Anteile (940) ≠ Nenner (1000)").
  - **Kostenarten:** Liste + „Standardkatalog übernehmen" (aus `WEG_COST_CATALOG`),
    einzeln editier-/deaktivierbar (Schlüssel, Kategorie, §35a-Flag, BetrKV-Flag).
  - **Konten:** Giro + Rücklage anlegen (Name, IBAN optional, Anfangsbestand + Stichtag).
- Zugriff: `requireVerwalter` + `canVerwalterAccessProperty` + WEG-Check; `logAudit`.
- UI-Bausteine aus `src/components/ui.tsx` (`Card`, `PageTitle`, `Field`, `Alert`,
  `buttonClass` …). Server Actions + `revalidatePath`, Muster wie `antraege/actions.ts`.

## AP3 — Buchhaltung-UI (nach AP0 + AP1 `bank-import`)

- `weg/[propertyId]/buchhaltung/page.tsx` + `actions.ts`:
  - **Kontenübersicht** mit laufendem Saldo (Anfangsbestand + Σ Einnahmen − Σ Ausgaben),
    Rücklage separat.
  - **Manuelle Buchung:** Datum, Betrag (`parseEuroToCents`), Richtung, Kostenart,
    Konto, Text, **Beleg-Upload** (`saveUpload`, `DOCUMENT_TYPES`).
  - **Umbuchung** Giro↔Rücklage (erzeugt zwei Gegenbuchungen, gemeinsame
    `transferGroupId`).
  - **CSV-Import-Assistent:** Datei hoch → `parseCsv`/`guessMapping` → Spalten-Mapping
    bestätigen → Vorschau mit **Duplikat-Markierung** (`dedupeHash` gegen Bestand) →
    Import als `BankImportBatch` + Buchungen. Duplikate werden übersprungen und gezählt.
- Beleg-Auslieferung: neuer `kind === "beleg"` in
  `src/app/api/files/[kind]/[id]/route.ts` mit Scope-Prüfung (Buchung → Objekt →
  `canVerwalterAccessProperty`). Muster: bestehende `handover-*`-Zweige.

## AP4 — Verdrahtung (klein, nach AP2/AP3)

- Navigation: WEG-Finanzbereich im Verwaltungsmenü nur für Orgs/Objekte mit WEG anzeigen.
- `AUDIT`-Konstanten ergänzen (`WEG_COSTTYPE_SAVED`, `WEG_ACCOUNT_SAVED`,
  `WEG_BOOKING_CREATED`, `WEG_BANK_IMPORT`).
- Labels/Übersetzungen in `src/lib/labels.ts` für neue Enums.

## AP5 — Seed + Smoke-Test (nach AP0–AP4)

- Seed-Skript um Demo-WEG „Musterstraße 12" erweitern: 6 Einheiten mit MEA/Fläche/
  Personen, Giro + Rücklage mit Anfangsbeständen, Kostenarten aus Katalog, einige
  Buchungen (inkl. einer Umbuchung in die Rücklage).
- Kurz-README-Abschnitt „WEG-Selbstverwaltung testen".

---

## Baureihenfolge (sequentiell)

| # | Paket | Abhängigkeit |
|---|---|---|
| AP0 | Schema + Migration + DECISIONS.md | — (zuerst) |
| AP1 | `distribution.ts` / `cost-catalog.ts` / `bank-import.ts` + Tests | AP0 |
| AP2 | Stammdaten-UI | AP1 |
| AP3 | Buchhaltung-UI | AP1, AP2 |
| AP4 | Verdrahtung (Navigation, Audit, Labels) | AP2, AP3 |
| AP5 | Seed + Smoke-Test | AP0–AP4 |

Die AP1-Signaturen oben sind der verbindliche Contract für AP2/AP3 — nicht abweichen.
Branch: `claude/sweet-babbage-4fmjjb`. Nach jedem AP committen; nach AP5 pushen.

## Definition of Done (dieser Schritt)

- `prisma migrate` + Build (`next build`) laufen grün; `npm test` (Vitest) grün.
- WEG-Objekt: Einheiten mit MEA anlegbar, MEA-Summenprüfung greift; Kostenkatalog
  übernehmbar; Giro + Rücklage anlegbar.
- Manuelle Buchung mit Beleg **und** Sparkassen-/Volksbank-CSV-Import mit
  Duplikaterkennung funktionieren **ohne einen einzigen API-Key**.
- Verteilungs-Engine centgenau (Tests). Alle schreibenden Aktionen im Audit-Log,
  strikt WEG-/Objekt-gescoped.
