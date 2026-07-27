# Laientauglichkeit und Use Cases

Stand: 26.07.2026 · Produktseitige Ergänzung zu
[`PLAN-WEG-Finanzkorrekturen.md`](./PLAN-WEG-Finanzkorrekturen.md)

Zwei Themen, die keine Fehlerkorrektur sind, aber über den Erfolg entscheiden:
Verständlichkeit für Laien und die Argumente, mit denen man Eigentümer gewinnt.

---

## Teil 1 — Verständlich für Laien, ohne fachlich falsch zu werden

**Die Spannung:** Das Programm muss fachlich und rechtlich exakt sein — eine
falsch benannte Abrechnungsspitze ist ein anfechtbarer Beschluss. Gleichzeitig
bedient es Menschen, die weder Buchhaltung noch WEG-Recht können und es
nebenbei zur Arbeit machen.

**Der Grundsatz, der das auflöst:** Fachbegriffe **nicht ersetzen, sondern
begleiten.** Der Eigentümer begegnet „Abrechnungsspitze" und „Erhaltungsrücklage"
ohnehin — im Gesetz, im Beschlusstext, beim Notar, in der Post vom Nachbarn.
Wer sie in der App wegübersetzt, macht ihn draußen sprachlos. Wer sie unerklärt
stehen lässt, verliert ihn drinnen. Also beides: Fachbegriff als Überschrift,
Klartext als Zeile darunter.

### 1.1 Sprachebenen

| Ebene | Beispiel |
|---|---|
| Fachbegriff (Überschrift, bleibt) | Abrechnungsspitze |
| Klartext (immer sichtbar darunter) | „Was Sie nachzahlen oder zurückbekommen" |
| Erklärung (aufklappbar/Tooltip) | „Ihr Kostenanteil im Jahr minus dem, was Sie über das Hausgeld schon gezahlt haben." |
| Rechtsquelle (klein, nur wenn aufgeklappt) | § 28 Abs. 2 WEG |

Weitere Kandidaten, bei denen Laien erfahrungsgemäß aussteigen:

- **Sollstellung** → „Forderung: was diese Einheit diesen Monat zahlen muss"
- **Wirtschaftsplan** → „Das Budget fürs Jahr — daraus ergibt sich Ihr Hausgeld"
- **Umlageschlüssel** → „Nach welchem Maßstab die Kosten aufgeteilt werden"
- **MEA / Miteigentumsanteil** → „Ihr Anteil am Gebäude, steht in Ihrer Teilungserklärung"
- **Erhaltungsrücklage** → „Das Sparbuch der Gemeinschaft für große Reparaturen"
- **Vermögensbericht** → „Was der Gemeinschaft gehört und was sie schuldet"
- **OPOS / offene Posten** → „Wer noch nicht gezahlt hat"
- **Umbuchung** → „Geld von einem Konto der Gemeinschaft auf ein anderes"
- **Abrechnungsspitze ≠ Rückstand** — der häufigste Denkfehler überhaupt; braucht
  einen eigenen Erklärkasten in der Abrechnung.

### 1.2 Ein- und ausschaltbare Erklärungen

Neues Feld `User.showHints Boolean @default(true)`.

- Für `accountType = "selbstverwalter"` standardmäßig **an**.
- Für professionelle Verwalter (B&W) standardmäßig **aus** — die brauchen keine
  Erklärung, was ein Wirtschaftsplan ist, und Erklärkästen machen die Oberfläche
  für den Profi langsam.
- Umschaltbar unter „Konto", plus ein „Erklärungen ausblenden"-Link direkt an
  jedem Kasten.

Damit bedient dieselbe Oberfläche beide Kundenprofile, ohne zwei Frontends.

### 1.3 Der Weg schlägt das Formular

Der größte Hebel für Laien ist nicht Wortwahl, sondern **Reihenfolge**. Ein Laie
scheitert nicht am Begriff „Jahresabrechnung", sondern daran, dass er nicht weiß,
was er zuerst tun muss.

Das Muster gibt es im Haus schon (Übergabe-Assistent, CSV-Import-Assistent):
nummerierte Schritte, jeder Schritt prüft sich selbst, der nächste wird erst
freigeschaltet, wenn der vorige stimmt. Genau das braucht der Jahreslauf:

> **Jahresabrechnung 2026 — Schritt 3 von 6**
> ① Buchungen vollständig ② Kostenarten zugeordnet ③ **Heizkosten erfassen**
> ④ Kontostände abgleichen ⑤ Prüfen ⑥ Fertigstellen

Dasselbe für die Ersteinrichtung einer WEG (Objekt → Einheiten mit MEA →
Kostenarten → Konten → erster Wirtschaftsplan). Das ist der Moment, in dem eine
selbstverwaltende WEG aufgibt oder bleibt.

### 1.4 Fehlermeldungen als Handlungsanweisung

Hier ist der Bestand schon gut („bitte in den Stammdaten die Miteigentumsanteile
aller Einheiten vervollständigen"). Regel für alles Neue: **Was ist passiert,
warum blockiert es, was ist der nächste Klick** — mit Link dorthin. Nie ein
Fehlercode, nie „ungültige Eingabe".

### 1.5 Der KI-Assistent

**Was heute schon da ist** (`assistant.ts`, `assistant-help.ts`):

- Antworten ausschließlich aus Inhalten, die der fragende Nutzer sehen darf —
  die Rechte werden bereits beim Datenabruf über `access.ts` erzwungen. Sauber
  gebaut, kein Datenleck über Rollen oder Mandanten.
- Geerdet auf Beschlüssen, Aushängen, Versammlungen, Anträgen, Vorgängen und
  Dokumenttiteln.
- **Bedienhilfe mit `href`** — der Assistent kann bereits erklären, wie man etwas
  macht, *und* dorthin verlinken. Genau die gewünschte Navigationsfähigkeit, im
  Ansatz vorhanden.
- Rollen: Verwalter und Eigentümer. Standardmäßig aus (Gemini-Key nötig).

**Was fehlt — und es ist genau das, wonach Eigentümer fragen:**

1. **Die Finanzdaten sind nicht im Kontext.** Der Assistent kennt Beschlüsse und
   Aushänge, aber nicht das eigene Hausgeld, die Abrechnung, den Rückstand oder
   den Rücklagenstand. „Warum muss ich 340 € nachzahlen?" kann er heute nicht
   beantworten — dabei ist das die häufigste Frage überhaupt.
2. **Kein WEG-Recht als Wissensquelle.** Fragen wie „dürfen wir das mehrheitlich
   beschließen?" oder „wie lange kann ich den Beschluss anfechten?" trifft er
   nicht. Der Skill-Inhalt (`weg-recht`) gehört als kuratierte Quelle dazu —
   mit klarer Kennzeichnung, dass es keine Rechtsberatung ist.
3. **Kein Seitenkontext.** Steht der Nutzer auf seiner Abrechnung, sollte die
   Frage „was heißt das?" sich auf *diese* Abrechnung beziehen.

**Datenschutz, ehrlich:** Freitext geht an Gemini. Solange es um Beschlusstexte
geht, ist das mit AVV vertretbar. Sobald Finanz- und Rückstandsdaten einzelner
Eigentümer in den Prompt wandern, wird die Abwägung eine andere — Rückstände
sind heikel. Vorschlag: Finanzdaten nur für die **eigenen** Einheiten des
Fragenden und aggregiert; Rückstände anderer Eigentümer nie in den Prompt,
auch nicht für den Verwalter.

---

## Teil 2 — Use Cases: womit man Eigentümer gewinnt

Zielgruppe: eine WEG, die heute mit Excel und Ordnern selbst verwaltet — oder
die einen teuren Verwalter loswerden will. Sortiert nach Überzeugungskraft.

### 1. Geld zurück vom Finanzamt (§ 35a EStG)

Das stärkste Argument, weil es **rechenbar** ist und die Software sich selbst
bezahlt. 20 % der Lohnkosten werden direkt von der Steuerschuld abgezogen —
für eine normale Wohnung 80–180 € im Jahr. Ohne Bescheinigung des Verwalters
bekommt der Eigentümer nichts (§ 35a Abs. 5 Satz 3 EStG), und in
selbstverwalteten WEGs erstellt sie fast nie jemand.

> „Ihre Gemeinschaft verschenkt jedes Jahr Geld ans Finanzamt. Bei 20 Einheiten
> rund 2.000 € — die App erstellt die Bescheinigung auf Knopfdruck."

### 2. Eine Abrechnung, die der Anfechtung standhält

Der häufigste Anfechtungsgrund ist die Abrechnung, deren Endbestand nicht zum
Kontoauszug passt. Die App **lässt eine Abrechnung erst zu, wenn beides exakt
übereinstimmt** — dazu kommen centgenaue Verteilung und Plausibilitätsprüfungen.

> „Sie können keine Abrechnung fertigstellen, die rechnerisch nicht aufgeht.
> Das ist keine Bequemlichkeit, das ist Ihr Schutz vor der Anfechtung."

Angst vor Fehlern ist bei Selbstverwaltern das Thema Nummer eins.

### 3. Nicht mehr von einer Person abhängig

Der klassische Tod der Selbstverwaltung: der eine Eigentümer, der die Buchhaltung
macht, zieht weg, wird krank oder hat keine Lust mehr — und niemand versteht
seine Excel-Datei. Alles liegt in einem System, der Beirat hat Einsicht, die
Übergabe ist ein Zugang statt eines Umzugskartons.

> „Was passiert, wenn Herr Müller nächstes Jahr aufhört?"

### 4. Kostenersparnis, konkret gerechnet

Externe WEG-Verwaltung kostet 25–35 € je Einheit und Monat. Bei 20 Einheiten
6.000–8.400 € im Jahr. Das ist die Ankerzahl, gegen die jeder Preis klein
aussieht.

### 5. Beschlussfähig ohne Anwalt

Ladungsfrist drei Wochen, doppelt qualifizierte Mehrheit nach § 21 Abs. 2,
Beschluss-Sammlung nach § 24 Abs. 7, Anfechtungsfrist ein Monat. Laien kennen
diese Regeln nicht und stolpern zuverlässig darüber. Die App rechnet die
Mehrheit aus, führt die Sammlung und wacht über die Fristen.

### 6. Transparenz gegen Misstrauen

In selbstverwalteten Gemeinschaften ist „was macht der eigentlich mit unserem
Geld?" der häufigste Konfliktherd. Jeder Eigentümer sieht Wirtschaftsplan,
Abrechnung, Beschlüsse und den Prüfvermerk des Beirats — jederzeit, ohne
Nachfragen. Das entschärft Konflikte, bevor sie entstehen.

### 7. Nach neuem Recht, nicht nach altem

Viele selbstverwaltete WEGs arbeiten noch nach der Praxis vor 2020: Soll-Ist-
Vergleich, Beschluss über die gesamte Abrechnung statt über die
Abrechnungsspitze, „Instandhaltungsrücklage". Die App macht es nach WEMoG
richtig — ein Argument, das besonders bei Beiräten zieht, die schon einmal einen
aufgehobenen Beschluss erlebt haben.

### 8. Reicht unsere Rücklage?

Die Erhaltungsplanung stellt den Bedarf aus den geplanten Maßnahmen dem
prognostizierten Rücklagenstand gegenüber und nennt **das Jahr der
Unterdeckung**. Das ist die Frage, die jeden Beirat nachts beschäftigt, und
kaum ein Wettbewerber beantwortet sie greifbar.

### 9. Der Verkaufsfall

Beim Wohnungsverkauf braucht der Eigentümer kurzfristig: Rücklagenstand,
Hausgeldhöhe, offene Sonderumlagen, Beschluss-Sammlung, letzte Abrechnungen.
Sonst ist das eine Panik-Suche in Ordnern. Hier liegt alles beisammen.

### 10. Ein Ort statt fünf

Schäden melden, Handwerker beauftragen, Dokumente, Aushänge, Versammlung,
Abstimmung, Buchhaltung. Kein WhatsApp-Verteiler, kein Aushang im Treppenhaus,
kein Ordner im Keller.

### Für die professionelle Seite (B&W und White-Label-Kunden)

Anderer Pitch, gleiche Substanz: eigenes Erscheinungsbild unter eigener Domain,
Eigentümer- und Mieterportal ohne Zusatzlizenz, weniger Rückfragen durch
Statustransparenz, Beirat mit eigener Prüfansicht — und die Möglichkeit,
selbstverwaltende WEGs als Kunden zu bedienen, ohne sie voll zu verwalten.

---

## Was daraus in den Umsetzungsplan gehört

- Erklärebene (`User.showHints`) und Begriffs-Klartext: quer durch alle Pakete,
  als Prinzip — nicht als eigenes Paket, sonst wird es nie gemacht.
- Assistent um Finanzdaten (eigene Einheiten), WEG-Recht und Seitenkontext
  erweitern: eigenes Paket in Block 4.
- Geführter Jahreslauf (Schritt-für-Schritt statt Formularseite): Block 4,
  baut auf der Objekt-Startseite aus Block 1 auf.
