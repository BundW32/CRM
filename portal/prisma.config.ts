// Konfiguration der Prisma-CLI (migrate deploy, db execute, generate).
//
// WICHTIG: Diese URL nutzt NUR die CLI — die laufende Anwendung verbindet sich
// über src/lib/db.ts (adapter-pg) weiterhin mit DATABASE_URL. Deshalb darf und
// soll die CLI hier die UNGEPOOLTE Neon-Verbindung bevorzugen:
//
// Migrationen setzen eine Postgres-Advisory-Lock (pg_advisory_lock). Läuft das
// über den Neon-Pooler (Host mit "-pooler"), klebt die Sperre an einer
// langlebigen Pooler-Session — bricht ein Build ab, bleibt sie hängen, und
// jeder folgende Deploy scheitert mit P1002 („Timed out trying to acquire a
// postgres advisory lock"). Genau das ist zweimal passiert (11.08. und
// 24.08.2026). Die direkte Verbindung stirbt mit dem Build-Container, die
// Sperre wird frei. Neon stellt die ungepoolte URL als DATABASE_URL_UNPOOLED
// (Vercel-Integration) bzw. POSTGRES_URL_NON_POOLING bereit; ohne beide fällt
// alles wie bisher auf DATABASE_URL zurück.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url:
      process.env["DATABASE_URL_UNPOOLED"] ||
      process.env["POSTGRES_URL_NON_POOLING"] ||
      process.env["DATABASE_URL"],
  },
});
