<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Konventionen dieses Portals

Kurz und verbindlich. Wer hier etwas anders macht, erzeugt Dubletten oder
unerreichbare Seiten — beides ist in diesem Projekt schon passiert.

## Navigation

Die Menüführung ist **Master-Detail**: links eine gruppierte Bereichsliste, rechts der
Inhalt. Es gibt genau **eine** Quelle für die Menüstruktur:

- **`src/lib/verwaltung-nav.ts`** — gruppiertes Menü-Modell (Stammdaten / WEG / Betrieb /
  Einstellungen) samt Sichtbarkeitsregeln (`verwaltungGroups`).
- **`src/components/verwaltung-shell.tsx`** — die Sidebar selbst (Aktiv-Markierung,
  Icons, Ein-/Ausklappen, Off-Canvas auf Mobil).
- **`src/components/verwaltung-chrome.tsx`** — entscheidet anhand der Rolle, ob die
  Sidebar erscheint. Eigentümer und Mieter nutzen dieselben Routen und dürfen sie **nicht**
  sehen.

**Einen neuen Menüpunkt trägt man in `verwaltung-nav.ts` ein — nicht in `layout.tsx`.**
Ein Eintrag in `navByRole` erscheint nicht in der Sidebar und wird schlicht übersehen.

Liegt eine Seite außerhalb von `/verwaltung`, gehört sie trotzdem ins Menü zu können:
dafür ein schlankes `layout.tsx` anlegen, das `VerwaltungChrome` einbindet (siehe
`beschluesse/`, `versammlungen/`, `zaehler/`). Bewusst **pro Route** statt global, damit
auf Seiten ohne Sidebar keine Zähler-Abfragen anfallen.

Unterseiten brauchen **keinen** „Zurück zur Verwaltung"-Link — die Sidebar liefert den
Kontext. Ihr eigener `PageTitle` wird automatisch zur Kopfzeile des Detailbereichs.

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

## Rollen

`VERWALTER`, `EIGENTUEMER`, `MIETER`. Zusätzlich `isSuperAdmin` (Admin innerhalb einer
Organisation) und `isPlatformAdminUser` (Betreiber). Der Kontotyp der Organisation
unterscheidet **professionelle Verwaltung** von **Selbstverwaltung** (`isSelfManaged`) —
selbstverwaltete WEGs haben durchgehend eine abgespeckte Oberfläche.

Handwerker haben **kein Portalkonto**: Sie erhalten per E-Mail einen Magic-Link auf
`/auftraege/[token]` (`Craftsman.accessToken`) und können dort Auftrag annehmen, Termin
vorschlagen, kommentieren, „erledigt" melden und die Rechnung einreichen.
