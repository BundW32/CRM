"use client";

import dynamic from "next/dynamic";

// Eigene Datei, weil dynamisches Nachladen von Client-Komponenten aus einer
// SERVER-Komponente heraus (page.tsx) in dieser Next.js-Version kein echtes
// Code-Splitting auslöst — siehe node_modules/next/dist/docs/01-app/02-guides/
// lazy-loading.md: „When a Server Component dynamically imports a Client
// Component, automatic code splitting is currently not supported." Der Umweg
// über diese Client-Datei sorgt dafür, dass das SSR-Markup unverändert
// bleibt (kein `ssr: false`, keine fehlende Inhalte für Suchmaschinen/ohne
// JS), aber das Hydrations-Skript von `scrolly-build.tsx` als eigener,
// separat ladender Chunk ausgeliefert wird statt im Haupt-Bundle der
// Startseite zu stecken.
export const ScrollyBuild = dynamic(() =>
  import("./scrolly-build").then((m) => m.ScrollyBuild),
);
