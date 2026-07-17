# B&W Kundenportal

Kundenportal/CRM der **B&W Immobilien Management UG** für Mieter, Eigentümer,
Verwaltung und Handwerker. Konzept, Wettbewerbsanalyse und Roadmap:
[`../docs/KONZEPT.md`](../docs/KONZEPT.md)

## Funktionsumfang

- **Öffentliche Startseite & Marketing-Unterseiten** (`/`,
  `/funktionen/finanzen`, `/funktionen/hausgeld`, `/funktionen/versammlung`,
  `/funktionen/kommunikation`, `/so-funktionierts`): erklären das Problem
  (kleine WEGs finden keinen Verwalter) und das Portal als Lösung zur
  Selbstverwaltung – mit animierten UI-Illustrationen (reines CSS,
  Scroll-Reveals per IntersectionObserver, `prefers-reduced-motion` wird
  respektiert), Rechtsrahmen-Abschnitt und FAQ. Nur auf der Hauptdomain –
  Mandanten-Subdomains leiten weiterhin direkt zum gebrandeten Login.
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
   `fra1`) → setzt `DATABASE_URL` automatisch
4. Unter **Storage** einen **Blob**-Store anlegen → setzt
   `BLOB_READ_WRITE_TOKEN` automatisch (nötig für Foto-/Dokument-Uploads)
5. Environment Variable **`SESSION_SECRET`** setzen (zufällig, mind. 32 Zeichen,
   z. B. aus `openssl rand -base64 48`)
6. Optional: `PORTAL_BASE_URL` (z. B. `https://portal.bundwimmobilien.de`) und
   `SMTP_*` für E-Mail-Versand (siehe `.env.example`)
7. **Deploy** — die Datenbanktabellen werden beim Build automatisch angelegt
   (`prisma migrate deploy`, s. `vercel.json`)
8. Erste Anmeldung: Die App leitet automatisch zur **Ersteinrichtung** (`/setup`),
   dort den Verwalter-Zugang anlegen. Danach Objekte, Einheiten und Nutzer im
   Portal anlegen.
9. Später: Domain `portal.bundwimmobilien.de` im Vercel-Projekt hinzufügen und
   den Login-Button auf www.bundwimmobilien.de dorthin verlinken

## Lokale Entwicklung

```bash
npm install                 # installiert Abhängigkeiten, generiert Prisma-Client
cp .env.example .env        # DATABASE_URL + SESSION_SECRET eintragen
npx prisma migrate dev      # Datenbankschema anlegen
npm run db:seed             # Demo-Zugänge anlegen (nur für Entwicklung!)
npm run dev                 # http://localhost:3000
```

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
- **Jahresabrechnung** (§ 28 Abs. 2 WEG): Gesamtabrechnung mit harter
  Kontenprüfung (Endbestand laut Kontoauszug muss aufgehen), Einzelabrechnungen
  je Einheit nach Umlageschlüsseln inkl. **manueller Heizkosten-Verteilung**,
  **Abrechnungsspitze** (Nachschuss/Guthaben), **§35a-Ausweis** je Einheit,
  **Vermögensbericht** (§ 28 Abs. 4 WEG) und **tagesgenaue Aufteilung bei
  Eigentümerwechsel**. Fertigstellen friert das Ergebnis revisionssicher ein.
  Eigentümer je Einheit (mit Stichtag) werden in den Stammdaten gepflegt.

Entscheidungen und Begründungen: [`DECISIONS.md`](./DECISIONS.md)

## Nächste Ausbaustufen

- **Immoware24-Sync**: vorbereitet in `src/lib/immoware24.ts` +
  `Property.immoware24Id`; wartet auf den API-Zugang von Immoware24
- **WEG-Finanzen Stufe 5**: Sonderumlagen, Einladungs-PDF mit Fristenrechner,
  Prüfpflichten-Katalog, Messdienst-Import (ista/Techem), SEPA-pain.008-Export,
  Open-Banking-Adapter
- Passwort-Reset per E-Mail, Mehr-Faktor-Login
- Schlagwort-Automatisierung (Kategorie → automatische Handwerker-Beauftragung)
- Maklerservice-Modul (Interessenten, Exposé-Anfragen), Modernisierungs-Projekte

Details: [`../docs/KONZEPT.md`](../docs/KONZEPT.md)
