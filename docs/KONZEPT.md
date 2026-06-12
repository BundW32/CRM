# CRM / Kundenportal — B&W Immobilien Management UG

Stand: 12.06.2026 — Recherche- und Konzeptdokument (Grundlage für die Entwicklung)

## 1. Firmenprofil (Rechercheergebnis)

**B&W Immobilien Management UG (haftungsbeschränkt)**
Goethestraße 42, 45964 Gladbeck — info@bundwimmobilien.de — www.bundwimmobilien.de
Ansprechpartner: Alexander Wachtel

Leistungen:
- **Hausverwaltung**: Mietverwaltung, WEG-Verwaltung und Gewerbeimmobilien — mit digitalen Prozessen, transparenter Kommunikation und strukturierten Abläufen. Zusätzlich Facility-Services und technische Betreuung. Tätig in Gladbeck, im Ruhrgebiet und in ganz NRW.
- **Maklerservice**: Vermarktung und Vermittlung von Immobilien inkl. Wertermittlung, Mieterauswahl und Vertragsabwicklung.
- **Modernisierungsmaßnahmen**: Durchführung von Modernisierungen zur langfristigen Wertsteigerung.

Positionierung: Junges Team, unternehmerischer Blick auf Rendite, Fokus auf Digitalisierung und Transparenz — das CRM/Portal ist die konsequente Fortsetzung dieser Positionierung.

## 2. Zielbild

Ein Kundenportal/CRM, erreichbar über einen **Login-Button auf www.bundwimmobilien.de**, mit drei (später vier) Rollen, die jeweils nur ihre spezifischen Inhalte sehen:

| Rolle | Kernfunktionen |
|---|---|
| **Mieter** | Schäden melden & dokumentieren (mit Foto-Upload), Status verfolgen, Kontakt zur Verwaltung, Dokumente anfordern/abrufen, Infos & Aushänge erhalten |
| **Eigentümer** | Statistiken & Auswertungen zum Objekt, Objektinformationen, Dokumente (Abrechnungen, Protokolle), Kommunikation mit der Verwaltung |
| **Verwalter (B&W)** | Zentrale Steuerung: Vorgangs-/Ticketmanagement, Objekt- & Kontaktverwaltung, Dokumentenverwaltung, Kommunikation, Auswertungen, Automatisierung |
| **Handwerker** (Ausbaustufe) | Auftragsannahme, Terminabstimmung, Dokumentation der Ausführung mit Fotos |

Langfristig: **Immoware24-Anbindung** (REST-API vorhanden) und maximale Automatisierung.

## 3. Wettbewerbsanalyse

### Casavi (casavi.com)
- **Service-App & Kundenportal** für Mieter und Eigentümer (Web + Mobile): Dokumentenarchiv, Mitteilungen, Formulare zur Schadensmeldung, Schwarzes Brett / Community-Bereich.
- **Vorgangsmanagement „SmartTask“**: Anfragen werden zentral als Vorgänge erfasst, individuellen Vorgangstypen zugeordnet, Mitarbeitern zugewiesen; der Anfragende sieht jederzeit den Bearbeitungsstatus.
- **Dienstleisterplattform „Relay“**: Hausmeister und Handwerker werden direkt angebunden — vom Auftrag bis zur Rechnung digital.
- **Automatisierung / KI („casavi AI Automate“)**: Schlagwort-Erkennung (z. B. „Aufzug“, „Wasserschaden“) erzeugt automatisch einen Auftrag an den zuständigen Dienstleister; Workflow-Vorlagen für Vertretungen, Eskalationen, automatische Schadenweiterleitung.
- **Manager-App** für Verwalter unterwegs.

### etg24 (etg24.de)
- **Eigentümer- und Mieterportal** als zentrale Anlaufstelle; Apps für alle Beteiligten.
- **Dokumentenmanagement** mit vordefinierten, wohnungswirtschaftlichen Kategorien (Abrechnungen, Protokolle, Verträge) — jederzeit online abrufbar.
- **Standardisierte Service-Formulare** für Anfragen und Schadensmeldungen.
- **Eigentümerversammlungen & Umlaufbeschlüsse** digital: Einladung, Online-Abstimmung, Protokoll in einem System.
- **Aufgaben- und Terminmanagement** für Verwalter-Mitarbeiter mit Übersichtsseiten.
- **Vorgangsmanagement** als „digitale Aktenmappe“: Sanierungen/Schadensfälle mit Updates, Fotos und Dokumenten chronologisch dokumentiert.

### Immoware24 (Bestandskontext)
- Webbasierte Komplettlösung für Verwaltung (Buchhaltung, Abrechnung, Stammdaten).
- Bietet selbst ein Portal („Portal24“) — unser eigenes Portal muss sich also durch bessere UX, Maklerservice-/Modernisierungs-Integration und eigene Automatisierung abheben.
- **REST-API vorhanden** → Grundlage für die geplante Schnittstelle (Stammdaten-Sync: Objekte, Einheiten, Verträge, Kontakte; perspektivisch Dokumente/Abrechnungen).

### Was wir uns abschauen (Inspiration)
1. **Statusverfolgung für Melder** (Casavi): Mieter sieht jederzeit, wo sein Schaden steht → weniger Rückfragen.
2. **Vordefinierte Dokumentkategorien** (etg24): wohnungswirtschaftliche Struktur statt loser Dateiablage.
3. **Vorgangstypen + Zuweisungslogik** (Casavi SmartTask): jede Anfrage wird ein Vorgang mit Typ, Priorität, Zuständigem.
4. **Digitale Aktenmappe je Vorgang** (etg24): Chronik mit Fotos, Notizen, Dokumenten.
5. **Schwarzes Brett / Aushänge je Objekt** (Casavi): ersetzt Papier-Aushang im Treppenhaus.
6. **Schlagwort-Automatisierung** (Casavi AI): Kategorie „Wasserschaden“ → automatische Benachrichtigung des richtigen Handwerkers (Ausbaustufe).
7. **Handwerker-Anbindung à la Relay** (Casavi): Auftrag → Ausführung → Doku → Rechnung digital (Ausbaustufe).
8. **Digitale Umlaufbeschlüsse/Versammlungen** (etg24): relevant für die WEG-Verwaltung (Ausbaustufe).

## 4. Funktionsumfang nach Ausbaustufen

### Stufe 1 — MVP
- Login (E-Mail + Passwort, Einladungs-Flow durch Verwalter), Rollen Mieter / Eigentümer / Verwalter
- Stammdaten: Objekte, Einheiten, Eigentümer, Mieter (zunächst manuell gepflegt)
- **Schadensmeldung**: Formular mit Kategorie, Beschreibung, Foto-Upload (mehrere Bilder), Standort im Objekt; Status-Workflow (Neu → In Bearbeitung → Beauftragt → Erledigt); Kommentar-Chronik
- **Nachrichten/Kontakt**: Anfragen an die Verwaltung mit Vorgangsbezug
- **Dokumente**: Upload durch Verwalter, kategorisiert, sichtbar je Rolle/Objekt/Einheit; Dokumentanforderung durch Mieter
- **Aushänge/News** je Objekt
- Verwalter-Dashboard: offene Vorgänge, Zuweisung, Filter

### Stufe 2 — Eigentümer-Mehrwert & Automatisierung
- Eigentümer-Statistiken (Vorgänge je Objekt, Kosten, Leerstand, Mieteinnahmen — Datenbasis je nach Immoware24-Sync)
- E-Mail-Benachrichtigungen & Eskalationen, Vorlagen, SLA-Erinnerungen
- **Immoware24-REST-API-Sync**: Objekte, Einheiten, Verträge, Kontakte automatisch abgleichen

### Stufe 3 — Ökosystem
- **Handwerker-Rolle**: direkte Beauftragung, Terminvorschläge, Ausführungs-Doku mit Fotos
- Umlaufbeschlüsse / digitale Eigentümerversammlung (WEG)
- Schlagwort-/KI-gestützte Vorgangs-Triage und Auto-Beauftragung
- Maklerservice-Modul (Interessenten, Exposé-Anfragen) & Modernisierungs-Projekte als eigene Vorgangstypen

## 5. Technische Eckpunkte (Vorschlag, abhängig von offenen Fragen)

- Web-App (responsive, mobile-first — Mieter nutzen primär das Smartphone), Deutsch
- Rollen-/Mandantenmodell: ein System, Inhalte strikt nach Rolle + Objekt-/Einheitsbezug gefiltert
- Datei-Storage für Fotos/Dokumente mit Zugriffsschutz
- DSGVO: Hosting in der EU, Auftragsverarbeitung, Löschkonzepte, Audit-Log
- Integration auf der Website: Login-Button auf bundwimmobilien.de verlinkt auf z. B. `portal.bundwimmobilien.de`

## 6. Offene Fragen (an B&W gestellt)

1. Tech-Stack-Präferenz oder freie Wahl?
2. Priorität für das MVP (Mieter-Schadensmeldung zuerst vs. alles parallel)?
3. Wo soll das System gehostet werden?
4. Besteht bereits ein Immoware24-Account mit API-Zugang?
