# PLAN — Higgsfield Supercomputer: laufender Content für wegportal24

Stand: 17.08.2026. Dieses Dokument ist die Übergabe an den **Higgsfield
Supercomputer** (agentischer Content-Agent von higgsfield.ai): Er soll
regelmäßig kurze Videos und Bildposts zu WEG-Verwaltung erzeugen — speziell
für **kleine, selbstverwaltete WEGs** — im Branding von wegportal24.

Der Supercomputer nimmt Briefings in Klartext an, hat ein **Marken-Gedächtnis**
(merkt sich Markenprofil und Stil dauerhaft) und kann **wiederkehrende
Aufgaben** (Scheduled Tasks) selbstständig ausführen. Genau darauf ist dieser
Plan zugeschnitten: Die Blöcke 1–4 werden nacheinander eingefügt, danach läuft
die Produktion im Wochenrhythmus.

Quellen der Markenangaben im Repo — wer dort etwas ändert, zieht diesen Plan
nach:

- Name/Domain: `portal/src/components/marketing/brand.tsx`
- Farben: `--color-wp-*` in `portal/src/app/globals.css`
- Preise: `portal/src/app/preise/preise-daten.ts`
- Tonalität/Verbote: Skills `marken-seiten` und `werbevideo`

---

## So wird übergeben (Reihenfolge einhalten)

1. **Marken-Gedächtnis füllen:** Block 1 als erste Nachricht einfügen.
   Zusätzlich hochladen: `portal/public/wegportal24-logo.png` (echtes Logo —
   Higgsfield darf **kein** Logo generieren) und 2–3 Screenshots der App.
2. **Regeln verankern:** Block 2 einfügen und bestätigen lassen, dass die
   Regeln für **jede** künftige Aufgabe gelten.
3. **Wiederkehrende Aufgaben anlegen:** Die drei Wochen-Tasks und den
   Monats-Task aus Block 3 als Scheduled Tasks einrichten.
4. **Themenspeicher übergeben:** Block 4 einfügen. Anweisung: Liste der Reihe
   nach abarbeiten, erledigte Themen merken, kein Thema binnen 6 Monaten
   wiederholen.
5. **Freigabe behalten:** Nichts automatisch veröffentlichen lassen. Jede
   Ausgabe vor dem Posten prüfen (Checkliste am Ende).

---

## Block 1 — Markenprofil (einmalig ins Gedächtnis)

```text
Merke dir dieses Markenprofil dauerhaft für alle künftigen Aufgaben.

MARKE
- Name: wegportal24 (immer klein, ohne Punkt, ohne Leerzeichen). Domain: wegportal24.de.
- Produkt: Online-Portal, mit dem kleine Wohnungseigentümergemeinschaften (WEGs)
  ihre Verwaltung selbst übernehmen – Wirtschaftsplan, Hausgeld, Jahresabrechnung,
  Eigentümerversammlung, Beschlüsse, Dokumente, alles an einem Ort.
- Herkunft, falls je gefragt: „die Verwaltung hinter wegportal24“ – niemals
  Firmen- oder Personennamen nennen.

ZIELGRUPPE
- Eigentümerin/Eigentümer oder Verwaltungsbeirat einer kleinen WEG (2–12 Einheiten),
  die die Verwaltung ehrenamtlich selbst übernehmen – oft, weil sich für kleine
  Gemeinschaften kein professioneller Verwalter findet.
- Gefühlslage: Überforderung und Haftungsangst, NICHT Effizienzdruck. Diese Menschen
  wollen die Gewissheit, nichts falsch zu machen.
- Teils älteres Publikum: ruhiges Tempo, große gut lesbare Schrift, keine Hektik.

TONALITÄT
- Deutsch, Sie-Anrede, direkte Ansprache („Sie übernehmen das Amt“).
- Ruhig, klar, seriös, auf Augenhöhe. Hilfsbereit, nie belehrend, nie reißerisch.
- WEG-Fachbegriffe BENUTZEN, sie schaffen Glaubwürdigkeit: Wirtschaftsplan, Hausgeld,
  Eigentümerversammlung, Beschlusssammlung, Umlaufbeschluss, Erhaltungsrücklage,
  Jahresabrechnung, Teilungserklärung.
- VERBOTEN ist Marketing-Jargon: „Onboarding“, „SaaS“, „Cloud-Plattform“, „Workflow“,
  „PropTech“, „Prozesse digitalisieren“, „Game-Changer“.

FARBEN (immer diese, keine eigenen)
- Dunkelgrün #003630 – Hauptfarbe, Flächen, Endcard-Hintergrund
- Helleres Grün #0c534a – Verläufe, Lichtflächen
- Tinte #00241f – Text auf hellem Grund
- Orange #f69018 – Akzent und Handlungsaufforderung; auf dunklem Grund
- Dunkles Orange #dd7d0c – Hover/Schatten des Akzents
- Helles Orange #fef1e0 und helles Grün #e8efed – sanfte Hintergrundflächen
- Orangefarbener TEXT auf weißem Grund immer abgedunkelt: #8f5407
- Schrift: Source Sans 3 (ersatzweise eine ruhige humanistische Serifenlose).

BILD- UND BEWEGTSPRACHE
- Echte, ruhige Wohnhaus-Motive: gepflegte Mehrfamilienhäuser (2–12 Wohnungen),
  Treppenhäuser, Briefkästen, Gartentische mit Unterlagen. Deutschland-typisch.
- Menschen: alltäglich und glaubwürdig, gemischtes Alter ab ~45. Keine
  Hochglanz-Business-Optik, keine Anzugträger vor Wolkenkratzern.
- Schnitt: ruhig, harte Schnitte statt Dauer-Überblendungen, Bewegungen mit weichem
  Auslaufen. VERBOTEN: Bounce-Effekte, Whoosh-Übergänge, 3D-Flips, Dauer-Zoom.
- Jedes Video muss STUMM funktionieren: alle Kernaussagen als Texttafel oder
  Untertitel. Lesetempo ~14 Zeichen pro Sekunde, höchstens 2 Zeilen à 42 Zeichen,
  jede Einblendung mindestens 2 Sekunden.
- Endcard jedes Videos (3–5 Sekunden): dunkelgrüner Grund #003630, Wortmarke
  wegportal24 (hochgeladene Logodatei, NIE selbst generieren), darunter in Orange:
  „Kostenlos starten auf wegportal24.de“.
```

## Block 2 — Feste Regeln (gelten für jede Aufgabe)

```text
Diese Regeln gelten ausnahmslos für jede Aufgabe, die du für wegportal24 erledigst.
Bestätige, dass du sie dauerhaft anwendest.

1. KEINE erfundenen Kundenstimmen, Namen, Bewertungen, Sterne oder Fallgeschichten
   über einzelne (erfundene) Personen. Auch keine KI-Avatare, die sich als Kunden
   ausgeben. Erlaubt ist direkte Ansprache: „Sie übernehmen das Amt …“
2. KEINE Kundenzahlen oder Nutzerzahlen („500+ WEGs vertrauen uns“).
3. KEINE Ersparnisversprechen in Euro oder Prozent.
4. NIEMALS „rechtssicher“, „gerichtsfest“ oder ähnliche Garantien versprechen.
5. Rechtsthemen sind allgemeine Information, keine Beratung. Bei jedem Thema mit
   Paragrafen oder Fristen gehört an den Schluss (Einblendung oder Begleittext):
   „Allgemeine Information, keine Rechtsberatung.“
6. Paragrafen nur nennen, wenn du sicher bist (WEG-Gesetz in der Fassung seit
   1.12.2020). Im Zweifel ohne Paragraf formulieren. Keine Urteile erfinden.
7. Erlaubte Vertrauens-Fakten: kostenlos starten, Start ohne Zahlungsdaten, DSGVO.
   Sonst keine Behauptungen über das Produkt erfinden.
8. Preise nur nennen, wenn die Aufgabe es ausdrücklich verlangt – und dann exakt:
   Start-Tarif kostenlos; Basic 10 € je Einheit/Monat; Verwalter-Plus 13,90 € je
   Einheit/Monat; alle Preise inklusive Mehrwertsteuer; keine Mindestlaufzeit,
   monatlich kündbar. Nichts davon runden, staffeln oder ergänzen.
9. Keine anderen Marken, Firmen oder Personen nennen oder zeigen.
10. Jede Ausgabe ist ein ENTWURF zur Freigabe. Du veröffentlichst nichts selbst.
```

## Block 3 — Wiederkehrende Aufgaben (Scheduled Tasks)

Drei Wochen-Tasks plus ein Monats-Task. Die Prompts sind so formuliert, dass
sie direkt als wiederkehrende Aufgabe gespeichert werden können.

**Task 1 · montags · Wissens-Reel**

```text
Erstelle ein Hochkant-Video (9:16, 25–40 Sekunden) für Instagram Reels, TikTok und
YouTube Shorts im Markenprofil von wegportal24.

- Nimm das nächste unerledigte Thema aus dem Themenspeicher (Säulen A, B, C oder F)
  und merke es dir als erledigt.
- Aufbau: Hook als Frage oder Irrtum (2–3 s) → 3 Kernaussagen als ruhige Texttafeln
  mit passendem Bildmotiv (je 6–9 s) → Endcard laut Markenprofil (3–5 s).
- Alle Kernaussagen als Text im Bild, das Video muss stumm funktionieren.
- Liefere dazu: Begleittext (max. 500 Zeichen, Sie-Anrede, 3–5 passende Hashtags,
  z. B. #WEG #Eigentümergemeinschaft #Verwaltungsbeirat) und einen Titelvorschlag.
- Beachte die festen Regeln von wegportal24, insbesondere den Hinweis
  „Allgemeine Information, keine Rechtsberatung.“ bei Rechtsthemen.
- Ausgabe als Entwurf zur Freigabe, nicht veröffentlichen.
```

**Task 2 · mittwochs · Checklisten-Karussell**

```text
Erstelle ein Bild-Karussell (5–7 Karten, Format 4:5) für Instagram und LinkedIn im
Markenprofil von wegportal24.

- Nimm das nächste unerledigte Thema aus dem Themenspeicher, das sich als Checkliste
  oder Schritt-für-Schritt-Anleitung eignet (bevorzugt Säulen B, C, D und E),
  und merke es dir als erledigt.
- Karte 1: Titelkarte mit klarer Nutzenfrage („Jahresabrechnung prüfen: Worauf
  achten?“), dunkelgrüner Grund, große Schrift.
- Karten 2–6: je EIN Punkt pro Karte, kurze Erklärung in 1–2 Sätzen, viel Weißraum.
- Letzte Karte: Endcard laut Markenprofil.
- Liefere dazu einen Begleittext (max. 800 Zeichen), der die Liste zusammenfasst.
- Beachte die festen Regeln. Ausgabe als Entwurf zur Freigabe.
```

**Task 3 · freitags · Frage der Woche**

```text
Erstelle ein kurzes Hochkant-Video (9:16, 15–25 Sekunden) im Markenprofil von
wegportal24: „Frage der Woche“ aus der WEG-Selbstverwaltung.

- Wähle eine echte, häufige Praxisfrage kleiner WEGs (aus dem Themenspeicher oder
  naheliegend, z. B. „Dürfen wir per E-Mail abstimmen?“, „Wer lädt zur Versammlung
  ein, wenn es keinen Verwalter gibt?“).
- Aufbau: Frage groß im Bild (3–4 s) → Antwort in höchstens 2 Texttafeln (8–12 s)
  → Endcard laut Markenprofil.
- Ton knapp und beruhigend: erst die Antwort, dann falls nötig die Einschränkung.
- Bei Rechtsfragen: „Allgemeine Information, keine Rechtsberatung.“
- Begleittext max. 300 Zeichen. Ausgabe als Entwurf zur Freigabe.
```

**Task 4 · monatlich (1. des Monats) · Saison-Reel**

```text
Erstelle ein Hochkant-Video (9:16, 30–45 Sekunden) im Markenprofil von wegportal24
zum aktuellen Monat im WEG-Jahreslauf (Saisonkalender im Themenspeicher).

- Rahmen: „Ihre WEG im <Monat>: Das steht jetzt an.“ – 3 bis 4 Punkte, was kleine
  selbstverwaltete WEGs in diesem Monat erledigen oder vorbereiten sollten.
- Ruhige Texttafeln, passende saisonale Bildmotive (Haus im Jahresverlauf).
- Endcard laut Markenprofil. Begleittext max. 500 Zeichen.
- Beachte die festen Regeln. Ausgabe als Entwurf zur Freigabe.
```

## Block 4 — Themenspeicher

```text
Das ist der Themenspeicher für wegportal24. Arbeite ihn bei den wiederkehrenden
Aufgaben der Reihe nach ab (innerhalb einer Säule von oben nach unten, Säulen
abwechseln). Merke dir erledigte Themen und wiederhole keines innerhalb von
6 Monaten. Wenn der Speicher abgearbeitet ist, schlage 10 neue Themen im selben
Stil zur Freigabe vor.

SÄULE A – AMT & GRUNDLAGEN
A1  Verwalter gekündigt oder nicht mehr auffindbar – die ersten 3 Schritte.
A2  Braucht unsere kleine WEG überhaupt einen Verwalter? Was das Gesetz erlaubt.
A3  Selbstverwaltung: Was Sie wirklich übernehmen – und was nicht.
A4  Verwaltungsbeirat: Aufgaben, Rechte und Grenzen, kurz erklärt.
A5  Diese 5 Unterlagen muss jede WEG griffbereit haben.
A6  Zertifizierter Verwalter: Was hinter § 26a WEG steckt.
A7  Warum kleine WEGs oft keinen Verwalter finden – und was dann hilft.
A8  Eigentümerwechsel in der WEG: Woran die Gemeinschaft denken muss.

SÄULE B – GELD
B1  Wirtschaftsplan in 5 Schritten aufstellen.
B2  Hausgeld: Wie es sich zusammensetzt – und was oft vergessen wird.
B3  Erhaltungsrücklage: Wie viel sollte eine kleine WEG zurücklegen?
B4  Jahresabrechnung prüfen: Diese Punkte zuerst.
B5  Sonderumlage: Wann sie nötig ist und wie sie beschlossen wird.
B6  Warum die WEG ein eigenes Konto braucht – und kein Privatkonto.
B7  Ein Eigentümer zahlt kein Hausgeld: Was die Gemeinschaft tun kann.
B8  Kostenverteilung: Miteigentumsanteile und andere Schlüssel, einfach erklärt.

SÄULE C – VERSAMMLUNG & BESCHLÜSSE
C1  Eigentümerversammlung einberufen: Form und Fristen.
C2  Die Tagesordnung: Was hinein muss, damit Beschlüsse halten.
C3  Protokoll der Versammlung: Was hineingehört – und wer unterschreibt.
C4  Beschlusssammlung: Die Pflicht, die fast jede kleine WEG vergisst.
C5  Umlaufbeschluss: Abstimmen ohne Versammlung – so geht es richtig.
C6  Vollmachten: Wer darf für wen abstimmen?
C7  Beschluss anfechten: Die Fristen, die jeder Eigentümer kennen sollte.
C8  Online- und Hybrid-Versammlung: Was inzwischen möglich ist.

SÄULE D – PFLICHTEN & JAHRESLAUF
D1  Verkehrssicherungspflicht: Wofür die WEG haftet (Winterdienst, Bäume, Wege).
D2  Heizkostenabrechnung: Fristen und Pflichtangaben im Überblick.
D3  Der Wartungs-Jahresplan: Was am Haus regelmäßig geprüft gehört.
D4  Versicherungen der WEG: Welche Pflicht sind, welche sinnvoll.
D5  Der WEG-Jahresfahrplan: Was wann fällig ist.

SÄULE E – TYPISCHE FEHLER
E1  Die 5 häufigsten Fehler selbstverwalteter WEGs.
E2  „Das haben wir immer so gemacht“ – Gewohnheiten, die teuer werden.
E3  Beschluss gefasst, nie umgesetzt: Warum das riskant ist.
E4  Zettelwirtschaft: Warum verstreute Unterlagen zum Problem werden.
E5  Einladung zu kurzfristig verschickt – und nun?

SÄULE F – ERHALTUNG & MODERNISIERUNG
F1  Kleine Reparatur oder Erhaltungsmaßnahme: Wer entscheidet was?
F2  Handwerker beauftragen als WEG: Angebot, Beschluss, Abnahme.
F3  Balkonkraftwerk und Wallbox: Welche Maßnahmen Eigentümer verlangen können.
F4  Barrierefreier Umbau: Was ein einzelner Eigentümer durchsetzen kann.
F5  Große Maßnahme, kleine WEG: Erhaltung planen und finanzieren.

SAISONKALENDER (für den Monats-Task)
Jan–Mär: Belege ordnen, Jahresabrechnung vorbereiten, Heizkostenabrechnung.
Apr–Jun: Versammlungssaison – einladen, durchführen, Protokoll und Beschlüsse sichern.
Jul–Sep: Erhaltung und Baustellen, Rücklagen-Check, Versicherungen prüfen.
Okt–Dez: Wirtschaftsplan fürs neue Jahr, Winterdienst und Verkehrssicherung,
         Fristen zum Jahresende.
```

---

## Freigabe-Checkliste (vor jeder Veröffentlichung)

Der Supercomputer liefert Entwürfe; veröffentlicht wird von Hand. Je Ausgabe
prüfen:

1. **Fachlich:** Stimmen Aussagen, Fristen, Paragrafen? Im Zweifel Paragraf
   streichen — eine richtige Aussage ohne § schlägt eine falsche mit §.
2. **Regeln:** Keine erfundenen Stimmen/Zahlen, kein „rechtssicher", kein
   Ersparnisversprechen, Rechtsthemen mit dem Hinweis „Allgemeine Information,
   keine Rechtsberatung."
3. **Marke:** Schreibweise „wegportal24", Farben korrekt, echtes Logo (nicht
   generiert), Endcard mit Domain.
4. **Lesbarkeit:** Stumm angesehen — alles verstanden? Texttafeln lang genug
   im Bild?
5. **Kennzeichnung:** Beim Posten die Plattform-Kennzeichnung für
   KI-generierte Inhalte aktivieren (Instagram/TikTok/YouTube verlangen das
   für synthetische Szenen).

## Bewusst NICHT an Higgsfield gegeben

- **Echte App-Aufnahmen.** Blicke in die Software entstehen weiterhin über die
  Playwright-Kette unter `video/` (Skill `werbevideo`) — eine KI, die die
  Oberfläche „nachmalt", zeigt zwangsläufig eine App, die es so nicht gibt.
  Higgsfield bekommt die Themenwelt, nicht die Produktdemo.
- **Preiswerbung als Dauerformat.** Preise ändern sich an einer Stelle
  (`preise-daten.ts`); generierte Posts mit Preisen veralten unbemerkt.
  Preise nur in einzeln beauftragten, geprüften Posts.
- **Logo-Generierung.** Die Wortmarke wird als Datei hochgeladen und
  unverändert verwendet.
