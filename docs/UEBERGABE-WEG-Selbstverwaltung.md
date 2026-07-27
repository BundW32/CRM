# Übergabe: WEG-Selbstverwaltung

Stand: 27.07.2026 · Der geführte Erststart samt Jahresfahrplan ist gebaut und
liegt auf `claude/program-analysis-tasks-au9wmc` (PR #36).

Dieses Dokument ist für eine **neue Sitzung** geschrieben. Es nennt die
getroffenen Entscheidungen mit Begründung, damit sie nicht versehentlich
rückgängig gemacht werden, und hält vier Funde aus einem
Ende-zu-Ende-Durchlauf fest — samt der Korrekturen, mit denen sie behoben
wurden.

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

## 2 · Vier Funde aus dem Durchlauf — behoben

Ergebnis eines Durchlaufs gegen eine frisch aufgesetzte Datenbank
(Registrierung → Einrichtung → Wirtschaftsplan → Beschluss → Sollstellungen →
Fahrplan → Rollen-Gegenprobe). Keiner davon war ein Rückschritt aus PR #36 —
alle vier waren vorher schon so und wurden erst durch den Durchlauf sichtbar.
Alle vier sind inzwischen behoben und gegengeprüft.

### 2.1 Der Wirtschaftsplan blockierte nach vollständiger Einrichtung

**Der wichtigste Punkt.** Die Einrichtung verlangt nur Miteigentumsanteile. Der
WEG-Standardkatalog, den sie im letzten Schritt zu übernehmen empfiehlt,
verteilt aber auch nach **Personenzahl** (Wasser/Abwasser, Müllabfuhr) und nach
**Fläche** (Aufzug, Treppenhausreinigung, Winterdienst).

Folge: acht von acht Schritten erledigt, Katalog übernommen, Planwerte
eingetragen — und „Als beschlossen markieren" war gesperrt, mit der Meldung
**„Gesamtgewicht muss größer als 0 sein."** Ein Satz aus der Rechenmaschine, der
weder die Kostenart noch das fehlende Feld nennt.

**Behoben:** `computeUnitAdvances` wirft jetzt `PositionNichtVerteilbar` mit
`costTypeId`, `distributionKey` und `fehlendesFeld`. Die Oberfläche setzt daraus
den Namen der Kostenart ein und verlinkt direkt an die Stelle:

> **„Wasser/Abwasser" lässt sich noch nicht verteilen**
> Bei keiner Einheit ist eine Personenzahl hinterlegt. Diese Kostenart wird nach
> Personenzahl verteilt. [Bei den Einheiten nachtragen](#).

Die Grenze bleibt bewusst weich: Fehlt der Wert nur bei *einzelnen* Einheiten,
zählen die als 0 (ein Stellplatz trägt keine Wasserkosten). Erst wenn **keine**
Einheit den Wert hat, ist Schluss — drei Tests in `economic-plan.test.ts` halten
das fest.

### 2.2 Der Grund stand zwei Bildschirmhöhen über dem gesperrten Knopf

Die Warnung erschien in der Karte „Hausgeld je Einheit", der davon gesperrte
Knopf sitzt in der Karte darunter. Wer unten klickte, sah nur, dass nichts
geschieht.

**Behoben:** Der Hinweis steht jetzt auch unmittelbar am Knopf.

**Dabei aufgefallen und mitbehoben:** Die beiden Wege unter „Zur Abstimmung
bringen" waren *nicht* gesperrt. Ein Plan, dessen Einzelwirtschaftspläne sich
nicht rechnen lassen, ließ sich also zur Umlaufabstimmung stellen — die
Gemeinschaft hätte über Beträge abgestimmt, die es nicht gibt, und der Beschluss
stünde in der Sammlung, ohne dass ihm je Zahlen folgen könnten. Beide Knöpfe
sind jetzt gesperrt, und `planZurAbstimmung` prüft es **serverseitig** noch
einmal: Ein grauer Knopf ist keine Sperre.

### 2.3 Doppelte Person beim eigenen Konto

Wer sich registrierte (Rolle `VERWALTER`) und sich anschließend selbst als
Eigentümer einer Einheit eintrug, bekam einen **zweiten** Datensatz mit Rolle
`EIGENTUEMER`. Die Dubletten-Vorbeugung suchte nur nach `EIGENTUEMER`.

Für eine Selbstverwaltung ist das der Normalfall, nicht die Ausnahme: Die
verwaltende Person **ist** Eigentümerin.

**Behoben:** `person-search.ts` bezieht in einer selbstverwalteten Organisation
auch `VERWALTER`-Konten in den Vorschlag ein — `searchPersons` und
`verifyExistingPerson` benutzen dieselbe Rollenmenge, sonst böte die Suche eine
Person an, die die Prüfung anschließend verwirft. In der **professionellen
Verwaltung** bleibt es bei `EIGENTUEMER`: Dort sind Verwalter Angestellte und
gehören nicht als Eigentümer an eine Einheit.

### 2.4 Login-Sperre traf die ganze Gemeinschaft

`checkRateLimit("login:<ip>", 5, 900)` — fünf Versuche pro **IP** je 15 Minuten.
In einer WEG, deren Eigentümer hinter demselben Anschluss sitzen, sperrte ein
Nachbar mit fünf Fehlversuchen alle anderen mit aus.

**Behoben:** Die enge Grenze (5) hängt jetzt an der **Kennung** — ein Angriff auf
ein Passwort zielt immer auf ein bestimmtes Konto. Die IP behält eine weitere
Grenze (30), die das massenhafte Durchprobieren vieler Konten von einer Stelle
aus weiter abfängt, eine Familie am gemeinsamen Anschluss aber in Ruhe lässt.

Dazu `resetRateLimit`: Gezählt werden nur **Fehlversuche**, ein Erfolg räumt
beide Zähler ab. Sonst hätte die neue Grenze am Ende genau den ausgesperrt, der
sein Passwort kennt und sich an einem Vormittag mehrfach anmeldet.

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
