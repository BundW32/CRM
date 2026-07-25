# Übergabe: Menüführung & Adressbuch

Stand: 25.07.2026 · Der Umbau ist **abgeschlossen und gemergt** (PRs #26–#31).

Dieses Dokument ist für eine **neue Sitzung** geschrieben, die hier weitermacht.
Es nennt die getroffenen Entscheidungen samt Begründung, damit sie nicht versehentlich
rückgängig gemacht werden, und listet auf, was noch offen ist.

> **Zuerst lesen:** `portal/AGENTS.md` trägt die verbindlichen Konventionen und wird
> über `CLAUDE.md` von jeder Sitzung automatisch geladen. Dieses Dokument ergänzt es
> um Kontext und offene Punkte.

---

## Hier weitermachen

Nichts ist halb fertig – alle Änderungen sind gemergt, geprüft und in Betrieb. Die
folgenden Punkte sind eigenständige, abgeschlossene Aufgaben. Empfohlene Reihenfolge:

1. **Dubletten-Vorbeugung beim Anlegen eines neuen Objekts** (Abschnitt 3.1) – der
   einzige verbliebene Weg, auf dem noch Mehrfachkonten entstehen können.
2. **Gewerk-Feld abhängig von der Art ein-/ausblenden** (3.2) – klein, rein Oberfläche.
3. ~~Filterleiste für die WEG-Unterseiten (3.3)~~ – **erledigt**, siehe Abschnitt 3.3.
4. **⌘K-Suche** (3.4) – war von Anfang an als spätere Ausbaustufe geplant.

**Wichtig zur Umgebung:** Es gibt **keine Datenbankverbindung** (kein `.env`). Alles,
was echte Daten braucht, muss in der Vercel-Preview geprüft werden. Lokal laufen
`tsc`, `eslint`, `vitest` und `next build`.

---

## 1. Was gebaut wurde

**Menüführung** – Das Portal hat keine Kopfleiste mehr auf dem Desktop. Links steht
eine gruppierte Navigationsleiste für **alle** Rollen, mit Logo oben, Zahnrad
(Einstellungen) und Konto-Popover unten. Sie lässt sich zu einer Icon-Leiste
einklappen; der Zustand wird gemerkt.

**Adressbuch** – „Nutzer" und „Kontakte" sind zu einem Bereich verschmolzen.
Personen mit Portalzugang (Mieter, Eigentümer, Verwalter) und Karteikarten ohne
Konto (Handwerker, Dienstleister, Versorger, Behörden) stehen in **einer** Liste.
„Öffnen" zeigt nur an, „Bearbeiten →" führt zur Detailseite mit allem Weiteren.

| Datei | Zweck |
|---|---|
| `src/lib/app-nav.ts` | Menü-Modell je Rolle (`navFor`), Einstellungen (`settingsItems`) |
| `src/components/app-shell.tsx` | Die Leiste selbst (Aktiv-Markierung, Einklappen, Off-Canvas, Konto) |
| `src/lib/nav-counts.ts` | Zähler-Badges |
| `src/lib/address-book.ts` | Vereinte Abfrage über beide Quellen |
| `src/app/(portal)/verwaltung/kontakte/` | Liste, Zeile, Detailseite, Karteikarten-Formular |
| `src/app/(portal)/verwaltung/nutzer/person-einstellungen.tsx` | Personen-Einstellungen, von zwei Orten genutzt |
| `src/app/(portal)/verwaltung/objekte/[id]/bearbeiten/AddPersonForm.tsx` | Vorschlag vorhandener Personen |

---

## 2. Entscheidungen, die **nicht** umgeworfen werden sollen

Diese wurden mit dem Auftraggeber durchgesprochen. Wer sie ändern will, fragt vorher.

**Handwerker haben kein Portalkonto.** Der Passwort-Login der Rolle `HANDWERKER` ist
gesperrt (`login/actions.ts`), die Rolle nicht mehr anlegbar. Der **Magic-Link** aus
der Auftrags-Mail (`/auftraege/[token]`, `vorgaenge/actions.ts:813`) bleibt und ist
der gewollte Weg: annehmen, Termin, kommentieren, erledigt melden, Rechnung
einreichen. *Der Rollenwert bleibt im Prisma-Enum* – ihn zu entfernen erfordert ein
Neuanlegen des Postgres-Typs und scheitert an bestehenden Zeilen. Er kostet nichts.

**Karteikarten bleiben ein eigenes Datenmodell.** Sie liegen weiter in der Tabelle
`Craftsman` (historischer Name, inhaltlich „Firma/Dienstleister") mit dem Feld `kind`
(`ContactKind`). Sie mit `User` zu verschmelzen wäre falsch: kein Konto, dafür
Kategorie und Gewerk. Getrennt gespeichert, **gemeinsam angezeigt**.

**Einstellungen gehören nicht in die Hauptnavigation.** Branding, Integrationen,
Dokument-Quellen, Abrechnung und Audit-Log liegen hinter dem Zahnrad
(`/verwaltung/einstellungen`). Grund: Die Hauptliste muss ohne Scrollen auf einen
Bildschirm passen, sonst verliert die Leiste ihren Vorteil.

**Zähler-Badges laufen als nicht abgewartetes Promise** und nur für Verwalter. Wer
daraus ein `await` macht, verlangsamt jeden Seitenwechsel im ganzen Portal.

**Filter verengen nur.** Ausgangspunkt bleibt immer `…WhereForVerwalter` aus
`lib/access.ts`. Sortierfelder laufen über die Whitelist in `resolveSort`.

**Rücksprungpfade werden geprüft, nicht übernommen.** Formulare führen ein Feld
`zurueck` mit; die Aktionen lösen es über `zurueckZu()` gegen ein festes Muster auf
(`nutzer/actions.ts`, `kontakte/actions.ts`). Ohne diese Prüfung wäre es eine offene
Weiterleitung – jemand könnte über ein untergeschobenes Feld auf eine fremde Seite
umleiten. **Aktionen, die den Datensatz unsichtbar machen** (DSGVO-Löschung), nutzen
`zurueckZurListe()`: Eine anonymisierte Person hat keine Detailseite mehr, ein
Rücksprung dorthin endete in 404 (war ein echter Fehler, siehe Abschnitt 4).

**Kein automatisches Zusammenführen von Personen über den Namen.** Zwei verschiedene
Menschen können gleich heißen. Der Vorschlag beim Anlegen nennt Objekt und Einheit
zur Unterscheidung; entscheiden muss der Verwalter.

**Kein Zusammenführungswerkzeug für Alt-Dubletten.** Bewusst nicht gebaut: Es sind
Testdaten, und ein destruktives Werkzeug für eine einmalige Aufräumaktion ist
unnötiges Risiko. Von Hand: beim überlebenden Konto unter „Bearbeiten → Einheiten"
die weiteren Einheiten zuordnen, die übrigen Konten löschen.

---

## 3. Was offen ist

### 3.1 Dubletten-Vorbeugung beim **Anlegen eines neuen Objekts**

`inviteOrLetter` (`lib/user-invite.ts:26`) prüft **nur bei angegebener E-Mail**, ob
die Person schon existiert. Ohne E-Mail – der Zugangsschreiben-Weg – legt es immer
ein neues Konto an. So entstanden fünf Konten für einen Mieter mit fünf Einheiten
(`hakki.guer`, `hakki.guer2` …).

**Bereits behoben** für Mieter/Eigentümer an einer Einheit und Eigentümer an einem
Objekt: `objekte/[id]/bearbeiten/` nutzt `AddPersonForm`, das ab zwei getippten
Zeichen vorhandene Personen vorschlägt (`searchPersonsForUnit` in dessen
`actions.ts`).

**Noch offen:** `objekte/neu/` (Objekt mit Einheiten und Mieternamen in einem Zug
anlegen) hat den Vorschlag nicht. Dort können weiterhin Dubletten entstehen. Das
Muster aus `bearbeiten/AddPersonForm.tsx` lässt sich übernehmen.

### 3.2 Gewerk-Feld abhängig von der Art

Im Formular „Kontakt hinzufügen" (`verwaltung/kontakte/page.tsx`) erscheint das
Gewerk auch bei Art „Behörde" – nur mit dem Hinweis „(nur bei Handwerkern
relevant)". Sauberer wäre, es abhängig von der gewählten Art ein-/auszublenden
(erfordert eine kleine Client-Komponente, da die Auswahl im Browser passiert).
`kindUsesTrade()` in `lib/labels.ts` gibt es schon dafür.

### 3.3 Filterleiste für die WEG-Unterseiten — **erledigt**

Umgesetzt im Branch `claude/list-filters-search` (Commits „WEG 1/4" bis „WEG 4/4").

Der Auslöser war richtig erkannt, das Ausmaß aber größer als vermerkt: Neben den
fehlenden Filtern gab es **stille Obergrenzen** (`take: 100` in der Buchhaltung,
`50/20` im Hausgeld, `300` in Finanzen, `200` bei den Plattform-Rechnungen, `20`
in Gemeinschaft) sowie **unbegrenzt geladene Listen** (Verbrauch mit allen
Ablesungen aller Zähler, Beschluss-Sammlung, Versammlungen, Übergabeprotokolle).
Jenseits der Grenzen waren Daten schlicht nicht erreichbar, ohne Hinweis.

Drei Berechnungen hingen an der jeweils **angezeigten** Liste und wären mit
Paginierung falsch geworden — sie laufen jetzt über die Datenbank:

- **Mahnstufe** (Hausgeld) — aus 50 angezeigten Mahnungen abgeleitet; bei mehr
  Mahnungen konnte die nächste Stufe zu niedrig ausfallen.
- **MEA-Summe** (Eigentümer) — aus der geladenen Liste addiert.
- **Jahres-Vorschlag** (Jahresabrechnung, Wirtschaftsplan) — gegen die Liste
  geprüft statt gegen alle Jahrgänge.

Wer hier weiterarbeitet: Diese Klasse von Fehlern entsteht immer dann, wenn eine
Kennzahl aus einer Liste berechnet wird, die anschließend paginiert oder
gefiltert wird. Vor jeder neuen Paginierung prüfen, ob eine Summe, ein Maximum
oder ein „gibt es schon"-Test an derselben Liste hängt.

**Noch offen:** Die Seiten sind lokal nur gegen `tsc`, `eslint`, `vitest` und
`next build` geprüft — es gibt keine Datenbankverbindung. Die Filter, die
Paginierung und besonders die drei korrigierten Berechnungen sollten in der
Vercel-Preview mit echten Daten gegengeprüft werden.

### 3.4 ⌘K-Suche

War von Anfang an als spätere Ausbaustufe markiert, nicht begonnen. Gedacht als
Ergänzung zur Leiste, nicht als Ersatz.

---

## 4. Fallen, die schon zugeschnappt haben

Diese Fehler sind behoben – hier dokumentiert, damit sie nicht erneut entstehen.

**Zugriffsbereich hängt an Mietverhältnissen.** Bei einem **eingeschränkten**
Verwalter (kein SuperAdmin) ergibt sich der Zuständigkeitsbereich aus Mietverhältnis
und Eigentum (`access.ts:272-280`). Entfernt so jemand die letzte Einheit eines
Mieters, verliert er den Zugriff auf diese Person – sie verschwindet aus seinem
Adressbuch. Reihenfolge daher: erst neu zuordnen, dann alt entfernen. Für SuperAdmins
gilt das nicht (org-weiter Zugriff).

**`portalUrl()` funktioniert nicht im Client.** Es liest `PORTAL_BASE_URL` aus den
Server-Umgebungsvariablen; in einer Client-Komponente greift immer der Fallback
`http://localhost:3000`. Für Links im Browser deshalb **relative** Pfade verwenden.

**Kein `setState` direkt im Effekt-Rumpf.** Der Linter (`react-hooks/set-state-in-effect`)
weist das ab. Lösung: in den verzögerten Aufruf verschieben oder – für gemerkte
Zustände – einen externen Store mit `useSyncExternalStore` nutzen (siehe
`app-shell.tsx`, Ein-/Ausklappen).

**Route-Typen nach dem Löschen eines Layouts.** Werden Layout-Dateien entfernt,
meldet `tsc` Fehler aus `.next/types/validator.ts`. `rm -rf .next` und neu bauen.

---

## 5. Bekannte Grenzen

**Adressbuch-Zusammenführung im Speicher.** `loadAddressBook` fragt beide Quellen
getrennt ab (je 500 Treffer gedeckelt), führt sie im Speicher zusammen, sortiert und
schneidet die Seite heraus. Eine echte Datenbank-Vereinigung über zwei Tabellen mit
verschiedenen Feldern ginge nur mit Roh-SQL. Für realistische Bestände unkritisch; ab
Zehntausenden Kontakten muss nachgebessert werden.

**`/verwaltung/nutzer` existiert weiter.** Nicht mehr im Menü (außer bei
selbstverwalteten WEGs, dort als „Zugänge"), aber als Route erreichbar – alte Links
und Lesezeichen laufen sonst ins Leere. Die Seite hat einen Rückweg zu den Kontakten.

---

## 6. Prüfen

```bash
cd portal
npx tsc --noEmit      # 0 Fehler
npx eslint src        # 0 Warnungen
npx vitest run        # 180 Tests
npx next build        # grün
```

In der Vercel-Preview zusätzlich die **Rollen-Gegenprobe**: als Mieter und als
Eigentümer anmelden – dort darf **kein** Verwaltungspunkt in der Leiste erscheinen,
insbesondere kein „Kontakte". Das Adressbuch enthält Telefonnummern aller Mieter; ein
Leck wäre ein Datenschutzproblem. Das ist die wichtigste Prüfung im ganzen Umbau.
