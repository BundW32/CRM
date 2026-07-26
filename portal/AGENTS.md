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
- **`src/lib/list-query.ts`** — `parsePage`, `normalizeSearch`, `resolveSort`, `toOrderBy`.
- **`src/lib/list-filters.ts`** — `propertyScopeFilters()` für die Objekt→Einheit→Nutzer-
  Kaskade, `optionsFrom()` für einfache Auswahllisten.
- Feldoptik: `fieldFillClass` auf hellen Karten, `fieldOnDarkClass` auf dem dunklen Shell.

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

## Rollen

`VERWALTER`, `EIGENTUEMER`, `MIETER`. Zusätzlich `isSuperAdmin` (Admin innerhalb einer
Organisation) und `isPlatformAdminUser` (Betreiber). Der Kontotyp der Organisation
unterscheidet **professionelle Verwaltung** von **Selbstverwaltung** (`isSelfManaged`) —
selbstverwaltete WEGs haben durchgehend eine abgespeckte Oberfläche.

Handwerker haben **kein Portalkonto**: Sie erhalten per E-Mail einen Magic-Link auf
`/auftraege/[token]` (`Craftsman.accessToken`) und können dort Auftrag annehmen, Termin
vorschlagen, kommentieren, „erledigt" melden und die Rechnung einreichen.
