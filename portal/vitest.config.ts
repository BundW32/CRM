import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Node-Unit-Tests (reine Funktionen, PDF-Helfer) — und Serverrendern von
// Komponenten. Kein jsdom: Das Fehlen von `window` ist hier kein Mangel, sondern
// genau der Zustand, den ein Server vorfindet. Ein Test, der `window` bekommt,
// hätte den 500er der Tour nicht gefunden.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
  },
});
