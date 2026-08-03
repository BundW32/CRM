import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Prüfungen gegen eine echte Datenbank (`*.dbtest.ts`).
//
// Getrennt von `vitest.config.ts`, weil `npm run pruefung` auch im Vercel-Build
// läuft und dort keine Datenbank erreichbar ist. Wer diese Prüfungen in die
// normale Reihe hängt, bricht damit den Produktions-Deploy.
//
// Start: `npm run test:db` mit gesetzter DATABASE_URL.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.dbtest.ts"],
    environment: "node",
    // Die Tests teilen sich eine Datenbank und leeren sie zwischen den Läufen.
    // Parallel liefen sie sich gegenseitig die Tabellen leer.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
