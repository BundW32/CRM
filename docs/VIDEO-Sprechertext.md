# Sprechertext für das Hero-Video

Passend zu `video/out/hero-full.mp4` (Fassung 7, 57,8 Sekunden).

Der Text ist auf die Schnittzeiten gerechnet: **rund 130 Wörter pro Minute**,
also etwa 2,2 Wörter je Sekunde. Das ist bewusst ruhig — die Zielgruppe sind
Eigentümer, die Sicherheit suchen, keine Tech-Käufer. Schneller gesprochen
klingt es nach Werbespot und verliert genau die Glaubwürdigkeit, die das Video
aufbaut.

Insgesamt **125 Wörter**. Jede Zeile hat Luft zum Atmen; die Pausen zwischen den
Abschnitten sind Teil der Rechnung.

---

## Die Abschnitte

| # | Zeit | Länge | Text | Wörter |
|---|---|---|---|---|
| 1 | 0,0–2,9 | 2,9 s | Keine Hausverwaltung gefunden? Die Pflichten bleiben. | 7 |
| 2 | 2,9–8,1 | 5,2 s | Das Portal führt Sie durchs Jahr und zeigt, was jetzt dran ist. | 12 |
| 3 | 8,1–12,2 | 4,1 s | Der Wirtschaftsplan verteilt jede Kostenart nach dem richtigen Schlüssel. | 9 |
| 4 | 12,2–15,4 | 3,2 s | Daraus entsteht das Hausgeld — centgenau je Einheit. | 8 |
| 5 | 15,4–21,1 | 5,7 s | Die Forderungen entstehen automatisch. Sie sehen, wer gezahlt hat — und wer nicht. | 13 |
| 6 | 20,9–26,9 | 6,0 s | Versammlungen planen Sie mit Tagesordnung und Beschlussvorlagen. Ein Klick sortiert um. | 11 |
| 7 | 26,8–31,2 | 4,4 s | Am Jahresende: die Jahresabrechnung mit Abrechnungsspitze je Einheit. | 8 |
| 8 | 31,0–34,6 | 3,6 s | Ein Klick — und das fertige PDF liegt vor. | 9 |
| 9 | 34,4–39,2 | 4,8 s | Alles funktioniert auch am Telefon. Unterwegs, ohne zusätzliche App. | 9 |
| 10 | 39,1–42,7 | 3,6 s | Die Beschluss-Sammlung bleibt lückenlos — und lässt sich exportieren. | 8 |
| 11 | 42,5–46,5 | 4,0 s | Jeder Eigentümer sieht mit. Ändern dürfen nur die, die es sollen. | 11 |
| 12 | 46,3–55,0 | 8,7 s | Und wenn eine Frage bleibt, antwortet der Assistent — aus Ihren eigenen Unterlagen, mit Quellenangabe. | 15 |
| 13 | 54,8–57,8 | 3,0 s | Ihre Gemeinschaft. Ihre Zahlen. Jetzt kostenlos einrichten. | 7 |

## Der Text am Stück

> Keine Hausverwaltung gefunden? Die Pflichten bleiben.
>
> Das Portal führt Sie durchs Jahr und zeigt, was jetzt dran ist.
>
> Der Wirtschaftsplan verteilt jede Kostenart nach dem richtigen Schlüssel.
> Daraus entsteht das Hausgeld — centgenau je Einheit.
>
> Die Forderungen entstehen automatisch. Sie sehen, wer gezahlt hat — und wer nicht.
>
> Versammlungen planen Sie mit Tagesordnung und Beschlussvorlagen. Ein Klick sortiert um.
>
> Am Jahresende: die Jahresabrechnung mit Abrechnungsspitze je Einheit.
> Ein Klick — und das fertige PDF liegt vor.
>
> Alles funktioniert auch am Telefon. Unterwegs, ohne zusätzliche App.
>
> Die Beschluss-Sammlung bleibt lückenlos — und lässt sich exportieren.
>
> Jeder Eigentümer sieht mit. Ändern dürfen nur die, die es sollen.
>
> Und wenn eine Frage bleibt, antwortet der Assistent — aus Ihren eigenen
> Unterlagen, mit Quellenangabe.
>
> Ihre Gemeinschaft. Ihre Zahlen. Jetzt kostenlos einrichten.

---

## Stimme und Einstellungen

**Ich kann ElevenLabs von hier aus nicht ausprobieren** — die folgenden Angaben
sind begründete Empfehlungen, keine getesteten Ergebnisse. Die Stimme solltest
du mit den ersten zwei Abschnitten gegenhören, bevor du alles erzeugst.

**Was die Stimme können muss:** deutscher Muttersprachler-Klang, mittleres
Alter, warm und ruhig, ohne Verkaufston. Der Zuschauer ist ein ehrenamtlicher
Beirat mit Haftungssorge — er soll denken „die verstehen mein Problem", nicht
„die wollen mir etwas verkaufen". Männlich oder weiblich ist zweitrangig; eine
etwas tiefere, unaufgeregte Stimme trägt das Thema besser.

**Wichtig zur Auswahl:** Die bekannten Standardstimmen der Bibliothek sind
englische Aufnahmen. Über das mehrsprachige Modell sprechen sie zwar Deutsch,
behalten aber einen hörbaren Akzent — besonders bei „Wirtschaftsplan",
„Abrechnungsspitze", „Beschluss-Sammlung". Such deshalb in der Voice Library
gezielt nach einer **deutschen** Stimme (Filter: Sprache Deutsch, Kategorie
Narration/Informative).

| Einstellung | Wert | Warum |
|---|---|---|
| Modell | Multilingual v2 (oder neuer, sofern Deutsch unterstützt) | Deutsche Aussprache der Fachbegriffe |
| Stability | 0,45–0,55 | Genug Lebendigkeit, ohne dass die Betonung springt |
| Similarity | 0,75 | Nah an der Vorlage |
| Style | 0 | Kein Drama. Jede Erhöhung klingt hier nach Werbespot |
| Speaker Boost | an | Etwas mehr Präsenz |
| Speed | 0,95–1,00 | Der Text ist für ~130 Wörter/Minute geschrieben |

## Wie du es zusammenbringst

**Abschnittsweise erzeugen, nicht am Stück.** Dreizehn einzelne Dateien lassen
sich auf die Schnittzeiten legen; eine durchgehende Aufnahme verschiebt sich
schon nach dem zweiten Satz gegen das Bild.

Wenn ein Abschnitt zu lang gerät: **erst die Geschwindigkeit senken oder ein
Wort streichen**, nicht die Musik-/Bildzeiten ändern. Die Schnittzeiten stehen
in `video/remotion/src/schnitt.jsx` und sind aufeinander abgestimmt.

Die Tonspur lege ich dir auf Wunsch über das Video — dann prüfe ich auch, ob
jeder Satz in seiner Einstellung landet, und verschiebe die Schnitte um Zehntel,
wo es klemmt.

---

## Ein Einwand, den du kennen solltest

Das Video trägt bereits **Unterzeilen**, die fast dasselbe sagen wie dieser
Text. Beides zusammen ist doppelt: Der Zuschauer liest und hört denselben Satz,
und das wirkt schnell wie eine Untertitelspur statt wie eine Gestaltung.

Drei Wege, in der Reihenfolge meiner Empfehlung:

1. **Unterzeilen auf drei bis vier kürzen** — Hook, der Hausgeld-Moment, die
   Quellenangabe, die Endtafel. Der Rest wird gesprochen. So bleibt das Video
   auch stumm im Autoplay verständlich, weil die tragenden Aussagen weiter im
   Bild stehen.
2. **Unterzeilen ganz raus**, sobald es Ton gibt — dann braucht die Startseite
   aber zusätzlich eine stumme Fassung für den Autoplay-Bereich.
3. **Beides lassen** — funktioniert, wirkt aber redundant.

Für Weg 1 oder 2 ändere ich nur `schnitt.jsx`; die Aufnahmen bleiben unberührt.
