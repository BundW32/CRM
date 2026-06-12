# B&W Kundenportal

Kundenportal/CRM der **B&W Immobilien Management UG** für Mieter, Eigentümer und
Verwaltung. Konzept, Wettbewerbsanalyse und Roadmap: [`../docs/KONZEPT.md`](../docs/KONZEPT.md)

## Funktionsumfang (MVP / Ausbaustufe 1)

- **Login** mit Rollen Mieter, Eigentümer, Verwalter (Session-Cookie, bcrypt)
- **Mieter**: Schäden melden mit Foto-Upload, Vorgangsstatus verfolgen,
  Kommentar-Verlauf, Dokumente einsehen und anfordern, Aushänge lesen
- **Eigentümer**: Vorgänge der eigenen Objekte einsehen, Anfragen stellen,
  Dokumente und Aushänge der eigenen Objekte
- **Verwalter**: Vorgangsmanagement (Status, Priorität, Zuweisung, interne
  Notizen), Dokumente hochladen (Zielgruppen-Sichtbarkeit), Aushänge
  veröffentlichen, Objekte/Einheiten und Nutzer verwalten
- Dateien (Fotos, PDFs) werden nur mit gültiger Berechtigung ausgeliefert
  (`/api/files/...`)

## Tech-Stack

- [Next.js 16](https://nextjs.org) (App Router, Server Actions), TypeScript, Tailwind CSS
- PostgreSQL mit [Prisma 7](https://prisma.io) (`@prisma/adapter-pg`)
- Sessions: signierte JWT-Cookies (`jose`), Passwörter: `bcryptjs`
- Datei-Uploads: lokales Dateisystem (`UPLOAD_DIR`) — für Vercel-Produktivbetrieb
  durch Blob-Storage ersetzen (nur `src/lib/storage.ts` anpassen)

## Lokale Entwicklung

```bash
npm install                 # installiert Abhängigkeiten, generiert Prisma-Client
cp .env.example .env        # DATABASE_URL + SESSION_SECRET eintragen
npx prisma migrate dev      # Datenbankschema anlegen
npm run db:seed             # Verwalter- und Demo-Zugänge anlegen
npm run dev                 # http://localhost:3000
```

Seed-Zugänge (Passwörter nach dem ersten Login ändern bzw. Demo-Nutzer löschen):

| Rolle      | E-Mail                     | Passwort          |
|------------|----------------------------|-------------------|
| Verwalter  | admin@bundwimmobilien.de   | BundW-Start2026!  |
| Eigentümer | eigentuemer@demo.de        | Demo-2026!        |
| Mieter     | mieter@demo.de             | Demo-2026!        |

## Deployment (Vercel, geplant)

1. PostgreSQL in EU-Region anlegen (z. B. Neon/Vercel Postgres) → `DATABASE_URL`
2. `SESSION_SECRET` setzen (zufällig, mind. 32 Zeichen)
3. Blob-Storage für Uploads anbinden (Vercel Blob) — `src/lib/storage.ts`
4. Domain `portal.bundwimmobilien.de` aufschalten und den Login-Button auf
   www.bundwimmobilien.de dorthin verlinken

## Nächste Ausbaustufen

- **Stufe 2**: E-Mail-Benachrichtigungen, Eigentümer-Statistiken,
  Immoware24-REST-API-Sync (Feld `Property.immoware24Id` ist vorbereitet),
  Passwort-Reset / Einladungs-E-Mails
- **Stufe 3**: Handwerker-Rolle (Beauftragung, Ausführungs-Doku), digitale
  Umlaufbeschlüsse (WEG), Schlagwort-Automatisierung, Maklerservice-Modul

Details: [`../docs/KONZEPT.md`](../docs/KONZEPT.md)
