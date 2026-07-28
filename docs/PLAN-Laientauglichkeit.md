# Umsetzungsplan — Laientauglichkeit

Stand: 28.07.2026 · Basis: [`PRODUKT-Laientauglichkeit-und-UseCases.md`](./PRODUKT-Laientauglichkeit-und-UseCases.md)

Das Programm ist nach neun Korrekturpunkten fachlich richtig — und dabei
schwerer geworden. Dieser Plan macht es bedienbar, ohne fachlich falsch zu
werden. Format wie [`PLAN-WEG-Finanzkorrekturen.md`](./PLAN-WEG-Finanzkorrekturen.md).

---

## 0. Ausgangslage, nachgezählt

Nicht geschätzt, sondern im Bestand gemessen (28.07.2026):

| | |
|---|---|
| Formularfelder im WEG-Bereich | 218 |
| „Sollstellung" in der Oberfläche | 14× |
| „Wirtschaftsjahr" | 15× |
| „Erhaltungsrücklage" | 10× |
| Paragraphen-Verweise in der Oberfläche | 39 |
| **Statische Hilfetexte** (`text-xs text-gray-400/500`) | **229** |

Dazu neun Entscheidungen, die die Finanzkorrekturen neu verlangen: Kostenart
nachtragen, Storno statt Löschen, Lohnanteil je Buchung, Erfahrungswert je
Kostenart, Verbrauchsanteil 50–70 %, Fälligkeitsregel, Geltungsbeginn eines
geänderten Plans, Forderungen nachziehen, Tilgungsbestimmung.

**Jede einzelne ist fachlich nötig. Zusammen sind sie eine Zumutung für
jemanden, der nebenbei seine eigene WEG verwaltet.**

### Was es noch *nicht* gibt

Ausdrücklich geprüft, weil in Gesprächen anders vermutet:

- **`User.showHints` existiert nicht** — weder im Schema noch im Code. Der
  Vorschlag stand nur im Produktdokument.
- **Es gibt überhaupt keine Nutzereinstellung.** `User` trägt nur Kontoflags
  (`active`, `mustChangePassword`, `signatureSelfSigned`, Rollenflags). Eine
  Vorliebe je Person ist ein neues Muster, kein Anbau an ein vorhandenes.
- **Die 229 Hilfetexte sind fest verdrahtet.** Sie sind bereits die
  Laienhilfe des Programms — nur unabschaltbar, uneinheitlich formatiert und
  über die Seiten verstreut. Ein Schalter, der sie nicht erfasst, wäre ein
  halber Schalter.

### Was es schon gibt und worauf aufgebaut wird

| Baustein | Was er liefert |
|---|---|
| `lib/weg/setup-status.ts` | 8 Einrichtungsschritte, Reihenfolge, je ein `why` in Eigentümersprache, `href` |
| `dashboard/SetupGuide.tsx` | genau **ein** hervorgehobener nächster Schritt |
| `lib/weg/roadmap.ts` | „Was ansteht" im laufenden Betrieb |
| `components/app-shell.tsx` | Navigation, bereits Client-Komponente → ansteuerbar |
| `components/fields.tsx` | `hint`-Slot an `DateField`/`SelectField` (bisher 2× genutzt) |
| `components/assistant-widget.tsx` | der KI-Assistent |

Der **Inhalt** einer Führung ist damit größtenteils geschrieben. Es fehlt das
„wo klicke ich".

---

## Harte Prinzipien

1. **Kein Fachbegriff verschwindet — er bekommt eine Übersetzung.** „Sollstellung"
   bleibt stehen, weil der Beirat und der Steuerberater sie brauchen. Daneben
   steht, was sie heißt. Wer Begriffe ersetzt, macht das Programm für Laien
   verständlich und für Fachleute unbenutzbar.
2. **Paragraphen bleiben.** Sie sind der Beleg, dass hier nichts erfunden wird —
   und für die Anfechtungsfestigkeit das stärkste Argument. Sie gehören aber in
   die zweite Zeile, nicht in die Überschrift.
3. **Eine Führung repariert keine verwirrende Oberfläche.** Wo eine Tour nötig
   ist, damit man einen Knopf findet, ist zuerst der Knopf falsch.
4. **Nichts blockiert.** Jede Führung ist überspringbar, fortsetzbar und
   erscheint nie ungefragt ein zweites Mal.
5. **Tipps sind standardmäßig an.** Wer sie nicht braucht, schaltet sie ab. Die
   umgekehrte Voreinstellung erreicht genau die nicht, für die sie da sind.
6. **Verankerung statt Kopplung.** Eine Führung zeigt auf `data-tour`-Marker,
   nie auf CSS-Klassen oder Positionen. Sonst bricht sie bei jedem Umbau.
7. **Mobil ist kein Nachgedanke.** Die Navigation ist dort Off-Canvas; ein
   Spotlight auf ein unsichtbares Ziel ist ein Fehler, kein Sonderfall.

---

## Block 1 — Fundament (klein, eine Migration)

### LP1 — Tipps: ein Schalter, der wirklich greift

Ohne diesen Punkt hängen alle folgenden in der Luft.

- `User.showHints Boolean @default(true)` + Migration.
- Neue Komponente `<Tipp>` (`components/tipp.tsx`): rendert Erklärtext nur,
  wenn der angemeldete Nutzer sie eingeschaltet hat. Serverseitig entschieden —
  kein Flackern, kein Client-JS.
- Schalter unter **Konto** (`/konto`), nicht in den Verwalter-Einstellungen: Es
  ist eine Vorliebe der Person, nicht der Organisation. Zwei Eigentümer
  derselben WEG dürfen es verschieden wollen.
- **Die 229 vorhandenen Hilfetexte werden nicht in einem Rutsch umgestellt.**
  Das wären ~40 Dateien ohne sichtbare Verbesserung. Regel wie beim
  Rücksprung-Helfer: Wer eine Seite ohnehin anfasst, zieht sie mit. Neu
  geschriebene Erklärungen laufen ab sofort über `<Tipp>`.
- Ausnahme, die **nicht** abschaltbar ist: Warnungen und Fehlermeldungen. Ein
  Hinweis auf einen fehlenden Eigentümer ist kein Tipp.

### LP2 — Fehlermeldungen als Handlungsanweisung

Der billigste echte Gewinn, unabhängig von allem anderen.

- Durchgang durch die `FEHLER_TEXTE`-Verzeichnisse der WEG-Seiten: Jede Meldung
  sagt **was fehlt, wo es steht und wie man hinkommt** — mit Link.
- Vorher/nachher: „Die Verteilung ist nicht möglich." → „Bei WE 03 fehlt die
  Wohnfläche. In den Stammdaten nachtragen." + Link auf den Anker.
- `PositionNichtVerteilbar` und `benoetigtesFeld` liefern die Daten dafür
  bereits — sie werden heute nur nicht bis in den Text durchgereicht.
- Test wie `flash.test.ts`: Jede Meldung, die auf ein Feld verweist, muss einen
  Link tragen.

### LP3 — Glossar an Ort und Stelle

- `lib/glossar.ts`: Begriff → ein Satz Erklärung → optional der Paragraph.
  Startbestand die zehn gemessenen Begriffe oben.
- `<Begriff name="sollstellung">Sollstellung</Begriff>` — gepunktete
  Unterstreichung, Erklärung im `title` und für Tastatur/Screenreader
  zugänglich. Kein Popup-Framework.
- Greift nur bei eingeschalteten Tipps (LP1).

---

## Block 2 — Die geführte Ersteinrichtung (der große Teil)

### LP4 — Tour-Mechanik

Eigenbau, rund 200–300 Zeilen, **keine Bibliothek**. Begründung: driver.js und
Shepherd bringen eigenes Aussehen mit und kämpfen gegen das gerade
vereinheitlichte Design-System; die Anpassung wäre teurer als der Eigenbau.

- `components/tour.tsx` (Client): abgedunkeltes Overlay, ausgestanztes Rechteck
  über `getBoundingClientRect()` des Ziels, schwebende Sprechblase daneben,
  Weiter/Zurück/Überspringen, Fortschrittsanzeige.
- **Barrierefreiheit ist Teil der Mechanik, nicht der Feinschliff:** Fokusfalle
  in der Sprechblase, `Escape` beendet, `aria-live` für den Schritttext,
  Tastaturbedienung vollständig.
- **Mobil:** Ist das Ziel in der Off-Canvas-Navigation, öffnet die Tour sie
  zuerst. Ist kein Ziel sichtbar, fällt der Schritt auf eine zentrierte Karte
  ohne Spotlight zurück — lieber ohne Ausschnitt als auf die falsche Stelle.
- Fortschritt in `User.tourState Json?` — wer abbricht, macht später weiter.

### LP5 — Verankerung

- `data-tour="…"`-Marker in `app-nav.ts` und `app-shell.tsx`, dazu an den
  Zielen der 8 Einrichtungsschritte.
- **Test:** Für jeden Tour-Schritt muss der Marker im Quelltext existieren.
  Sonst zeigt die Tour irgendwann ins Leere, und niemand merkt es — derselbe
  Gedanke wie bei `flash.test.ts`.

### LP6 — Die Tour selbst

Höchstens **sieben** Schritte. Länger liest niemand.

1. **Die Tipps** — „Diese Hinweise sind eingeschaltet. Hier schaltest du sie
   aus." Der Schalter leuchtet auf. Man lernt die Einstellung, indem man sie
   benutzt. *(Dein Gedanke, und der beste Teil der Tour.)*
2. **Die Bereichsleiste** — Alltag / Stammdaten / WEG / Betrieb, was wo liegt.
3. **Wo die WEG-Finanzen sitzen** und warum sie einen eigenen Bereich haben.
4. **„Ihre WEG einrichten"** — der vorhandene `SetupGuide`, mit dem einen
   nächsten Schritt.
5. **„Was ansteht"** — der Fahrplan im laufenden Jahr.
6. **Der Assistent** — wo er sitzt und was er kann.
7. **Ende** — „Diese Führung findest du jederzeit unter Konto."

Auslöser: einmal nach der Registrierung, danach nur noch auf Wunsch.

---

## Block 3 — Der Assistent (eigene Runde)

### LP7 — Assistent, der die eigene WEG kennt

Bewusst **nach** Block 1 und 2: Er soll Begriffe und Wege erklären, die dann
schon aufgeräumt sind. Sonst erklärt er eine Oberfläche, die sich gleich ändert.

Drei Wissensquellen, in dieser Reihenfolge des Aufwands:

1. **Das Programm** — welche Seite wofür, wohin navigieren. Speist sich aus
   `app-nav.ts` und dem Glossar (LP3).
2. **Die eigene WEG** — Salden, offene Posten, nächster Schritt. Streng über
   `…WhereForUser` gefiltert; ein Assistent, der Nachbardaten ausplaudert, ist
   ein Datenschutzvorfall.
3. **Das WEG-Recht** — der vorhandene Skill als Wissensbasis, mit klarer
   Kennzeichnung: Auskunft, keine Rechtsberatung.

---

## Ausdrücklich **nicht** in diesem Plan

- **Fachbegriffe umbenennen.** Siehe Prinzip 1.
- **Alle 229 Hilfetexte umstellen.** Nach Bedarf, nicht am Stück.
- **Tour auf jeder Seite.** Eine Ersteinrichtung, sonst nichts. Wer für jede
  Seite eine Tour braucht, hat ein Oberflächenproblem.
- **Videos, Animationen, Maskottchen.**

---

## Reihenfolge und Abhängigkeiten

| Paket | Größe | hängt ab von | wartet auf Design-Wellen? |
|---|---|---|---|
| LP1 Tipp-Schalter | klein (1 Migration) | — | nein |
| LP2 Fehlermeldungen | klein | — | nein |
| LP3 Glossar | klein | LP1 | nein |
| LP5 Verankerung | klein | — | nein, aber mit ihm absprechen |
| LP4 Tour-Mechanik | mittel | LP5 | nein |
| LP6 Tour-Inhalte | mittel | LP4, LP5 | **ja** |
| LP7 Assistent | groß | LP3 | ja |

**Der Schnitt liegt bei LP6.** Alles davor ist unabhängig von den
Design-Wellen 3 und 4 und kann sofort laufen. Die Tour-Inhalte zeigen auf
Seiten, die der andere Account gerade umbaut — sie werden zweimal gebaut, wenn
sie zu früh kommen.

---

## Zu LP5: was mit dem anderen Account abzusprechen ist

Die `data-tour`-Marker sind zusätzliche Attribute, keine Umbauten — sie stören
seine Wellen nicht. Aber sie stehen in `app-nav.ts` und `app-shell.tsx`, also
in *seinen* Dateien. Sinnvoll wäre: Er nimmt sie in Welle 3 gleich mit, wenn er
diese Dateien ohnehin anfasst. Kostet ihn Minuten und uns einen Rebase weniger.
