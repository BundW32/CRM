<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Konventionen dieses Portals

Kurz und verbindlich. Wer hier etwas anders macht, erzeugt Dubletten oder
unerreichbare Seiten — beides ist in diesem Projekt schon passiert.

## Navigation

Die Menüführung ist **Master-Detail**: links eine gruppierte Bereichsleiste für **alle**
Rollen, rechts der Inhalt. Auf dem Desktop gibt es **keine Kopfleiste** — Logo, Zahnrad
und Konto sitzen in der Leiste. Es gibt genau **eine** Quelle für die Menüstruktur:

- **`src/lib/app-nav.ts`** — gruppiertes Menü-Modell je Rolle (`navFor`), dazu
  `settingsItems`, `canSeeSettings`, `usesCounts`.
- **`src/components/app-shell.tsx`** — die Leiste selbst (Aktiv-Markierung, Icons,
  Ein-/Ausklappen zur Icon-Leiste, Off-Canvas auf Mobil, Konto-Popover).
- **`src/lib/nav-counts.ts`** — die Zähler-Badges.

Die Shell wird **einmal** in `src/app/(portal)/layout.tsx` eingehängt und gilt damit für
jede Portalseite. Neue Seiten brauchen **kein** eigenes Layout.

**Einen neuen Menüpunkt trägt man in `app-nav.ts` ein.** Ein Eintrag anderswo erscheint
nicht in der Leiste und wird schlicht übersehen. Das Modell speist zugleich die
**⌘K-Palette** (`src/components/command-palette.tsx`) — ein dort eingetragener Punkt ist
damit automatisch auch über die Suche erreichbar.

Die Palette hat zwei Hälften mit verschiedenen Grenzen: Sprungziele sieht **jede** Rolle,
die Datensuche (`lib/portal-search-server.ts`) läuft **nur für Verwalter** und immer
ausgehend von `…WhereForVerwalter`. Wer daran etwas ändert, prüft es gegen die
Rollen-Gegenprobe — das Adressbuch enthält die Telefonnummern aller Mieter.

Selten genutzte Punkte (Branding, Integrationen, Dokument-Quellen, Abrechnung,
Audit-Log) gehören **nicht** in die Hauptnavigation, sondern in `settingsItems` — sie
erscheinen hinter dem Zahnrad unter `/verwaltung/einstellungen`. Grund: Die Hauptliste
muss ohne Scrollen auf einen Bildschirm passen, sonst verliert sie ihren Vorteil.

Unterseiten brauchen **keinen** „Zurück"-Link zu einem Hub — die Leiste liefert den
Kontext. Ihr eigener `PageTitle` wird automatisch zur Kopfzeile des Detailbereichs.
Ausnahme: echte Unterseiten (z. B. Einstellungs-Einzelseiten) behalten ihren `back`-Slot.

Zähler-Badges werden als **nicht abgewartetes Promise** an die Shell gereicht und nur für
Verwalter geladen. Wer das ändert, verlangsamt jeden Seitenwechsel im ganzen Portal.

## Listen: Suche, Filter, Sortierung

Nie selbst gebaut — es gibt ein gemeinsames System:

- **`src/components/filter-bar.tsx`** — `FilterBar` (Freitextsuche, Filter-Pillen,
  Typeahead-Comboboxen) und `SortControl`. Alles URL-getrieben, damit Deep-Links,
  Zurück-Button und Paginierung funktionieren.
- **`src/lib/list-query.ts`** — `parsePage`, `normalizeSearch`, `resolveSort`, `toOrderBy`,
  `pageHrefFor` (die `hrefFor`-Funktion für `<Pagination>`).
- **`src/lib/list-filters.ts`** — `propertyScopeFilters()` für die Objekt→Einheit→Nutzer-
  Kaskade, `optionsFrom()` für einfache Auswahllisten.
- Feldoptik: `fieldFillClass` auf hellen Karten, `fieldOnDarkClass` auf dem dunklen Shell.

**Ein Zeitraum ist kein Auswahlfilter.** Für „von–bis" nimmt die `FilterBar` die Prop
`dateRange` (zwei Datumsfelder, URL-getrieben wie alles andere). Eine Liste fester
Spannen („letzte 30 Tage") beantwortet die Frage einer Belegeinsicht nicht — dort sucht
man den Zeitraum einer Rechnung oder eines Wirtschaftsjahres.

**Filtern ohne Summe ist nur eine kürzere Liste.** Wo Beträge in der Liste stehen,
gehört über sie eine Summenzeile — und zwar über das **ganze Filterergebnis**, nicht
über die sichtbare Seite. Sie kommt aus einem eigenen `groupBy` mit demselben `where`.
Was dabei herausfällt (Stornopaare, Umbuchungen), muss dranstehen: Eine Summe, der man
nicht ansieht, was sie nicht enthält, ist schlimmer als keine.

**`SortControl` bekommt die Trefferzahl über `total`.** Unter fünf Treffern blendet
es sich selbst aus — bei einer Handvoll Einträgen sieht man alles auf einen Blick. Die
Grenze steht in der Komponente, nicht in den Seiten; Rollen-Sperren („nur Verwalter")
gehören nicht davor: ob eine Liste lang wird, entscheidet der Bestand, nicht die Rolle.

**Der Seiten-Param heißt `page`.** Die `FilterBar` setzt ihn bei jeder Änderung zurück —
sonst stünde man nach dem Filtern auf Seite 4 eines viel kürzeren Ergebnisses und sähe
„nichts gefunden", obwohl es Treffer gibt. Genau das war auf fünf Seiten der Fall, die
ihren Param anders benannt hatten. Trägt eine Seite **mehrere** blätterbare Listen
(Hausgeld, Gemeinschaft), bekommt jede einen eigenen Namen — und dann muss ihre
Filterleiste ihn über `pageParam` erfahren, passend zum `param` von `pageHrefFor`.

**Zwei Regeln, die nicht verhandelbar sind:**
1. Filter dürfen das Access-`where` nur **verengen**, nie erweitern. Ausgangspunkt bleibt
   immer `…WhereForVerwalter` / `…WhereForUser` aus `src/lib/access.ts`.
2. Sortierfelder laufen über die **Whitelist** in `resolveSort` — niemals ein Feld direkt
   aus der URL in `orderBy` reichen.

## Personen anlegen: Dubletten vorbeugen

`inviteOrLetter` (`lib/user-invite.ts`) legt **ohne E-Mail-Adresse immer ein neues
Konto** an — der Zugangsschreiben-Weg kann eine Person nicht wiedererkennen. So bekam
ein Mieter mit fünf Einheiten fünf getrennte Zugänge.

**Jedes Formular, das Personen anlegt, schlägt deshalb vorhandene an.** Werkzeug:
`lib/person-search.ts` (`searchPersons` für den Vorschlag, `verifyExistingPerson` für
die Prüfung der gewählten ID). Im Einsatz in `objekte/neu/` und
`objekte/[id]/bearbeiten/`.

**Kein automatisches Zusammenführen über den Namen** — zwei verschiedene Menschen können
gleich heißen. Der Vorschlag nennt Objekt und Einheit; entscheiden muss der Verwalter.

**Der Datenbank-Vorschlag allein genügt nicht, wo alle Personen in EINER Absendung
entstehen.** `searchPersons` sucht im Bestand — beim Anlegen einer neuen WEG gibt es den
noch nicht. Wer in `objekte/neu` dieselbe Person für zwei Einheiten einträgt (der
Normalfall jeder Ersteinrichtung), bekam deshalb zwei getrennte Zugänge; zwei
aufeinanderfolgende Testläufe sind darüber gestolpert. Formulare mit mehreren
Personenzeilen prüfen zusätzlich **ihre eigenen Zeilen** gegeneinander
(`namensSchluessel` in `lib/weg/anteil.ts`) und **sperren das Absenden**, bis die Frage
beantwortet ist — ein zweiter Zugang darf nicht die stille Vorgabe sein, wenn der
Hinweis überlesen wird. Das versteckte Verweisfeld gilt nur für **frühere** Zeilen.

**Wer `UnitOwnership` schreibt, fragt den Anteil ab.** `sharePercent` steht auf 100, wenn
niemand etwas anderes sagt — bei einem Ehepaar mit je der Hälfte zählte der MEA der
Einheit dadurch doppelt, und die Gemeinschaft kam auf 1.147 Anteile statt 1.000. Drei
Formulare schreiben dieses Modell (`objekte/neu`, `objekte/[id]/bearbeiten`,
`weg/[propertyId]/stammdaten`); die Prozent-Auslegung steht deshalb **einmal** in
`lib/weg/anteil.ts` (`parseAnteil`, `anteilSummeStatus`). Und der Anteil bleibt nach dem
Eintragen **änderbar** — sonst führt der einzige Korrekturweg über Löschen und Neuanlegen,
also genau in die Dublette zurück.

Zwei Fallen bei den Zeilen-Formularen (`getAll()` liest indexgleich ein):
- Das versteckte `…UserId`-Feld gehört in **jede** Zeile, auch leer. Fehlt es, rutscht
  die Zuordnung aller folgenden Zeilen.
- Verknüpfte Felder werden `readOnly`, nie `disabled` — deaktivierte Felder werden nicht
  mitgeschickt und verschieben denselben Index.

## Buttons: jede Aktion meldet sich zurück

Server-Actions können nach `redirect()` nichts mehr rendern. Ohne Vorkehrung
klickt man also, und sichtbar passiert nichts — also klickt man nochmal. Genau
das hatte sich über 161 Formulare angesammelt, bevor es in einem Durchgang
begradigt wurde. **Neue Formulare halten sich an dieselben drei Regeln**, sonst
wächst die Lücke nach.

1. **Rückmeldung** — der Erfolgs-`redirect()` trägt `?flash=<code>`. Die Codes
   stehen in **`src/lib/flash.ts`**; das allgemeine Vokabular (`gespeichert`,
   `erstellt`, `geloescht`, `entfernt`, `gesendet`, …) deckt den Normalfall ab.
   Ein eigener Code lohnt nur, wenn die Meldung mehr sagt als „hat geklappt".
   Der `ToastHost` in der Portal-Shell zeigt sie auf **jeder** Seite und räumt
   den Parameter danach aus der URL.

2. **Pending-Zustand** — Submit-Buttons sind `PendingButton` oder
   `SubmitButton`, nie ein nacktes `<button type="submit">`. Beide sperren
   während der Aktion und zeigen einen Spinner.

3. **Rückfrage bei Destruktivem** — Löschen, Entfernen, Archivieren und
   Zurückziehen laufen über `ConfirmActionButton` (Text) oder
   `ConfirmDeleteButton` (Icon in Listenzeilen). Umkehrbar ist hier fast nichts.

**Auf langen Seiten gehört ein Anker dazu.** Die Weiterleitung setzt den Browser an den
Seitenanfang. Wer unten eine Einheit speichert, landet oben bei den Objekt-Einstellungen —
nach jedem einzelnen Speichern. Deshalb: `Card` nimmt ein `id` entgegen, und der
Erfolgs-`redirect()` hängt das Fragment an (`…?flash=gespeichert#einheiten`). Vorbild ist
`weg/[propertyId]/stammdaten/actions.ts`, wo der zentrale `back()`-Helfer den Anker aus der
Rückmeldung ableitet. Nötig ist das erst, wenn eine Seite mehrere Formulare untereinander
trägt — bei einem einzelnen Formular oben ist der Sprung nach oben kein Verlust.

**Drei Fallen, die schon zugeschlagen haben:**

- **Kein doppeltes Feedback.** Trägt der Rücksprung bereits einen
  Erfolgsparameter, den die Zielseite als `<Alert>` rendert, kommt **kein**
  zusätzlicher Flash dazu.
- **Fehler bleiben Banner.** Formularfehler gehören als `<Alert>` ans Formular,
  nicht in einen Toast: Sie müssen stehen bleiben, bis der Fehler behoben ist.
- **Wächter melden keinen Erfolg.** Der Flash gehört an den Erfolgs-Redirect am
  Ende der Funktion — niemals an ein frühes `if (!erlaubt) redirect(…)`. Ein
  Rechte-Fehler, der „Gespeichert." meldet, ist schlimmer als gar keine
  Rückmeldung.
- **Wächter schweigen aber auch nicht.** Der umgekehrte Fall ist genauso
  schlecht: `if (!actor.isSuperAdmin) redirect(zurueckZurListe(formData))` führt
  kommentarlos in die Liste zurück, der Eintrag steht noch da, und der Knopf
  wirkt kaputt statt gesperrt. Dafür gibt es `?flash=keine-berechtigung` — den
  einzigen Fehler-Code in `flash.ts`, weil an einer Liste kein Formular hängt,
  an das ein `<Alert>` gehören könnte. Formularfehler bleiben Banner.

**Und eine Sperre nennt, was sie sperrt.** Wer elf gezählte Beziehungen zu einer
Summe addiert und dann „z. B. Mieter, Buchungen oder Vorgänge" schreibt, hat die
Antwort in der Hand und gibt sie nicht heraus. `src/lib/belegung.ts` übersetzt
die `_count`-Schlüssel in Klartext; `belegung.test.ts` hält fest, dass jede vom
Wächter abgefragte Beziehung dort einen Namen hat — sonst fällt eine neu
hinzugefügte still aus der Meldung und sperrt weiter, ohne sich zu nennen.

Zwei Tests halten das fest: `src/lib/flash.test.ts` (jeder verwendete Code
existiert — ein fehlender schaltet die Meldung **still** ab, ohne dass
Typprüfung oder Build etwas merken) und `src/lib/button-feedback.test.ts`
(Rückfrage und Pending-Zustand). Beide laufen in der CI. Begründete Sonderfälle
gehören in die Ausnahmeliste im Test, mit Begründung — nicht in ein
abgeschaltetes `it.skip`.

### Rücksprung-Helfer

Fast jedes Aktions-Modul hat einen kleinen Helfer, der den Pfad für den
Rücksprung baut. Das ist richtig so — jedes Modul kehrt woandershin zurück.
Gewachsen ist daraus allerdings ein Zoo: vier Namen (`back`, `backTo`,
`zurueckZu`, `zurueckZurListe`) und Signaturen, die sich widersprechen — mal
ist das zweite Argument Pflicht, mal optional, mal heißt es `param`, mal
`query`, mal `suffix`, und einer nimmt drei. Ein Durchgang über alle Aktionen
ist dadurch unnötig fehleranfällig.

**Neue Module halten sich an diese Form:**

```ts
function backTo(id: string, suffix = ""): string {
  return `/pfad/${id}/unterseite${suffix}`;
}
// Aufruf: redirect(backTo(propertyId, "?flash=gespeichert"))
```

Also: Name `backTo`, zweites Argument **optional**, und das Suffix bringt sein
`?` selbst mit — dann lässt es sich unverändert anhängen und man muss beim
Aufruf nicht wissen, ob der Helfer schon eines gesetzt hat.

Die vorhandenen Abweichungen werden **nicht** in einem Rutsch umgebaut: Das
wären viele Dateien ohne jede sichtbare Verbesserung. Wer ohnehin in einer
solchen Datei arbeitet, zieht sie mit.

## Oberfläche: Bausteine benutzen, nicht nachbauen

Der Stil der Navigationsleiste soll sich im Inhalt fortsetzen. Damit das nicht wieder
auseinanderläuft, gibt es Bausteine — und drei **harte** ESLint-Regeln, die ihren
Nachbau verbieten (`eslint.oberflaeche.mjs`, Fehler, keine Warnung):

| Statt | Baustein |
|---|---|
| rohes `<input type="date">` | `DateField` (`@/components/fields`), Werte über `toDateInputValue` |
| natives `<select>` ohne Rahmen | `SelectField` — bleibt nativ, nur einheitlich gerahmt |
| handgebaute Karte | `Card` / `CollapsibleCard` (`@/components/ui`) |
| selbstgeschriebenes Etikett | `Badge` mit semantischem Ton (`@/components/data-display`) |
| Tabelle von Hand | `DataTable` — die entscheidende Spalte gehört nach vorn |
| Kennzahl als `text-3xl` | `KeyFigure` / `KeyFigures`, in Kopfzeilen `InlineFigures` |
| Abstände nach Gefühl | `stackTight` / `stack` / `stackLoose` — drei Stufen, keine acht |
| Auswahlliste, die mit dem Bestand wächst | `ComboField` (`@/components/combo-field`) — tippbar |
| „Sonstiges" mit Freitext daneben | `SelectMitSonstiges` (`@/components/select-sonstiges`) |

Die Regeln sind **eng** geschnitten: Sie treffen die Signatur des jeweiligen Bausteins,
nicht jede entfernt ähnliche Klassenkette. Eine Regel, die auch Aufklapp-Menüs und
Dialoge anmeckert, wird reihenweise abgeschaltet und ist dann weniger wert als keine.
Was sie nicht erwischt, fängt die Durchsicht ab. Ihre Grenze: Nur Klassen, die als
Zeichenkette dastehen — `className={`… ${x}`}` entzieht sich der Prüfung.

**Die Ausnahmeliste in `eslint.oberflaeche.mjs` wird nur kürzer.** Sie enthält den
Bestand, der in Wellen umgestellt wird (`docs/PLAN-Design-Vereinheitlichung.md`). Wer
eine Datei umstellt, streicht sie dort. Wer eine neue einträgt, umgeht die Regel —
`src/lib/oberflaeche-regeln.test.ts` schlägt dann fehl, und ein Eintrag für eine
gelöschte Datei ebenso (sonst wäre die Regel dort still abgeschaltet).

### Auswahllisten: ab wann tippbar

Ein `<select>` ist richtig, solange die Liste **fachlich begrenzt** ist — Status, Kategorie,
Gewerk, Sichtbarkeit. Sobald sie mit dem Bestand wächst (Objekte, Einheiten, Personen,
Handwerker), gehört `ComboField` hin: Ein Verwalter mit achtzig Objekten scrollt sonst durch
achtzig Zeilen, ohne „Kiefer" tippen zu können. Bei Objekt **und** Einheit zusammen nimmt man
`PropertyUnitFields` — dort kommt die Kaskade und das Nachladen dazu.

**Drei Fallen, alle drei schon zugeschlagen:**

- **`tone="inForm"` nicht vergessen.** `Combobox` sieht ohne diese Angabe wie ein *Filter*feld
  aus (weiche graue Füllung). Zwischen weiß gerahmten Eingabefeldern ist das ein Fremdkörper.
  `ComboField` setzt es selbst; wer `Combobox` direkt in ein Formular baut, muss es angeben.
- **`<input type="hidden" required>` prüft nichts.** Versteckte Felder sind von der
  HTML-Prüfung ausgenommen — das `required` dort ist wirkungslos, und das Formular geht leer
  ab. Ein Textfeld ohne Ausdehnung an derselben Stelle (`absolute h-0 w-0 opacity-0`) wird
  dagegen geprüft und ist anspringbar, wie in `FileInput`.
- **Das Prüffeld gehört ans Ende.** `Field` rendert ein `<label>`, und ein Klick darauf
  fokussiert das **erste** Formularfeld darin. Stand das unsichtbare Prüffeld vorn, landete
  der Fokus dort: Man klickte auf „Objekt", tippte — und nichts geschah.

### Auswahllisten: „Sonstiges" mit Freitext

Ein `<select>` mit fachlichem Enum ist entweder **abschließend** — dann bleibt
er, wie er ist; ein „Sonstiges" daran lädt nur dazu ein, an der Fachlichkeit
vorbei zu erfassen (`MajorityType`, `VoteChoice`, `ManagementType`, `Role`) —
**oder zu eng.** Dann kommen die fehlenden Werte dazu **und** ein „Sonstiges"
mit Freitextfeld. Ein „Sonstiges" ohne Freitext hilft niemandem: In der Liste
steht danach „Sonstiges", und was gemeint war, weiß keiner mehr.

Dafür gibt es **einen** Baustein, nicht sieben Eigenbauten:
`SelectMitSonstiges` (Formular) und `lib/sonstiges.ts` — `sonstigesFreitext()`
zum Annehmen, `mitFreitext()` für die Anzeige („Zisterne (Sonstiges)"). Die
Bestandsaufnahme aller Listen samt Urteil steht in
`docs/BESTANDSAUFNAHME-Auswahllisten.md`.

Drei Dinge, die dabei feststehen:

- **Der Freitext gilt nur zu „Sonstiges".** Das Eingabefeld bleibt beim
  Zurückschalten im Formular stehen (sonst verschöbe sich die Feldreihenfolge
  in `getAll()`-Formularen) und sendet weiter mit. `sonstigesFreitext()`
  verwirft ihn — sonst stünde an einem Zähler „Strom" und daneben, unsichtbar,
  noch „Zisterne".
- **Enum-Werte zu ergänzen ist in Postgres unproblematisch** (`ALTER TYPE …
  ADD VALUE`, siehe Migration `20260813090000_auswahllisten_sonstiges`) —
  solange die neuen Werte in derselben Migration nicht **verwendet** werden.
- **Keine Handaufzählung in der Server-Action.** `z.enum(["A", "B", …])`
  neben einem Formular, das seine Auswahl aus `lib/labels.ts` baut, fällt beim
  ersten neuen Wert auseinander: Das Formular bietet ihn an, die Aktion
  verwirft ihn still. Einzige Quelle ist der Beschriftungs-Katalog, der als
  `Record<Enum, string>` vollständig sein muss.

## Pflichtfelder markieren sich selbst

Ein Feld mit `required` bekommt sein Sternchen **automatisch** — `globals.css` liest das
Attribut aus und hängt es an die Beschriftung. Wer daneben selbst ein `*` ins Label
schreibt, erzeugt „Bezeichnung * *". Genau das stand nach Einführung der Regel auf drei
Seiten und musste nachgezogen werden.

**Ausnahme:** Ist ein Feld nur fachlich Pflicht, ohne `required` im HTML — etwa ein
`<select>`, das ohnehin nie leer sein kann, oder ein verknüpftes `readOnly`-Feld —, darf
der Stern von Hand im Label stehen. Für den Lesenden bedeutet er dasselbe. Nur beides
zusammen geht nicht.

Grund für den Weg über CSS statt über eine Prop: Es gibt weit über hundert Felder. Jedes
einzeln zu markieren hieße, jedes einzeln anzufassen — und ein vergessenes Feld sähe
danach freiwillig aus, obwohl es Pflicht ist. Genau diese halbe Markierung gab es
schon einmal und musste zurückgenommen werden.

## Anlegen gehört nicht neben die Liste

Viele Seiten trugen das Anlegen-Formular als feste dritte Spalte rechts (`lg:col-span-2`
für die Liste, Karte daneben). Das kostet dauerhaft ein Drittel der Breite für etwas,
das man selten braucht — und die Liste, die man täglich liest, wird dafür gequetscht.
Auf „Wartung" rutschte dadurch sogar die Aktionsspalte aus dem Bild.

**Die Form ist stattdessen:**

- **Eigene Route** `…/neu` mit dem Formular, erreichbar über einen Knopf im
  `action`-Slot des `PageTitle` (oben rechts). Vorbild: `beschluesse/neu`.
- Fehler des Formulars führen auf die **Formularseite** zurück (`…/neu?fehler=…`),
  nicht in die Liste — sonst steht die Meldung ohne die Eingabefelder da.
- Kurze Formulare mit zwei, drei Feldern dürfen stattdessen in einer
  `CollapsibleCard` **unter** der Liste sitzen. Eine eigene Seite lohnt dort nicht.

Der Bestand wird **nicht** in einem Rutsch umgestellt — das sind 18 Seiten. Wer eine
davon ohnehin anfasst, zieht sie mit.

## WEG: zwei Beschlussverfahren, die nie zusammenfallen

Ein Beschluss-Tagesordnungspunkt einer Versammlung legt **sofort** einen `Resolution`
mit Status `OFFEN` an (`versammlungen/actions.ts`) — technisch nicht unterscheidbar von
einem Umlaufbeschluss. Fachlich sind es zwei Verfahren: Beschlussfassung **in der
Versammlung** (§ 23 Abs. 1 WEG) gegenüber **Umlaufbeschluss** mit eigenen Anforderungen
(§ 23 Abs. 3 WEG). Genau diese Vermischung hat schon dazu geführt, dass Eigentümer über
einen Versammlungspunkt vorab im Portal abstimmen konnten.

**Wer offene Beschlüsse anzeigt oder Stimmen entgegennimmt, prüft die Verknüpfung.**
Maßgeblich ist ein `MeetingAgendaItem` mit einer Versammlung im Status `GEPLANT` oder
`EINBERUFEN`: Dann keine Stimmabgabe und keine Ergebnis-Prognose. Nach der Versammlung
fällt die Sperre weg — dort trägt die Verwaltung das gefasste Ergebnis ein.

Die Sperre steht **serverseitig** in `beschluesse/actions.ts` (`istVersammlungsBeschluss`,
in `castVote` **und** `castVoteForOwner`); das Ausblenden des Formulars allein genügt
nicht. `src/lib/versammlungsbeschluss.test.ts` hält beide Aufrufe fest.

## Zwei Türen, zwei Marken

Eine Codebasis bedient zwei Produkte: **B&W Kundenportal**
(portal.bundwimmobilien.de) und **wegportal24** (wegportal24.de). Unterschieden
allein über `APP_MODE` (`src/lib/app-mode.ts`).

**Wer ein Logo, einen Produktnamen oder ein Icon fest verdrahtet, baut die
falsche Marke in die andere Tür ein.** Genau das war der Zustand: Titel und
Beschreibung schalteten um, aber Favicon, Web-Manifest, die Logos der
Anmeldeseiten und der Briefkopf **jedes** erzeugten PDFs zeigten B&W — auch auf
wegportal24.de, wo es die Marke eines fremden Unternehmens ist.

| Wofür | Was zu benutzen ist |
|---|---|
| Marke auf öffentlichen Seiten (Login, Rechtsseiten, Einrichtung) | `<PublicBrand>` |
| Logo-Pfad (Portal-Kopf, Zugangsschreiben, PDF) | `defaultLogoPath()` (`lib/branding.ts`) |
| Produktname im Fließtext | `productName()` (`lib/app-mode.ts`) |
| Favicon / Push-Icon | Weiche in `src/proxy.ts` (`ICONS`) |

Zwei Fallen:

- **`defaultLogoPath()` und `isWegSaas()` lesen `APP_MODE` — eine
  Server-Variable.** Aus einer Client-Komponente aufgerufen fallen sie still
  auf die B&W-Tür zurück. Alle heutigen Aufrufer sind Server-Komponenten; das
  muss so bleiben.
- **Die Weiche gehört nicht in `rewrites()`.** Jene werden zur Bauzeit
  festgeschrieben, alles andere liest `APP_MODE` zur Laufzeit — eine Weiche,
  die als Einzige am Build hängt, läuft früher oder später auseinander. Deshalb
  steht sie im Proxy.

Bewusst B&W bleibt die **Plattform-Rechnung**
(`lib/platform-invoice-service.ts`): Dort tritt der Betreiber als
Rechnungssteller auf, nicht das Produkt.

## Prüfung: ein Skript, zwei Aufrufer

`npm run pruefung` = `tsc --noEmit && eslint && vitest run`. **Genau dieser
Eintrag** wird zweimal aufgerufen:

- vom GitHub-Workflow (`.github/workflows/pruefung.yml`) bei jedem Pull Request,
- vom **Vercel-Build** (`portal/vercel.json`), vor Migration und `next build`.

Der zweite Weg ist eine Rückfallebene: Am 29.07.2026 startete GitHub auf diesem
Repository ab 06:58 Uhr auf keinem Branch mehr Workflows — ohne Fehlermeldung.
Ein Pull Request war damit nicht mehr prüfbar, und ein grüner Vercel-Deploy
sagte nichts über die Tests aus.

**Wer die Prüfung ändert, ändert das Skript** — nicht eine der beiden
Aufrufstellen. Zwei Listen von Befehlen laufen früher oder später auseinander,
und dann prüft die eine Seite etwas, das die andere nicht prüft.

Ein Fehlschlag blockiert damit auch den Deploy, absichtlich. Wer im Notfall
daran vorbei muss, streicht `npm run pruefung && ` aus dem `buildCommand` in
`portal/vercel.json` — eine Zeile, und danach wieder hinein.

### Prüfungen mit Datenbank

`npm run test:db` (`vitest.db.config.ts`, Dateien `*.dbtest.ts`) läuft gegen eine
**echte** Datenbank und braucht eine gesetzte `DATABASE_URL`.

Diese Prüfungen gehören **nicht** in `npm run pruefung` — das Skript läuft auch im
Vercel-Build, und dort gibt es keine Datenbank. Wer sie dort einhängt, bricht den
Deploy.

**Sie laufen trotzdem bei jedem Pull Request**, in einem **eigenen Job**
(`datenbank` in `.github/workflows/pruefung.yml`) mit PostgreSQL als
Service-Container. Das war bis zum 30.07.2026 nicht so: Die Prüfungen der
Mandantentrennung lagen im Bestand, wurden aber von **niemandem** automatisch
ausgeführt, weil der Workflow nur `pruefung` aufrief. Das ist der unangenehmste
Zustand — es sieht nach Abdeckung aus und ist keine. Wer eine neue `*.dbtest.ts`
anlegt, muss nichts tun; der Job nimmt sie mit.

Hier hinein gehört alles, was Zugriffskontrolle betrifft. Eine Sperre besteht in
diesem Portal aus Datenbankabfragen mit Organisations- und Objektfiltern; ob ein
Filter wirkt, lässt sich nicht am Quelltext ablesen, sondern nur daran, was die
Abfrage zurückgibt. Die älteren Prüfungen (`kontoauszug-zugriff`,
`versammlungsbeschluss`) lesen die Seitendatei als Text und suchen Bezeichner —
das hält fest, dass die Sperre dasteht, nicht dass sie hält. Für neue
Zugriffsfunktionen ist der Weg über `src/test/harness.ts` der richtige:
`seedOrganization()` liefert zwei vollständige Organisationen, und jede Funktion
wird über Kreuz befragt.

**Attrappen für die Zugriffsschicht sind hier keine Abkürzung, sondern der
Fehler.** Ersetzt man `access.ts` oder `db` durch Attrappen, prüft man die
Verzweigungen im eigenen Code — nicht, ob die Filter halten. Genau das war bei
`assistant-finanzen` zuerst so und wurde am 30.07.2026 auf den Harnisch
umgestellt.

**Und die Kreuzprüfung gehört in beide Richtungen.** Nur A→B zu prüfen übersieht
einen Filter, der versehentlich auf eine feste Organisation zeigt: Er hält dann
in einer Richtung und ist in der anderen offen.

Zwei Fallen beim Aufbau eigener Testdaten:
- **Der Harnisch liefert je Organisation genau eine Einheit.** Wer prüfen will,
  ob jemand die *fremde* Einheit im eigenen Objekt sieht, muss eine zweite
  anlegen. Sonst gibt es nichts zu verraten, und die Prüfung geht aus dem
  falschen Grund durch — genau so ist es einmal passiert.
- **`DuePosting` braucht `periodYear` und `periodMonth`**, nicht nur `dueDate`.

## Rollen

`VERWALTER`, `EIGENTUEMER`, `MIETER`. Zusätzlich `isSuperAdmin` (Admin innerhalb einer
Organisation) und `isPlatformAdminUser` (Betreiber). Der Kontotyp der Organisation
unterscheidet **professionelle Verwaltung** von **Selbstverwaltung** (`isSelfManaged`) —
selbstverwaltete WEGs haben durchgehend eine abgespeckte Oberfläche.

Handwerker haben **kein Portalkonto**: Sie erhalten per E-Mail einen Magic-Link auf
`/auftraege/[token]` (`Craftsman.accessToken`) und können dort Auftrag annehmen, Termin
vorschlagen, kommentieren, „erledigt" melden und die Rechnung einreichen.
