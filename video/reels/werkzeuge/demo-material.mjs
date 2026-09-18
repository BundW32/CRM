/**
 * Legt die Bilder für die Composition `Bildaufbau` bereit.
 *
 *   node werkzeuge/demo-material.mjs
 *
 * Nur zur Abstimmung des Bildaufbaus: ein unscharfer Hintergrund und ein
 * Platzhalter für den Sprecher. Beides kommt aus den Marketing-Bildern des
 * Portals und liegt bewusst NICHT im Repo (siehe .gitignore).
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const hier = dirname(fileURLToPath(import.meta.url));
const ziel = join(hier, "..", "public", "demo");
const quelle = join(hier, "..", "..", "..", "portal", "public", "images", "marketing");

mkdirSync(ziel, { recursive: true });
copyFileSync(join(quelle, "hero-building.jpg"), join(ziel, "hintergrund.jpg"));
copyFileSync(join(quelle, "versammlung.jpg"), join(ziel, "sprecher.jpg"));
console.log(`Demo-Material → ${ziel}`);
