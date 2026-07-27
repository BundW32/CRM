# Übergabe: WEG-Selbstverwaltung

Stand: 27.07.2026 · Der geführte Erststart samt Jahresfahrplan ist gebaut und
liegt auf `claude/program-analysis-tasks-au9wmc` (PR #36).

Dieses Dokument ist für eine **neue Sitzung** geschrieben. Es nennt die
getroffenen Entscheidungen mit Begründung, damit sie nicht versehentlich
rückgängig gemacht werden, und listet vier Funde aus einem
Ende-zu-Ende-Durchlauf, die **offen geblieben sind**.

> **Zuerst lesen:** `portal/AGENTS.md` trägt die verbindlichen Konventionen und
> wird über `CLAUDE.md` von jeder Sitzung automatisch geladen.

---

## 1 · Was gebaut wurde

**Die Übersicht ist die Einrichtung, solange sie läuft** — acht Schritte, einer
als „Als Nächstes" hervorgehoben, jeder mit einer Begründung in der Sprache
eines Eigentümers. Fünf Schritte leiten sich aus den Daten ab und speichern
nichts (`lib/weg/setup-status.ts`); ein abgeleiteter Zustand kann nicht
veralten, ein gespeichertes Häkchen schon. Drei Schritte finden außerhalb des
Systems statt (Unterlagen, Bankkonto, Verwalterbestellung) und liegen als
Vermerk in `WegSetupStep`.

`MANUAL_SETUP_STEPS` ist zugleich die Whitelist der Server-Action. Ohne sie
ließe sich über ein untergeschobenes Feld ein abgeleiteter Schritt als erledigt
melden — die Einrichtung verkündete Vollzug, obwohl die Buchhaltung leer ist.

**Ist die Einrichtung fertig, wird aus derselben Seite der Jahresfahrplan**
(`lib/weg/roadmap.ts`) — Jahresabrechnung, Versammlung, Wirtschaftsplan,
fällige Prüfpflichten, eigene Termine, offene Rückstände; überfällig zuerst.

**Der Wirtschaftsplan gehört nicht in die Einrichtung.** Er stand dort einmal
als neunter Schritt. Die acht Schritte sind Stammdaten — einmal erfasst, dann
fertig. Der Plan ist laufender Betrieb und wiederholt sich jedes Jahr; als
Einrichtungsschritt hätte er die Einrichtung nie enden lassen. Er ist jetzt der
erste Punkt des Fahrplans, ohne Frist, aber mit Vorrang.

**Umlaufbeschlüsse haben Allstimmigkeit als Vorgabe** (§ 23 Abs. 3 S. 1 WEG).
Vorher stand dort „einfache Mehrheit" — das erzeugt anfechtbare Beschlüsse. Wer
abweicht, bekommt den Hinweis auf den nötigen Absenkungsbeschluss.

**Eigene Termine laufen über `MaintenanceTask` ohne `catalogKey`.** Einmaliger
Termin und wiederkehrende Aufgabe sind derselbe Datensatz; `catalogKey`
unterscheidet nur die Herkunft. Bewusst **kein** Kalender im Programm — eine
kleine WEG hat rund fünfzehn datierte Dinge im Jahr, ein Monatsraster stünde an
den meisten Tagen leer. Stattdessen ein `.ics`-Export unter
`/api/kalender/[propertyId]`, gerechnet in Europe/Berlin.

---

## 2 · Vier Funde, die offen sind

Ergebnis eines Durchlaufs gegen eine frisch aufgesetzte Datenbank
(Registrierung → Einrichtung → Wirtschaftsplan → Beschluss → Sollstellungen →
Fahrplan → Rollen-Gegenprobe). Keiner davon ist ein Rückschritt aus PR #36 —
alle vier waren vorher schon so und wurden durch den Durchlauf sichtbar.

### 2.1 Der Wirtschaftsplan blockiert nach vollständiger Einrichtung

**Der wichtigste Punkt.** Die Einrichtung verlangt nur Miteigentumsanteile. Der
WEG-Standardkatalog, den sie im letzten Schritt zu übernehmen empfiehlt,
verteilt aber auch nach **Personenzahl** (Wasser/Abwasser, Müllabfuhr) und nach
**Fläche** (Aufzug, Treppenhausreinigung, Winterdienst).

Folge: acht von acht Schritten erledigt, Katalog übernommen, Planwerte
eingetragen — und „Als beschlossen markieren" ist gesperrt, mit der Meldung
**„Gesamtgewicht muss größer als 0 sein."** Die nennt weder die Kostenart noch
das fehlende Feld. Nach Nachtragen von Fläche und Personenzahl in den
Stammdaten läuft alles.

Zwei Wege, beide vertretbar:
- Die Einrichtung fragt Fläche und Personenzahl mit ab, sobald der übernommene
  Katalog sie braucht — als Warnung am Schritt „Einheiten", nicht als Pflicht
  (eine Gemeinschaft, die alles nach MEA umlegt, braucht beides nicht).
- Die Meldung nennt Kostenart und fehlendes Feld: „Für ‚Wasser/Abwasser'
  (Verteilung nach Personenzahl) ist bei keiner Einheit eine Personenzahl
  hinterlegt."

Quelle der Meldung: `computeUnitAdvances` in `lib/weg/` — der Fehler wird in
`wirtschaftsplan/[planId]/page.tsx` als `advanceError` gefangen.

### 2.2 Der Grund steht zwei Bildschirmhöhen über dem gesperrten Knopf

`advanceError` erscheint als Warnung in der Karte „Hausgeld je Einheit", der
davon gesperrte Knopf sitzt in der Karte „Beschlussvorlage & Beschluss"
darunter. Wer unten klickt, sieht nur, dass nichts passiert. Der Hinweis gehört
an den Knopf.

### 2.3 Doppelte Person beim eigenen Konto

Wer sich registriert (Rolle `VERWALTER`) und sich anschließend selbst als
Eigentümer einer Einheit einträgt, bekommt einen **zweiten** Datensatz mit Rolle
`EIGENTUEMER`. Die Dubletten-Vorbeugung aus `lib/person-search.ts` greift nicht,
weil sie nach Rolle sucht.

Für eine Selbstverwaltung ist das der Normalfall, nicht die Ausnahme: Die
verwaltende Person **ist** Eigentümerin. Der Vorschlag sollte in einer
selbstverwalteten Organisation auch Verwalter-Konten anbieten.

### 2.4 Login-Sperre trifft die ganze Gemeinschaft

`checkRateLimit("login:<ip>", 5, 900)` — fünf Versuche pro **IP** je 15 Minuten.
In einer WEG, deren Eigentümer hinter demselben Anschluss sitzen, sperrt ein
Nachbar mit fünf Fehlversuchen alle anderen mit aus. Ein Limit je Kennung
(zusätzlich zum IP-Limit, nicht statt dessen) wäre treffsicherer.

**Das trifft auch die Entwicklung:** Wer mit mehreren Testkonten aus derselben
Umgebung arbeitet, läuft nach fünf Fehlversuchen in `?fehler=limit` und hält das
leicht für einen kaputten Login. Abhilfe zur Not:
`delete from "RateLimit";`

---

## 3 · Was der Durchlauf bestätigt hat

Damit niemand doppelt prüft — all das lief sauber:

- 79 Migrationen auf leerer Datenbank
- Registrierung landet auf der Einrichtung, nicht auf einer leeren Seite
- Objekt + Einheiten + Eigentümer in einem Formular; „Eigentümer seit" wird übernommen
- Die drei Vermerke halten nach dem Neuladen
- Die Anker springen an den richtigen Abschnitt
- Konto ohne Anfangsbestand oder Stichtag wird abgewiesen; 0,00 € bleibt zulässig
- Beschluss erzeugt 3 × 12 Sollstellungen, Summe exakt gleich der Plansumme
- Der Fahrplan rückt nach dem Beschluss selbständig auf das Folgejahr
- Eigener Termin erscheint im Fahrplan und ist auf der Prüfpflichten-Seite änderbar
- `.ics`-Export mit korrektem Tag; 403 ohne Verwalterrolle und für fremde Objekte
- Rollen-Gegenprobe: Ein Eigentümer wird von Stammdaten, Hausgeld, Wirtschaftsplan,
  Objekten, Nutzern und Kontakten auf `/dashboard` umgeleitet — kein Datenleck

---

## 4 · Weiter gedacht, noch nicht begonnen

**HausMatch-Anbindung.** Abgestimmte Richtung: CRM und HausMatch sprechen über
eine Schnittstelle miteinander; aus einem Vorgang heraus lässt sich eine
Ausschreibung ans Schwarze Brett stellen. Sichtbar ist für Anbieter zunächst nur
**PLZ und Gewerk** — Adresse und Kontakt erst nach Annahme. Preisgestaltung ist
offen.

**„Maßnahme" als schlanker Datensatz** für Selbstverwalter: etwas, das ansteht,
Geld kostet und einen Beschluss braucht — zwischen Vorgang und Erhaltungsplanung.

**Der CI-Test für Pending-Buttons hat eine Lücke.** `button-feedback.test.ts`
überspringt ein nacktes `<button type="submit">`, sobald im selben Formular
*irgendwo* eine Feedback-Komponente vorkommt. So rutschte der Speichern-Knopf
der Kontozeile durch. Ihn zu schärfen wirft rund 80 Fundstellen auf — eine
eigene Runde, keine Nebensache.
