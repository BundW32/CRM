import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Reine Node-Unit-Tests (pure functions, PDF-Helfer). Kein jsdom nötig.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
