# Umsetzungsplan — Laientauglichkeit

Stand: 28.07.2026 · Basis: [`PRODUKT-Laientauglichkeit-und-UseCases.md`](./PRODUKT-Laientauglichkeit-und-UseCases.md)

> **Umsetzungsstand.** LP1–LP3 sind gebaut und gemergt (PR #47). LP4–LP6 sind
> gebaut und geprüft, liegen aber noch unveröffentlicht auf
> `claude/weg-accounting-review-dch465`. Dazu kam ungeplant die
> **Rollenunterscheidung der Führung** (Schritt 36 in `portal/DECISIONS.md`):
> Eigentümer und Mieter bekamen die Verwalter-Führung — falsche Begrüßung und
> drei Schritte auf Bereiche, die es in ihrem Menü nicht gibt.
>
> **Offen:** LP7 (Assistent) sowie die rund 190 fest verdrahteten Hilfetexte
> außerhalb des WEG-Bereichs — die wandern nach Bedarf, nicht am Stück.

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
  Wohnfläche. In den Stammdaten nachtragen." + Link.
- `PositionNichtVerteilbar` und `benoetigtesFeld` liefern die Daten dafür
  bereits — sie werden heute nur nicht bis in den Text durchgereicht.
- Test wie `flash.test.ts`: Jede Meldung, die auf ein Feld verweist, muss einen
  Link tragen.

#### Der Link muss die Zeile treffen, nicht die Seite

Heute gibt es **nur Abschnittsanker**: `#einheiten`, `#eigentuemer`, `#konten`,
`#kostenarten`, `#objekt-einstellungen`. Ein Link führt also zur richtigen
Karte — und dann sucht man in einer Tabelle mit zwanzig Einheiten weiter. Auf
der Stammdatenseite ist genau das der Normalfall.

Drei Stufen, alle drei gehören zu LP2:

1. **Zeilenanker.** Jede Einheiten-, Konten- und Kostenartenzeile bekommt ein
   `id={`einheit-${u.id}`}`. Der Link zeigt dann auf die Zeile, nicht auf die
   Karte.
2. **Sichtbare Markierung.** `:target` in `globals.css` hebt die angesprungene
   Zeile kurz hervor. Ohne das landet man zwar richtig, sieht es aber nicht —
   besonders, wenn die Zeile am oberen Rand klebt.
3. **Fokus auf das fehlende Feld.** Wo die Meldung ein bestimmtes Feld nennt
   („Wohnfläche fehlt"), zeigt der Anker auf das Feld selbst und setzt den
   Fokus dorthin. Dann steht der Cursor da, wo getippt werden muss.

Grenze, die dazugehört: Ein Anker trägt eine ID aus der Datenbank. Wird die
Einheit gelöscht, führt der Link ins Leere — der Browser bleibt dann oben auf
der Seite stehen. Das ist der harmlose Ausgang und braucht keine Sonderbehandlung.

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
| LP6 Tour-Inhalte | mittel | LP4, LP5 | ~~ja~~ **nein, siehe unten** |
| LP7 Assistent | groß | LP3 | nein |

**Der Schnitt ist entfallen (Stand 28.07.2026).** Die Design-Vereinheitlichung
ist mit PR #45 abgeschlossen: Stufe 4 ist durch, die WEG-Finanzseiten sind
umgestellt, und die Ausnahmeliste in `eslint.oberflaeche.mjs` steht auf **null**
Einträgen. Damit steht die Oberfläche still genug für eine Führung, die auf sie
zeigt — alle sieben Pakete können hintereinander weg laufen.

---

## Zu LP5: Abstimmung nicht mehr nötig

Ursprünglich stand hier die Bitte, die `data-tour`-Marker in seiner Welle 3
mitzunehmen. Erledigt sich: Seine Stufe 4 ist abgeschlossen, `app-nav.ts` und
`app-shell.tsx` sind fertig umgestellt. Die Marker kommen jetzt hier dazu —
zusätzliche Attribute, die niemandem im Weg stehen.

Was bleibt: **Die Marker sind ab sofort Vertragsfläche.** Wer eine Seite umbaut
und einen `data-tour`-Marker entfernt, bricht die Führung. Der Test aus LP5
fängt das ab, damit es nicht erst dem Nutzer auffällt.
