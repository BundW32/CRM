# Übergabe: Menüführung & Adressbuch

Stand: 25.07.2026 · Branch `claude/admin-menu-reorganization-8o17fx` · offener PR **#31**

Dieses Dokument ist für eine **neue Sitzung** geschrieben, die den Umbau fortsetzt.
Es nennt die getroffenen Entscheidungen samt Begründung, damit sie nicht versehentlich
rückgängig gemacht werden, und listet auf, was noch offen ist.

Die verbindlichen Konventionen stehen zusätzlich in `portal/AGENTS.md` (wird über
`CLAUDE.md` von jeder Sitzung gelesen). **Erst dort nachlesen, dann hier weiter.**

---

## 1. Was gebaut wurde

**Menüführung** – Das Portal hat keine Kopfleiste mehr auf dem Desktop. Links steht
eine gruppierte Navigationsleiste für **alle** Rollen, mit Logo oben, Zahnrad
(Einstellungen) und Konto-Popover unten. Sie lässt sich zu einer Icon-Leiste
einklappen; der Zustand wird gemerkt.

**Adressbuch** – „Nutzer" und „Kontakte" sind zu einem Bereich verschmolzen.
Personen mit Portalzugang (Mieter, Eigentümer, Verwalter) und Karteikarten ohne
Konto (Handwerker, Dienstleister, Versorger, Behörden) stehen in **einer** Liste.
Hinter jedem Eintrag liegt eine Detailseite mit allem, was dazugehört.

Zentrale Dateien:

| Datei | Zweck |
|---|---|
| `src/lib/app-nav.ts` | Menü-Modell je Rolle (`navFor`), Einstellungen (`settingsItems`) |
| `src/components/app-shell.tsx` | Die Leiste selbst (Aktiv-Markierung, Einklappen, Off-Canvas, Konto) |
| `src/lib/nav-counts.ts` | Zähler-Badges |
| `src/lib/address-book.ts` | Vereinte Abfrage über beide Quellen |
| `src/app/(portal)/verwaltung/kontakte/` | Liste, Zeile, Detailseite, Karteikarten-Formular |
| `src/app/(portal)/verwaltung/nutzer/person-einstellungen.tsx` | Personen-Einstellungen, von zwei Orten genutzt |

---

## 2. Entscheidungen, die **nicht** umgeworfen werden sollen

Diese wurden mit dem Auftraggeber durchgesprochen. Wer sie ändern will, muss vorher
fragen.

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
umleiten.

**Kein automatisches Zusammenführen von Personen über den Namen.** Zwei verschiedene
Menschen können gleich heißen. Der Vorschlag beim Anlegen nennt Objekt und Einheit
zur Unterscheidung; entscheiden muss der Verwalter.

---

## 3. Was offen ist

### 3.1 PR #31 testen und mergen — **zuerst**

Sechs Commits, alle Prüfungen lokal grün (`tsc`, `eslint`, 180 Tests, `next build`).
In der Vercel-Preview noch durchzuklicken:

- **Rollen-Gegenprobe:** als Mieter und als Eigentümer anmelden – dort darf **kein**
  Verwaltungspunkt in der Leiste erscheinen, insbesondere kein „Kontakte". Das
  Adressbuch enthält Telefonnummern aller Mieter; ein Leck wäre ein
  Datenschutzproblem.
- Kontakt anlegen mit Art „Versorger"; Suche und Art-Filter.
- Bei einer Person „Öffnen" (nur Anzeige) und „Bearbeiten →" (Detailseite mit Zugang,
  Mietverhältnissen, Eigentum). Nach dem Speichern muss man **auf der Detailseite
  bleiben**.
- Auftragsportal-Link bei einem Handwerker – muss die Seite öffnen (früher zeigte er
  auf `localhost:3000`, weil `portalUrl()` eine Server-Variable liest).
- Selbstverwaltete WEG (`accountType = selbstverwalter`): dort heißt der Punkt
  weiterhin „Zugänge" und zeigt auf `/verwaltung/nutzer` – die haben kein Adressbuch.

### 3.2 Testdaten aufräumen — **macht der Auftraggeber selbst**

Es gibt Mehrfachkonten (z. B. fünfmal „Hakki Gür" als `hakki.guer`, `hakki.guer2` …).
Ursache siehe 3.3. Es sind Testdaten; ein Zusammenführungswerkzeug wurde bewusst
**nicht** gebaut – zu viel Risiko für eine einmalige Aufräumaktion. Der Weg von Hand:
beim überlebenden Konto unter „Bearbeiten → Einheiten" die weiteren Einheiten
zuordnen, die übrigen Konten deaktivieren.

### 3.3 Ursache der Dubletten — behoben, aber nur zur Hälfte

`inviteOrLetter` (`lib/user-invite.ts:26`) prüft **nur bei angegebener E-Mail**, ob
die Person schon existiert. Ohne E-Mail – der Zugangsschreiben-Weg – legt es immer
ein neues Konto an.

Behoben für: Mieter/Eigentümer an einer Einheit und Eigentümer an einem Objekt
(`objekte/[id]/bearbeiten/`). Dort schlägt `AddPersonForm` ab zwei getippten Zeichen
vorhandene Personen vor.

**Noch offen:** Derselbe Weg beim **Anlegen eines neuen Objekts**
(`objekte/neu/actions.ts`) hat den Vorschlag noch nicht. Wer dort ein Objekt mit
Einheiten und Mieternamen anlegt, kann weiterhin Dubletten erzeugen.

### 3.4 Kleinere offene Punkte

- **Gewerk-Feld ausblenden:** Im Formular „Kontakt hinzufügen" erscheint das Gewerk
  auch bei Art „Behörde" – nur mit dem Hinweis „(nur bei Handwerkern relevant)".
  Sauberer wäre, es abhängig von der Art ein-/auszublenden.
- **WEG-Unterseiten ohne Filter:** Buchhaltung, Hausgeld, Jahresabrechnung usw. haben
  keine Filterleiste. Sie waren beim Rollout durch das Kriterium „Seite hat
  Paginierung" durchgerutscht (vermerkt in PR #28).
- **⌘K-Suche:** War von Anfang an als spätere Ausbaustufe markiert, nicht begonnen.

---

## 4. Bekannte Grenzen

**Adressbuch-Zusammenführung im Speicher.** `loadAddressBook` fragt beide Quellen
getrennt ab (je 500 Treffer gedeckelt), führt sie im Speicher zusammen, sortiert und
schneidet die Seite heraus. Eine echte Datenbank-Vereinigung über zwei Tabellen mit
verschiedenen Feldern ginge nur mit Roh-SQL. Für realistische Bestände unkritisch; ab
Zehntausenden Kontakten muss nachgebessert werden.

**`/verwaltung/nutzer` existiert weiter.** Nicht mehr im Menü (außer bei
selbstverwalteten WEGs), aber als Route erreichbar – alte Links und Lesezeichen
laufen sonst ins Leere. Die Seite heißt jetzt „Zugänge" und hat einen Rückweg zu den
Kontakten.

---

## 5. Prüfen

```bash
cd portal
npx tsc --noEmit      # 0 Fehler
npx eslint src        # 0 Warnungen
npx vitest run        # 180 Tests
npx next build        # grün
```

In dieser Umgebung gibt es **keine Datenbankverbindung** (kein `.env`). Alles, was
echte Daten braucht, muss in der Vercel-Preview geprüft werden.
