# Übergabe: Menüführung & Adressbuch

Stand: 25.07.2026 · Der Umbau ist **abgeschlossen und gemergt** (PRs #26–#31).
Die vier Restpunkte aus Abschnitt 3 sind auf `claude/program-analysis-tasks-au9wmc`
umgesetzt und **warten auf die Prüfung in der Preview** (siehe Abschnitt 3).

Dieses Dokument ist für eine **neue Sitzung** geschrieben, die hier weitermacht.
Es nennt die getroffenen Entscheidungen samt Begründung, damit sie nicht versehentlich
rückgängig gemacht werden, und listet auf, was noch offen ist.

> **Zuerst lesen:** `portal/AGENTS.md` trägt die verbindlichen Konventionen und wird
> über `CLAUDE.md` von jeder Sitzung automatisch geladen. Dieses Dokument ergänzt es
> um Kontext und offene Punkte.

---

## Hier weitermachen

Alle vier Punkte aus Abschnitt 3 sind gebaut, lokal geprüft und einzeln committet.
**Offen ist nur noch die Prüfung mit echten Daten** – lokal gibt es keine
Datenbank. Was zu prüfen ist, steht in Abschnitt 6; die wichtigste Prüfung ist
und bleibt die Rollen-Gegenprobe.

> **Hinweis zu Punkt 3.3 (Filter für die WEG-Unterseiten):** Dieser Punkt wurde
> **zweimal parallel bearbeitet** – einmal hier, einmal in `claude/list-filters-search`.
> Beim Zusammenführen blieb die hiesige Fassung von Buchhaltung und Hausgeld die
> Grundlage; aus dem anderen Zweig kamen die übrigen zwölf Seiten hinzu, die hier
> nicht bearbeitet wurden (Verbrauch, Finanzen, Gemeinschaft, Versammlungen,
> Anträge, Eigentümer, Beschluss-Sammlung, Übergaben, Plattform-Rechnungen,
> Jahresabrechnung, Wirtschaftsplan). Wer künftig einen Punkt aus diesem Dokument
> übernimmt, sollte ihn vorher hier als „in Arbeit" markieren – die doppelte
> Arbeit war vermeidbar.

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

Dazu aus den Restpunkten (Abschnitt 3):

| Datei | Zweck |
|---|---|
| `src/lib/person-search.ts` | Personensuche + Prüfung der gewählten ID, für beide Anlege-Wege |
| `src/app/(portal)/verwaltung/objekte/neu/PersonVorschlag.tsx` | Vorschlag je Zeile beim Anlegen |
| `src/app/(portal)/verwaltung/kontakte/ArtUndGewerk.tsx` | Art steuert das Gewerk-Feld |
| `src/components/command-palette.tsx` | ⌘K-Palette (Sprungziele + Datensuche) |
| `src/lib/portal-search.ts` / `-server.ts` | Typ und Konstante / die Abfrage |

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

## 3. Die vier Restpunkte – umgesetzt am 25.07.2026

Alle vier auf `claude/program-analysis-tasks-au9wmc`, je ein Commit. `tsc`,
`eslint`, `vitest` (185 Tests) und `next build` sind grün; **mit echten Daten
ungeprüft**.

### 3.1 Dubletten-Vorbeugung beim **Anlegen eines neuen Objekts** ✔

`inviteOrLetter` (`lib/user-invite.ts:26`) prüft **nur bei angegebener E-Mail**, ob
die Person schon existiert. Ohne E-Mail – der Zugangsschreiben-Weg – legt es immer
ein neues Konto an. So entstanden fünf Konten für einen Mieter mit fünf Einheiten
(`hakki.guer`, `hakki.guer2` …).

`objekte/neu/` schlägt jetzt vorhandene Personen vor, wie `bearbeiten/` es schon
tat – und zwar in **allen drei** Personen-Wegen des Formulars: Objekt-Eigentümer,
WEG-Eigentümer je Einheit, Mieter je Einheit (`PersonVorschlag.tsx`).

`inviteOrLetter` blieb bewusst unverändert: Sind beide Anlege-Wege in der
Oberfläche abgesichert, gibt es keinen ungeschützten Aufrufer mehr. Eine
Namensprüfung in der Funktion selbst sähe den Access-Scope nicht und würde zwei
gleichnamige Menschen zusammenwerfen – genau das, was Abschnitt 2 verbietet.

Die Suche liegt jetzt einmal in `lib/person-search.ts` und wird von beiden Wegen
genutzt. `verifyExistingPerson` prüft die gewählte ID gegen Organisation und
Rolle – sie kommt aus einem versteckten Feld, ohne Prüfung ließe sich eine fremde
Person an ein eigenes Objekt hängen.

> **Falle für später:** Die Zeilen werden serverseitig über `getAll()` indexgleich
> eingelesen. Das versteckte `…UserId`-Feld muss deshalb in **jeder** Zeile
> gerendert werden, auch leer – fehlt es, verschiebt sich die Zuordnung aller
> folgenden Zeilen. Aus demselben Grund sind verknüpfte Felder `readOnly` und
> nicht `disabled`: Deaktivierte Felder werden nicht mitgeschickt.

### 3.2 Gewerk-Feld abhängig von der Art ✔

Art und Gewerk liegen zusammen in `kontakte/ArtUndGewerk.tsx` und entscheiden über
`kindUsesTrade()`. Sie stehen bewusst direkt beieinander – das Feld erscheint dort,
wo die Auswahl passiert. Im ausgeblendeten Zustand geht `ALLGEMEIN` mit, weil
`Craftsman.trade` im Schema ein Pflichtfeld ist.

### 3.3 Filterleiste für die WEG-Unterseiten ✔ (Buchhaltung + Hausgeld)

Bewusst **nur diese beiden**: Es sind die einzigen mit gedeckelten Listen, und dort
fehlte mehr als Komfort – die Listen endeten hart an ihrem Deckel, ohne Weg zu
älteren Einträgen. Erhaltungsplanung, Sonderumlagen, Prüfpflichten und Stammdaten
zeigen eine Handvoll Zeilen; eine Filterleiste darüber wäre Störung statt Hilfe.

- **Buchhaltung**: Suche, Filter (Jahr, Konto, Art, Kostenart), Sortierung, 50/Seite
  (vorher: die letzten 100, danach nichts). Kontensalden laufen weiter über **alle**
  Buchungen – ein Saldo, der sich mit dem Filter ändert, wäre kein Saldo.
- **Hausgeld**: Rückstandsliste nach Stand, Mahnwesen nach Versandstatus, offene
  Zahlungseingänge durchsuchbar und geblättert. Die Summenzeile bleibt die Summe
  über alle Einheiten und sagt das, sobald gefiltert wird.

Dabei behoben: Die nächste Mahnstufe je Einheit wurde aus derselben Liste
abgeleitet, die angezeigt wird – mit Filter (und schon vorher ab dem 51. Schreiben)
hätte das eine bereits versendete Stufe erneut angeboten. Die Eskalation hat jetzt
eine eigene, ungefilterte Quelle ohne Deckel.

> **Falle für später:** Je Seite wird nur **eine** Liste geblättert. `page` gibt es
> in der URL nur einmal; zwei Paginierungen nebeneinander verstellen einander.

### 3.4 ⌘K-Suche ✔

Ergänzung zur Leiste, nicht Ersatz. Zwei Quellen, unterschiedlich weit gefasst:

- **Sprungziele** aus dem Menü-Modell, für **jede** Rolle – exakt die Punkte, die
  dieselbe Person auch in der Leiste sieht, plus die Einstellungs-Seiten hinter dem
  Zahnrad (die sucht man am ehesten).
- **Daten** (Objekte, Kontakte, Vorgänge) nur für **Verwalter**, ausgehend von den
  `…WhereForVerwalter`-Grenzen. Begründung siehe Abschnitt 6.

Erreichbar auch ohne Tastatur: „Suchen" am Kopf der Leiste, Lupe in der mobilen
Kopfzeile. Eine Tastenkombination allein findet nur, wer sie kennt.

> **Falle für später:** `portal-search.ts` trägt nur Typ und Konstante, die Abfrage
> liegt in `portal-search-server.ts`. Holt die Palette einen **Wert** aus dem
> Server-Modul, zieht sie die gesamte Prisma-Kette ins Browser-Bündel und der Build
> bricht. Gleiche Aufteilung wie `url.ts`/`url-server.ts`.

### 3.5 Dieselbe Aufräumarbeit außerhalb der WEG-Unterseiten ✔

Aus `claude/list-filters-search`, parallel entstanden. Ergänzt 3.3 um die Seiten,
die dort außerhalb des Scopes lagen — es zeigte sich, dass dieselben zwei Muster
über die ganze App verteilt vorkamen.

**Weitere stille Obergrenzen entfernt** (jenseits davon waren Daten unerreichbar):
Finanzen/Belegeinsicht `300` · Plattform-Rechnungen `200` · Gemeinschaft `20`.

**Unbegrenzt geladene Listen begrenzt:** Verbrauch lud **alle** Zähler mit **allen**
Ablesungen seit Betriebsbeginn; dazu Beschluss-Sammlung (wächst laut § 24 VII WEG
dauerhaft), Versammlungen, Anträge, Eigentümer, Übergabeprotokolle.

Beim Verbrauch sind die Ablesungen je Zähler auf die **400 jüngsten** begrenzt, nicht
auf die letzten drei: die Auswertung braucht neben der jüngsten Periode auch die
Vorperiode **und** die Periode von vor ~einem Jahr.

**Zwei weitere Kennzahlen**, die an der angezeigten Liste hingen — dieselbe
Fehlerklasse wie die Mahnstufe in 3.3:

- **MEA-Summe** (Eigentümer) wurde aus der geladenen Liste addiert; kommt jetzt aus
  einer Aggregation über das ganze Objekt.
- **Jahres-Vorschlag** (Jahresabrechnung, Wirtschaftsplan) wurde gegen die angezeigte
  Liste geprüft; jetzt gegen alle vorhandenen Jahrgänge.

> **Regel daraus:** Vor jeder neuen Paginierung prüfen, ob eine Summe, ein Maximum
> oder ein „gibt es das schon"-Test an derselben Liste hängt. Dreimal war es der Fall.

> **Zur Falle aus 3.3** („je Seite nur eine Liste blättern"): Das gilt nur, solange
> alle Paginierungen `page` verwenden. Mit eigenen Parametern je Liste (`zseite`,
> `aseite`, `mseite`) lassen sich mehrere nebeneinander betreiben — im Hausgeld so
> umgesetzt.

### Was bewusst offen blieb

- **Filterleisten für die übrigen WEG-Seiten** – siehe Begründung oben. Wenn ein
  Bestand wächst, sind Prüfpflichten (Status-Filter) der nächste sinnvolle Schritt.
- **⌘K-Aktionen** („Neues Objekt anlegen" o. Ä.). Sprungziele leisten davon das
  meiste; Aktionen wären die nächste Ausbaustufe.
- **Datensuche für Mieter und Eigentümer.** Technisch über `…WhereForUser`
  machbar, aber jede Rolle bräuchte ihre eigene Gegenprobe – und die ist ohne
  Datenbank nicht zu haben.

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
npx vitest run        # 185 Tests
npx next build        # grün
```

In der Vercel-Preview zusätzlich die **Rollen-Gegenprobe**: als Mieter und als
Eigentümer anmelden – dort darf **kein** Verwaltungspunkt in der Leiste erscheinen,
insbesondere kein „Kontakte". Das Adressbuch enthält Telefonnummern aller Mieter; ein
Leck wäre ein Datenschutzproblem. Das ist die wichtigste Prüfung im ganzen Umbau.

**Die Gegenprobe gilt seit der ⌘K-Suche auch für die Palette.** Als Mieter und als
Eigentümer ⌘K drücken: Es dürfen **nur Sprungziele** erscheinen, niemals ein Name,
ein Objekt oder ein Vorgang. Eine Suchfläche, die zu viel findet, ist dasselbe Leck
in neuer Form – nur unauffälliger, weil sie kein Menüpunkt ist.

Was mit echten Daten noch zu prüfen ist (lokal nicht möglich):

| Prüfung | Worauf achten |
|---|---|
| Rollen-Gegenprobe ⌘K | Mieter/Eigentümer: nur Sprungziele, keine Daten |
| Eingeschränkter Verwalter (kein SuperAdmin) | Findet in ⌘K nur seine eigenen Objekte, Kontakte, Vorgänge |
| Objekt anlegen mit vorhandener Person | Vorschlag erscheint ab 2 Zeichen; nach Auswahl entsteht **kein** zweites Konto und **kein** Zugangsschreiben |
| Objekt anlegen mit mehreren Zeilen | Zeile 2 verknüpft, Zeile 1 und 3 neu → Namen landen bei den richtigen Einheiten (Index-Zuordnung) |
| Buchhaltung mit >100 Buchungen | Ältere Belege über Jahr-Filter und Blättern erreichbar; Kontensalden bleiben unverändert |
| Hausgeld-Mahnwesen | Bei gesetztem Status-Filter bietet die Rückstandsliste weiter die **richtige** nächste Mahnstufe an |
