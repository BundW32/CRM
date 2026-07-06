// Setzt das Plattform-Betreiber-Flag (isPlatformAdmin) für ein B&W-Betreiberkonto.
//
// Der Zugang zu /plattform ist doppelt abgesichert und BEIDE Bedingungen müssen gelten:
//   1) User.isPlatformAdmin = true   (setzt dieses Skript)
//   2) die E-Mail steht in der Server-Env PLATFORM_ADMIN_EMAILS (kommagetrennt)
// Dieses Skript erledigt nur (1). Trage die E-Mail zusätzlich in PLATFORM_ADMIN_EMAILS
// ein (z. B. bei Vercel unter Project → Settings → Environment Variables) und deploye neu.
//
// Aufruf:
//   npm run db:platform-admin                       -> admin@bundwimmobilien.de
//   npm run db:platform-admin -- info@bundwimmobilien.de
//
// Das Konto muss bereits existieren (z. B. aus dem Seed oder regulär angelegt).
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const email = (process.argv[2] ?? "admin@bundwimmobilien.de").trim().toLowerCase();

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, isPlatformAdmin: true },
  });

  if (!user) {
    console.error(
      `✖ Kein Nutzer mit E-Mail "${email}" gefunden.\n` +
        `  Lege zuerst das B&W-Betreiberkonto an (z. B. via "npm run db:seed") und führe das Skript erneut aus.`,
    );
    process.exitCode = 1;
    return;
  }

  if (user.isPlatformAdmin) {
    console.log(`✓ "${email}" ist bereits Plattform-Admin (isPlatformAdmin = true).`);
  } else {
    await db.user.update({ where: { id: user.id }, data: { isPlatformAdmin: true } });
    console.log(`✓ Plattform-Admin gesetzt für "${email}" (${user.name}).`);
  }

  console.log(
    `\nNächster Schritt: Trage "${email}" in die Env-Variable PLATFORM_ADMIN_EMAILS ein\n` +
      `(kommagetrennt für mehrere) und deploye neu. Erst dann ist /plattform aktiv.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
