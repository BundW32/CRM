# B&W Kundenportal

Kundenportal/CRM der **B&W Immobilien Management UG** für Mieter, Eigentümer,
Verwaltung und Handwerker. Konzept, Wettbewerbsanalyse und Roadmap:
[`../docs/KONZEPT.md`](../docs/KONZEPT.md)

## Funktionsumfang

- **Login & Rollen**: Mieter, Eigentümer, Verwalter, Handwerker (Session-Cookie,
  bcrypt). Ersteinrichtung über `/setup`, solange noch kein Nutzer existiert.
- **Mieter**: Schäden melden mit Foto-Upload, Status verfolgen, Kommentare (auch
  mit Fotos), Dokumente einsehen und anfordern, Aushänge lesen
- **Eigentümer**: Vorgänge der eigenen Objekte, Anfragen stellen, **Statistiken**
  (Vermietungsquote, Vorgänge nach Status/Kategorie, Ø Bearbeitungszeit),
  Dokumente und Aushänge
- **Verwalter**: Vorgangsmanagement (Status, Priorität, Zuweisung an Verwalter
  oder Handwerker, interne Notizen), Dokumenten-Upload mit
  Zielgruppen-Sichtbarkeit, Aushänge, Objekte/Einheiten- und Nutzerverwaltung,
  Statistiken über alle Objekte
- **Handwerker**: sehen ausschließlich ihnen zugewiesene Aufträge, melden
  „Arbeit begonnen“/„Auftrag erledigt“ und dokumentieren die Ausführung mit Fotos
- **E-Mail-Benachrichtigungen** (sobald SMTP konfiguriert): neuer Vorgang an die
  Verwaltung, Statusänderung/Antwort an den Melder, Zuweisung an den Handwerker,
  Willkommens-Mail bei neuem Zugang. Ohne SMTP läuft alles ohne Versand weiter.
- **Konto**: eigenes Passwort ändern
- Dateien (Fotos, PDFs) werden ausschließlich über `/api/files/**` mit
  Berechtigungsprüfung ausgeliefert

## Tech-Stack

- [Next.js 16](https://nextjs.org) (App Router, Server Actions), TypeScript, Tailwind CSS
- PostgreSQL mit [Prisma 7](https://prisma.io) (`@prisma/adapter-pg`)
- Sessions: signierte JWT-Cookies (`jose`), Passwörter: `bcryptjs`
- Datei-Uploads: **Vercel Blob** (wenn `BLOB_READ_WRITE_TOKEN` gesetzt ist),
  sonst lokales Dateisystem (`UPLOAD_DIR`)
- E-Mail: `nodemailer` (optional per `SMTP_*`-Variablen)

## Deployment auf Vercel

1. Auf [vercel.com](https://vercel.com) → **Add New → Project** → Repo
   `BundW32/CRM` importieren
2. **Root Directory: `portal`** auswählen (wichtig!)
3. Unter **Storage** eine Datenbank anlegen (Neon/Postgres, Region Frankfurt
   `fra1`) → setzt `DATABASE_URL` automatisch. **Für die Ladezeiten wichtig:**
   die **gepoolte** Verbindung verwenden (Neon-Host mit `-pooler`) und die
   Datenbank in **derselben Region wie die Functions** (fra1) halten – die App
   pinnt die Functions per `vercel.json` (`"regions": ["fra1"]`) bereits auf
   Frankfurt, damit DB-Abfragen nicht über den Atlantik laufen.
4. Unter **Storage** einen **Blob**-Store anlegen und dabei **Access: Private**
   wählen (per CLI: `vercel blob create-store <name> --access private`) → setzt
   `BLOB_READ_WRITE_TOKEN` automatisch (nötig für Foto-/Dokument-Uploads).
   **Wichtig:** Die App speichert alle Uploads privat (`access: "private"`); ein
   *öffentlicher* Store weist private Uploads ab → Fotos/Dokumente lassen sich
   dann nicht hochladen.
5. Environment Variable **`SESSION_SECRET`** setzen (zufällig, mind. 32 Zeichen,
   z. B. aus `openssl rand -base64 48`)
6. Optional: `PORTAL_BASE_URL` (z. B. `https://portal.bundwimmobilien.de`) und
   `SMTP_*` für E-Mail-Versand — **alle** Schalter samt Erklärung stehen in
   [`.env.example`](./.env.example)
7. **KI-Assistent** (die Sprechblase unten rechts): erscheint nur, wenn
   `AI_ASSISTANT_ENABLED="true"` **und** `GEMINI_API_KEY` gesetzt sind. Fehlt
   einer der beiden, wird das Widget kommentarlos nicht gerendert — es gibt
   keine Fehlermeldung und keinen Hinweis. Sichtbar ist es zudem nur für
   Verwalter und Eigentümer, nicht für Mieter.
8. **Deploy** — die Datenbanktabellen werden beim Build automatisch angelegt
   (`prisma migrate deploy`, s. `vercel.json`)
9. Erste Anmeldung: Die App leitet automatisch zur **Ersteinrichtung** (`/setup`),
   dort den Verwalter-Zugang anlegen. Danach Objekte, Einheiten und Nutzer im
   Portal anlegen.
10. Später: Domain `portal.bundwimmobilien.de` im Vercel-Projekt hinzufügen und
    den Login-Button auf www.bundwimmobilien.de dorthin verlinken

## Lokale Entwicklung

```bash
npm install                 # installiert Abhängigkeiten, generiert Prisma-Client
cp .env.example .env        # DATABASE_URL + SESSION_SECRET eintragen
npx prisma migrate dev      # Datenbankschema anlegen
npm run db:seed             # Demo-Zugänge anlegen (nur für Entwicklung!)
npm run dev                 # http://localhost:3000
```

### Prüfungen mit Datenbank

`npm run pruefung` (Typen, ESLint, Vitest) läuft ohne Datenbank — bewusst, denn
es läuft auch im Vercel-Build. Die Prüfungen der Zugriffskontrolle und der
WEG-Ableitungen (`*.dbtest.ts`) brauchen dagegen eine echte Datenbank und
hängen an `npm run test:db`.

Wer keine zur Hand hat, startet in einer Minute eine eigene:

```bash
PGDATA=/var/lib/postgresql/testdata
initdb -D $PGDATA -U postgres --auth=trust -E UTF8      # als Nutzer „postgres"
pg_ctl -D $PGDATA -l /tmp/pg.log start
createdb -U postgres portal_test

export DATABASE_URL="postgresql://postgres@127.0.0.1:5432/portal_test"
npx prisma migrate deploy
npm run test:db
```

Die Binaries liegen unter `/usr/lib/postgresql/<version>/bin`, falls sie nicht
im `PATH` stehen. Der Harnisch (`src/test/harness.ts`) leert die Tabellen vor
jedem Lauf selbst — die Datenbank darf also getrost eine Wegwerf-Instanz sein.

Demo-Zugänge aus dem Seed (nicht in Produktion einspielen):

| Rolle      | E-Mail                     | Passwort          |
|------------|----------------------------|-------------------|
| Verwalter  | admin@bundwimmobilien.de   | BundW-Start2026!  |
| Eigentümer | eigentuemer@demo.de        | Demo-2026!        |
| Mieter     | mieter@demo.de             | Demo-2026!        |
| Handwerker | handwerker@demo.de         | Demo-2026!        |

### WEG-Selbstverwaltung testen (Finanz-Fundament)

Der Seed legt die Demo-WEG **„WEG Musterstraße 12“** an: 6 Einheiten mit
MEA/Fläche/Personen (MEA-Summe 1000/1000), Girokonto + getrennte
Erhaltungsrücklage mit Anfangsbeständen, Kostenarten aus dem
WEG-Standardkatalog und Beispielbuchungen inkl. einer Umbuchung in die
Rücklage.

Als Verwalter anmelden → **Verwaltung → WEG-Finanzen**:

- **Stammdaten**: Einheiten (MEA-Summenprüfung), Kostenarten & Umlageschlüssel
  (inkl. §35a-/BetrKV-Flags), Konten
- **Buchhaltung**: Kontensalden (Rücklage strikt getrennt), Buchung mit
  Beleg-Upload, Umbuchung Giro ↔ Rücklage, **CSV-Bankimport** (Sparkasse/
  Volksbank, Spalten-Mapping-Assistent, Duplikaterkennung) — komplett ohne
  externe API-Keys
- **Wirtschaftsplan** (§ 28 Abs. 1 WEG): Assistent mit Vorjahres-Istwerten,
  Einzelwirtschaftspläne je Einheit nach Umlageschlüsseln, Beschlussvorlage;
  der Beschluss erzeugt automatisch 12 monatliche Sollstellungen je Einheit
  (centgenau). Demo: beschlossener Plan 2026 („ETV 10.12.2025, TOP 3")
- **Hausgeld & offene Posten**: Rückstandsliste je Einheit (Soll/Ist/Saldo),
  Zahlungseingänge den Einheiten zuordnen (mit Vorschlag aus dem
  Verwendungszweck); **Mahnwesen** (Zahlungserinnerung → 1./2. Mahnung als
  DIN-A4-Brief mit Fensterumschlag-Adresse, „als versendet markieren",
  Eskalation nur über versendete Schreiben, keine automatischen Gebühren)
- **Sonderumlagen**: einmalige Umlage nach Schlüssel (MEA/Fläche/Einheiten/
  Personen) centgenau auf die Einheiten verteilt; erzeugt Sollstellungen, die
  in die offenen Posten und das Mahnwesen einfließen
- **Jahresabrechnung** (§ 28 Abs. 2 WEG): Gesamtabrechnung mit harter
  Kontenprüfung (Endbestand laut Kontoauszug muss aufgehen), Einzelabrechnungen
  je Einheit nach Umlageschlüsseln inkl. **manueller Heizkosten-Verteilung**,
  **Abrechnungsspitze** (Nachschuss/Guthaben), **§35a-Ausweis** je Einheit,
  **Vermögensbericht** (§ 28 Abs. 4 WEG) und **tagesgenaue Aufteilung bei
  Eigentümerwechsel**. Fertigstellen friert das Ergebnis revisionssicher ein.
  Eigentümer je Einheit (mit Stichtag) werden in den Stammdaten gepflegt.
- **Prüfpflichten-Katalog**: vorkonfigurierte wiederkehrende Prüf- und
  Verwaltungspflichten (Trinkwasser/Legionellen, Rauchwarnmelder, Aufzug,
  Heizungscheck, Verkehrssicherung/Winterdienst, Versicherungen,
  Jahresabrechnung, Versammlung) — per Knopfdruck je Objekt übernehmbar,
  Fälligkeit je Pflicht editierbar. Fällige/überfällige Pflichten erscheinen im
  Dashboard; optionale E-Mail-Erinnerung über den Mail-Adapter (Fallback: nur
  Dashboard, ohne API-Key). Nutzt das bestehende Wartungsmodell.
- **Einladungs-Assistent für Eigentümerversammlungen**: **Fristenrechner**
  (mind. 3 Wochen Ladefrist nach § 24 Abs. 4 WEG, warnt bei Unterschreitung mit
  spätestem Versanddatum), **TOP-Vorlagenkatalog** mit fertigen
  Beschlussvorschlägen (Wirtschaftsplan, Jahresabrechnung, Verwalterbestellung,
  Erhaltungsmaßnahme, Sonderumlage …), **Einladung als DIN-A4-PDF**
  (fensterumschlag-tauglich, „an alle" oder je Empfänger), Versand per
  E-Mail-Adapter **oder** Selbstdruck + „als versendet markieren" (setzt das
  Versanddatum, ohne API-Key). Optionaler Freitext-Link zur Video-Zuschaltung
  (nur Abdruck im PDF — kein Streaming/keine Live-Abstimmung)
- **Erhaltungsplanung** (§ 19 Abs. 2 Nr. 2 WEG): langfristige Maßnahmenliste je
  Objekt (Titel, Gewerk, Zieljahr, Kostenschätzung); leitet daraus den
  Rücklagenbedarf her und stellt ihn dem **aktuellen Rücklagenstand aus der
  Buchhaltung** gegenüber (Deckung/Unterdeckung). Jahresprognose inkl. der
  beschlossenen jährlichen Zuführung markiert das erste Jahr einer Unterdeckung
- **Wirtschaftsplan-PDF für Eigentümer**: jeder Eigentümer lädt den beschlossenen
  Wirtschaftsplan (Gesamtplan + Einzelwirtschaftspläne) als PDF auf `/finanzen`
- **Verbrauchsinformation** (§ 6a HeizkostenV): unterjährige Verbrauchsinfo im
  Portal aus den Zählerständen — jüngste Verbrauchsperiode je Zähler mit Vergleich
  zu Vorperiode und Vorjahr; fernablesbare Zähler (monatliche Pflicht) sind
  gekennzeichnet
- **Integrationen** (Adapter-Prinzip): Admin-Seite für optionale API-Zugänge
  (Open Banking, Messdienst). Ohne Schlüssel zeigt die UI automatisch den manuellen
  Weg — die App bleibt zu 100 % ohne externen Key nutzbar. Schlüssel werden
  verschlüsselt gespeichert (AES-256-GCM)
- **SEPA-Lastschrift** (Hausgeldeinzug, Zero-Key): Mandatsverwaltung je Einheit +
  Gläubiger-ID; erzeugt eine **pain.008-XML-Datei** zum Selbst-Upload ins
  Online-Banking (kein externer Zugang). Eingezogen wird der offene Hausgeld-Betrag
  je Einheit mit aktivem Mandat
- **CO₂-Kostenaufteilung** (CO2KostAufG, Zero-Key): teilt den CO₂-Preis der
  Heizkosten nach dem 10-Stufen-Modell (Wohngebäude) zwischen Vermieter und Mieter
  auf — je höher der Ausstoß (kg CO₂/m²·a), desto größer der Vermieteranteil.
  Centgenaue Aufteilung je Einheit nach Wohnfläche als Datenbasis für vermietende
  Eigentümer
- **Betriebskostenabrechnung für vermietete Einheiten** (Vermieter-Zusatzmodul):
  leitet aus der WEG-Jahresabrechnung die auf den Mieter umlagefähigen Kosten ab
  (Trennung nach BetrKV), zieht den Vermieter-CO₂-Anteil ab, verrechnet die
  Vorauszahlungen und weist Nachzahlung/Guthaben aus — als DIN-A4-PDF für den Mieter
- **Handwerker-Netzwerk – digitale Rechnung**: der Handwerker reicht über den
  Magic-Link seine Rechnung (Betrag + PDF/Bild) ein, der Verwalter prüft und
  akzeptiert sie — dann werden die Kosten am Vorgang übernommen. Schließt den
  digitalen Auftrags-Durchlauf (Auftrag → Ausführung → Doku → Rechnung) ab
- **Messdienst-Datei-Import** (Heizkosten): CSV-Abrechnung von ista/Techem/Minol/
  Brunata einlesen; die Beträge werden den Einheiten (über Bezeichnung oder Nummer)
  zugeordnet und fließen in die Jahresabrechnung. Anbieter-unabhängig, ohne
  API-Zugang; nicht Zuordenbares wird gemeldet
- **Hybride Versammlung** (§ 23 Abs. 1a WEG, ohne eigenes Video): Video-Zuschaltung
  über einen externen Dienst (z. B. Jitsi/Zoom); **Standard-Videolink je Objekt**
  wird bei neuen Versammlungen vorbelegt, Remote-Eigentümer stimmen im Portal ab.
  Das Protokoll dokumentiert die hybride Teilnahmemöglichkeit samt Link

Entscheidungen und Begründungen: [`DECISIONS.md`](./DECISIONS.md)

## Nächste Ausbaustufen

- **Immoware24-Sync**: vorbereitet in `src/lib/immoware24.ts` +
  `Property.immoware24Id`; wartet auf den API-Zugang von Immoware24
- **WEG-Selbstverwaltung (weiter)**: Einladungs-Assistent mit Fristenrechner &
  Einladungs-PDF, Erhaltungsplanung, Wirtschaftsplan-PDF für Eigentümer,
  Verbrauchsinfo, Messdienst-Import (ista/Techem), SEPA-pain.008-Export,
  Open-Banking-Adapter, Vermieter-Zusatzmodul
- Passwort-Reset per E-Mail, Mehr-Faktor-Login
- Schlagwort-Automatisierung (Kategorie → automatische Handwerker-Beauftragung)
- Maklerservice-Modul (Interessenten, Exposé-Anfragen), Modernisierungs-Projekte

Details: [`../docs/KONZEPT.md`](../docs/KONZEPT.md)
