import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import {
  oberflaecheRegeln,
  oberflaecheBaustein,
  oberflaecheBestand,
} from "./eslint.oberflaeche.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Absichtlich ungenutzte, mit "_" prefixte Bezeichner (z. B. Interface-
    // Parameter wie `_config`) nicht als ungenutzt melden – gängige Konvention.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Oberflächen-Regeln (Bausteine benutzen statt nachbauen) und die
  // Ausnahmeliste für den Bestand – beides in eslint.oberflaeche.mjs erklärt.
  oberflaecheRegeln,
  oberflaecheBaustein,
  oberflaecheBestand,
]);

export default eslintConfig;
