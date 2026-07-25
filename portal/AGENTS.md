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
nicht in der Leiste und wird schlicht übersehen.

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

## Rollen

`VERWALTER`, `EIGENTUEMER`, `MIETER`. Zusätzlich `isSuperAdmin` (Admin innerhalb einer
Organisation) und `isPlatformAdminUser` (Betreiber). Der Kontotyp der Organisation
unterscheidet **professionelle Verwaltung** von **Selbstverwaltung** (`isSelfManaged`) —
selbstverwaltete WEGs haben durchgehend eine abgespeckte Oberfläche.

Handwerker haben **kein Portalkonto**: Sie erhalten per E-Mail einen Magic-Link auf
`/auftraege/[token]` (`Craftsman.accessToken`) und können dort Auftrag annehmen, Termin
vorschlagen, kommentieren, „erledigt" melden und die Rechnung einreichen.
