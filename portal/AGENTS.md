<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
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

## E-Mails: ein Versandweg, ein Textbauplan

Das Portal verschickt an rund zwei Dutzend Stellen Mails — an Verwalter,
Eigentümer, Mieter und Handwerker. Alle laufen über **`sendMail`**
(`src/lib/mailer.ts`); der Text kommt aus **`mailText`** (`src/lib/mail-text.ts`).
Beides ist nicht optional:

- **Das Branding ist Pflichtparameter.** Vorher war es optional mit B&W-Default,
  und wer ihn vergaß, verschickte still B&W-Logo und -Fußzeile an die Mieter
  eines fremden Mandanten. Betreiber-Mails (Plattform-Rechnung, Mahnung) nehmen
  `platformBranding()`, nicht das des Mandanten — Absender ist dort die
  Plattform, nicht die Verwaltung.
- **Texte werden nicht von Hand zusammengesetzt.** `mailText` legt die
  Reihenfolge fest (Anrede → Inhalt → Aufforderung → Gruß). Die Anrede kommt aus
  `briefAnrede` und ist damit dieselbe wie in den Briefen — Herr/Frau mit
  Nachnamen, sonst „Guten Tag", bei mehreren Empfängern in einem Namensfeld
  „Sehr geehrte Damen und Herren". Wer die Anrede übergibt, muss `lastName` und
  `salutation` im `select` mitladen.
- **Die Handlungsaufforderung ist genau eine Zeile:** `aktion: { label, url }`.
  Das Layout macht daraus einen Knopf. Ein Doppelpunkt in der Beschriftung oder
  Link und Beschriftung auf getrennten Zeilen zerlegen die Erkennung, und der
  Knopf entfällt **stillschweigend** — genau so waren sieben Mails bei einer
  nackten URL im Fließtext geblieben.

`src/lib/mail-text.test.ts` hält beides fest: Jede Datei, die `sendMail`
aufruft, muss den Bauplan benutzen, und keine hängt ihre Grußformel von Hand an.

**`sendMail` liefert ein Ergebnis** (`sent` / `no_recipient` / `disabled` /
`failed`) und wirft nie. Wer nur benachrichtigt, ignoriert es weiterhin. Wer dem
Nutzer aber etwas meldet, wertet es aus — sonst steht „an 12 Eigentümer
versandt" auch dann da, wenn kein SMTP eingerichtet ist und gar nichts rausging.
`summarizeMail` fasst mehrere Empfänger zusammen; für den No-Op-Fall gibt es den
Flash-Code `versand-aus`.

**Fristgebundene Mails werden protokolliert.** Einladung und Absage zur
Eigentümerversammlung, Umlaufbeschluss und Übergabeprotokoll geben `sendMail`
einen `MailContext` mit `purpose` mit; der Eintrag entsteht im Versand selbst,
nicht beim Aufrufer. Sichtbar unter `/verwaltung/versandprotokoll`. Statusmails
gehören **nicht** hinein — zwischen hunderten davon fände niemand die eine
Einladung wieder. Gespeichert wird kein Inhalt: Der Betreff genügt zum
Wiederfinden, der Volltext wäre eine zweite Kopie personenbezogener Daten mit
eigener Löschpflicht.

## Rollen

`VERWALTER`, `EIGENTUEMER`, `MIETER`. Zusätzlich `isSuperAdmin` (Admin innerhalb einer
Organisation) und `isPlatformAdminUser` (Betreiber). Der Kontotyp der Organisation
unterscheidet **professionelle Verwaltung** von **Selbstverwaltung** (`isSelfManaged`) —
selbstverwaltete WEGs haben durchgehend eine abgespeckte Oberfläche.

Handwerker haben **kein Portalkonto**: Sie erhalten per E-Mail einen Magic-Link auf
`/auftraege/[token]` (`Craftsman.accessToken`) und können dort Auftrag annehmen, Termin
vorschlagen, kommentieren, „erledigt" melden und die Rechnung einreichen.
