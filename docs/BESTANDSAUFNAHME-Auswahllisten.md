# Bestandsaufnahme: Auswahllisten mit fachlichem Enum

Stand 13.08.2026. Grundlage: alle `<select>` und `SelectField` unter
`portal/src/app` (107 Fundstellen), gefiltert auf **Formularfelder mit
fachlichem Enum**. Nicht aufgeführt sind Filterleisten (`FilterBar` erzeugt
ihre Auswahlfelder aus denselben Katalogen, hat aber immer die Zeile „Alle …"
und braucht deshalb kein „Sonstiges") und reine Fremdschlüssel-Auswahlen
(Objekt, Einheit, Person, Konto) — die stehen unten unter „Tippbar statt
Aufklappliste".

Beurteilt wird eine einzige Frage: **Ist die Liste fachlich abschließend?**
Wo ja, bleibt sie unverändert — ein „Sonstiges" an einer abschließenden Liste
lädt dazu ein, an der Fachlichkeit vorbei zu erfassen. Wo nein, kamen die
fehlenden Werte dazu und ein „Sonstiges" mit Freitextfeld.

---

## 1. Fachlich abschließend — bleiben unverändert

| Enum | Wo | Warum abschließend |
|---|---|---|
| `MajorityType` | `beschluesse/UmlaufMehrheit.tsx` | § 25 WEG und Gemeinschaftsordnung kennen genau diese vier Mehrheiten. |
| `VoteChoice` | `beschluesse/page.tsx` (Stimme, Ergebnis) | Ja, Nein, Enthaltung — eine fünfte Stimme gibt es nicht. |
| `ManagementType` | `objekte/neu/ObjektForm.tsx` | WEG oder Mietverwaltung; die Verwaltungsart steuert die halbe Oberfläche. |
| `Role` | `nutzer/new-user-form.tsx` | Die Rolle ist die Rechteentscheidung. Ein Freitext daran wäre eine Rolle ohne Rechte. |
| `VotingPrinciple` | `verwaltung/eigentuemer/page.tsx` | Kopf, MEA, Objekt — § 25 Abs. 2 WEG bzw. Vereinbarung. |
| `LedgerAccountKind` | `weg/…/stammdaten` | Girokonto oder Rücklagenkonto; die Trennung ist der Zweck. |
| `BookingKind` | `weg/…/buchhaltung` | Einnahme, Ausgabe, Umbuchung. Mehr Richtungen hat Geld nicht. |
| `DueDayRule` | `weg/…/stammdaten` | Monatserster, dritter Werktag, freier Tag — der freie Tag ist der Ausweg. |
| `LaborShareType` | `weg/…/stammdaten` | § 35a EStG kennt genau diese Kategorien. |
| `DistributionKey` | `weg/…/stammdaten`, `sonderumlagen` | Der Ausweg heißt hier `INDIVIDUELL` und gibt es bereits. |
| `AgendaItemType` | `versammlungen/[id]` | Ein TOP ist Information oder Beschluss. Die Unterscheidung trägt Rechtsfolgen. |
| `SepaSequence` | `weg/…/lastschrift` | FRST/RCUR/OOFF stammen aus der SEPA-Norm. |
| `TicketStatus`, `MotionStatus`, `PlanStatus`, `StatementStatus`, `HandoverStatus` | diverse | Zustandsautomaten — ein Freitext-Zustand ist kein Zustand. |
| `TicketPriority` | `vorgaenge/[id]` | Vier Stufen; eine fünfte ändert nichts an der Reihenfolge. |
| `Audience` | `dokumente/neu`, `aushaenge/neu` | Empfängerkreise des Portals. Feinere Auswahl gibt es über die Empfängerliste daneben. |
| `ContactMethod` | Kontaktformulare | E-Mail, Telefon, Mobil, Post — das sind die Wege, die das Portal selbst gehen kann. |
| `HandoverType` | Übergabeprotokoll | Einzug, Auszug, Zwischenzustand. |
| `PlatformInvoiceStatus`, `plan`, `subscriptionStatus` | `/plattform` | Betreiber-intern, an Abrechnungslogik gebunden. |
| `Trade` (Gewerk) | Kontakte, Vorgänge | Hat `SONSTIGES`, **und** daneben steht immer ein Freitext, der die Sache benennt (`Ticket.title`, `Craftsman.company`/`notes`). Ein zweiter Freitext danebengesetzt würde nur die Frage aufwerfen, welcher gilt. |
| `RoomType` | Übergabeprotokoll | Hat `SONSTIGES` — und `HandoverRoom.name` ist ein Pflicht-Freitext direkt daneben („Hobbyraum"). |
| `TicketType` | `vorgaenge/neu` | Hat `SONSTIGES`; `Ticket.title` und `Ticket.category` stehen als Freitext daneben. |
| `CostCategory` | `weg/…/stammdaten` | Grobe Bilanzgruppe mit `SONSTIGES`; der Name der Kostenart daneben ist der Freitext. |
| `UnitType` | Objektformulare | Hat `SONSTIGES`; `Unit.label` und `Unit.externalLabel` benennen die Einheit. |

---

## 2. Zu eng — Werte ergänzt, „Sonstiges" mit Freitext

Umgesetzt mit **einem** Baustein statt siebenmal von Hand:
`components/select-sonstiges.tsx` (`SelectMitSonstiges`) und
`lib/sonstiges.ts` (`sonstigesFreitext` zum Annehmen, `mitFreitext` zum
Anzeigen). Migration: `20260813090000_auswahllisten_sonstiges`.

| Enum | Vorher | Ergänzt | Freitextspalte |
|---|---|---|---|
| `MotionType` (`antraege/page.tsx`) | 2 Werte: Beschlussantrag, außerordentliche Versammlung | `TAGESORDNUNGSPUNKT`, `SONSTIGES` | `OwnerMotion.typeOther` |
| `DocumentCategory` (`dokumente/neu`, `vorgaenge/[id]`, `dokument-quellen`) | 5 Werte | `VERSICHERUNG`, `RECHNUNG`, `ANGEBOT`, `PLAN_GRUNDRISS`, `BEHOERDE` | `Document.categoryOther` |
| `MeterType` (`zaehler/page.tsx`) | 6 Werte | `WAERMEMENGE`, `ABWASSER` | `Meter.typeOther` |
| `ContactKind` (Kontaktformulare) | 5 Werte | `MESSDIENST`, `VERSICHERUNG`, `STEUERBERATUNG`, `RECHTSANWALT` | `Craftsman.kindOther` |

Der Freitext ersetzt in Listen und Karten die Kategorie: Statt zehnmal
„Sonstiges" steht dort „Zisterne (Sonstiges)".

**Zwei Fallen, die der Baustein abfängt** (beide in `select-sonstiges.tsx`
ausführlich begründet):

- Das Freitextfeld **bleibt im Formular** und wird nur aus- und eingeblendet.
  Ein Feld, das verschwindet, verschiebt in Zeilen-Formularen mit `getAll()`
  die Zuordnung aller folgenden Zeilen.
- Es ist **nur `required`, solange es sichtbar ist.** Ein ausgeblendetes
  Pflichtfeld blockiert das Absenden, ohne dass der Browser die Meldung zeigen
  kann.

Und eine, die die Serverseite abfängt: Das ausgeblendete Feld sendet seinen
alten Inhalt weiter mit. `sonstigesFreitext()` verwirft ihn, sobald ein anderer
Wert gewählt wurde — sonst stünde an einem Zähler „Strom" und daneben,
unsichtbar, noch „Zisterne".

**Nebenbei begradigt:** Fünf Server-Actions zählten die zulässigen Enum-Werte
von Hand auf (`z.enum([...])`), und eine Seite ihre `<option>` gleich mit.
Sie lesen jetzt den Beschriftungs-Katalog aus `lib/labels.ts`, der als
`Record<Enum, string>` vollständig sein **muss**.

Das war nicht nur Kosmetik: In `vorgaenge/actions.ts` bot das Formular seine
Auswahl bereits aus dem Katalog an, die Aktion prüfte aber gegen die
Handaufzählung und fiel bei allem Unbekannten still auf „Bescheinigung"
zurück. Der erste neue Wert wäre dort kommentarlos verlorengegangen — der
Nutzer hätte „Rechnung" gewählt und „Bescheinigung" bekommen.

---

## 3. Tippbar statt Aufklappliste (`ComboField`)

Nach der Regel „Auswahllisten: ab wann tippbar" aus `portal/AGENTS.md`:
Sobald eine Liste mit dem Bestand wächst, gehört `ComboField` hin.

| Wo | Feld | Wächst mit |
|---|---|---|
| `beschluesse/page.tsx` | Eigentümer (schriftliche Stimme) | Zahl der Eigentümer |
| `vorgaenge/[id]` | Handwerker, Zugewiesen an | Kontaktbuch, Team |
| `weg/…/buchhaltung` | Kostenart (2×), Handwerker | Kostenarten-Katalog, Kontaktbuch |
| `weg/…/hausgeld` | Einheit (Zahlung zuordnen) | Einheiten des Objekts |
| `weg/…/stammdaten` | Eigentümer (Einheit zuordnen) | Zahl der Eigentümer |
| `dashboard/Roadmap.tsx` | Objekt (eigener Termin) | Zahl der Objekte |
| `plattform/rechnungen/neu` | Verwaltung | Kundenbestand des Betreibers |

Beim Handwerkerfeld in `vorgaenge/[id]` gingen mit dem `<optgroup>` drei
Gruppen verloren („Intern – zuerst prüfen", „Passendes Gewerk", „Weitere").
Sie stehen jetzt als Zusatzzeile an jedem Eintrag, die Reihenfolge trägt sie
zusätzlich — die Aussage „intern zuerst prüfen" darf nicht verschwinden.

**Bewusst nicht umgestellt:**

- `verwaltung/notizen/note-form.tsx` (Mieter/Eigentümer): Das Feld ist
  **kontrolliert** und lädt seine Auswahl nach, sobald das Objekt gewechselt
  wird; es ist deaktiviert, solange kein Objekt gewählt ist. `ComboField`
  kennt weder einen von außen gesetzten Wert noch einen deaktivierten
  Zustand. Die Umstellung braucht zuerst diese beiden Angaben am Baustein —
  sonst entsteht genau die Sonderfassung, die dieser Durchgang vermeiden
  soll.
- Konten (`accountId`) in der Buchhaltung: Eine Gemeinschaft hat ein
  Girokonto und ein Rücklagenkonto. Das wächst nicht.
