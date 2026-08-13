// Datei-Ablage: Vercel Blob (wenn ein Zugang zum Store besteht) oder
// Base64-Data-URL in der Datenbank (Fallback für Preview-Deployments / lokale
// Entwicklung ohne Blob). Lokale UUID-Dateinamen (Altdaten) werden weiterhin
// aus dem Dateisystem gelesen.
import crypto from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { del, get, put } from "@vercel/blob";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
// Ohne Blob werden Dateien als Data-URL in der DB gespeichert – Limit: 5 MB
const DATA_URL_MAX_SIZE = 5 * 1024 * 1024;

export const IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg", // browser alias for JPEG
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export const VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime", // iPhone .mov
  "video/webm",
  "video/x-msvideo", // .avi
];

export const MEDIA_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES];

export const DOCUMENT_TYPES = [...IMAGE_TYPES, "application/pdf"];

/**
 * Auf welchem Weg das Portal an den Blob-Store kommt.
 *
 * Zwei Wege führen dorthin, und beide genügen dem SDK (@vercel/blob 2.4,
 * `resolveBlobCredentials`): ein statisches `BLOB_READ_WRITE_TOKEN` — oder
 * **OIDC**, wo Vercel je Anfrage ein kurzlebiges Token stellt und der Store
 * über `BLOB_STORE_ID` benannt wird. `put`, `get` und `del` können beides.
 *
 * Nur auf das Token zu prüfen war der eigentliche Produktionsfehler: Ein über
 * „Connect Project" verbundener Store setzt heute **kein** statisches Token
 * mehr, sondern `BLOB_STORE_ID` — Vercel rät im Dashboard sogar ausdrücklich,
 * das Token zu widerrufen. Der Store war also fertig eingerichtet, privat und
 * mit beiden Projekten verbunden; das Portal fragte nur nach dem einen Weg,
 * den diese Verbindung nicht geht, und rief das SDK deshalb gar nicht erst
 * auf. Jeder Upload lief in den Data-URL-Zweig und dort in den harten Abbruch.
 *
 * Die Zusatzbedingung beim OIDC-Weg ist kein Zierrat: Das kurzlebige Token
 * stellt **Vercel** je Anfrage. `vercel env pull` holt `BLOB_STORE_ID` aber mit
 * auf den Entwicklerrechner. Ohne die Bedingung hielte ein schlichtes
 * `next dev` den Produktions-Store für erreichbar, ließe den
 * Dateisystem-Fallback fallen — und bräche bei jedem Upload ab, sobald das
 * mitgezogene OIDC-Token abgelaufen ist. `vercel dev` setzt `VERCEL`, ein
 * frisch gezogenes Token setzt `VERCEL_OIDC_TOKEN`; beides ist eine bewusste
 * Entscheidung für den echten Store.
 */
export function ablageZugang(): "oidc" | "token" | "keiner" {
  const oidcMoeglich = Boolean(process.env.VERCEL || process.env.VERCEL_OIDC_TOKEN);
  if (process.env.BLOB_STORE_ID && oidcMoeglich) return "oidc";
  if (process.env.BLOB_READ_WRITE_TOKEN) return "token";
  return "keiner";
}

function blobEnabled() {
  return ablageZugang() !== "keiner";
}

// Legt einen Upload privat im Vercel-Blob-Store ab. Private Uploads funktionieren
// NUR mit einem als „Private" angelegten Blob-Store – ein öffentlicher Store weist
// `access: "private"` ab. Diese Fehlermeldung macht die Fehlkonfiguration sichtbar,
// statt dass der Upload stillschweigend scheitert (früher: „Fotos gehen gar nicht").
async function putPrivate(pathname: string, body: File | Buffer, contentType: string) {
  try {
    return await put(pathname, body, { access: "private", contentType });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      "Datei konnte nicht gespeichert werden. Der Vercel-Blob-Store muss als " +
        "PRIVAT angelegt sein (Dashboard → Storage → Blob → Access: Private, oder " +
        "`vercel blob create-store --access private`). Details: " +
        message,
    );
  }
}

function uploadDir() {
  return path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "./uploads");
}

// Der Data-URL-Fallback (Datei als Base64 in der Datenbank) ist für Previews
// gedacht. In PRODUKTION ist er ein schleichender Datenbank-Aufbläher: Jeder
// Beleg, jedes Foto landete für immer als Base64-Spalte in Postgres, und
// niemand merkte es — die Uploads „funktionieren" ja. Deshalb bricht Produktion
// ohne Blob-Store hart ab, statt still in die Datenbank auszuweichen.
function assertDataUrlFallbackAllowed() {
  if (process.env.VERCEL_ENV === "production") {
    throw new Error(
      "Dateien können nicht gespeichert werden: In Produktion muss Vercel Blob " +
        "konfiguriert sein — entweder BLOB_READ_WRITE_TOKEN oder ein per OIDC " +
        "verbundener Store (BLOB_STORE_ID). Der Data-URL-Fallback in die " +
        "Datenbank ist Preview-Umgebungen vorbehalten."
    );
  }
}

export async function saveUpload(file: File, allowedTypes: string[]) {
  if (file.size === 0) throw new Error("Die Datei ist leer.");
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Die Datei ist größer als 100 MB.");
  }
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Dateityp ${file.type || "unbekannt"} ist nicht erlaubt.`);
  }
  const ext = path
    .extname(file.name)
    .toLowerCase()
    .replace(/[^.a-z0-9]/g, "")
    .slice(0, 10);
  const fileId = crypto.randomUUID() + ext;
  const meta = { fileName: file.name, mimeType: file.type, size: file.size };

  if (blobEnabled()) {
    const blob = await putPrivate(`uploads/${fileId}`, file, file.type);
    return { storedName: blob.url, ...meta };
  }

  if (process.env.VERCEL) {
    assertDataUrlFallbackAllowed();
    // Vercel ohne Blob: als Data-URL in der DB ablegen (max. 5 MB)
    if (file.size > DATA_URL_MAX_SIZE) {
      throw new Error(
        "Für Dateien über 5 MB muss Vercel Blob konfiguriert sein " +
          "(BLOB_READ_WRITE_TOKEN oder ein per OIDC verbundener Store)."
      );
    }
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    return { storedName: `data:${file.type};base64,${base64}`, ...meta };
  }

  // Lokale Entwicklung: Dateisystem
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(
    path.join(uploadDir(), fileId),
    Buffer.from(await file.arrayBuffer())
  );
  return { storedName: fileId, ...meta };
}

// Speichert direkt aus einem Buffer (z. B. generierte PDFs, E-Mail-Anhänge).
export async function saveBuffer(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  allowedTypes: string[]
) {
  const size = buffer.byteLength;
  if (size === 0) throw new Error("Die Datei ist leer.");
  if (size > MAX_FILE_SIZE) throw new Error("Die Datei ist größer als 100 MB.");
  if (!allowedTypes.includes(mimeType)) {
    throw new Error(`Dateityp ${mimeType || "unbekannt"} ist nicht erlaubt.`);
  }
  const ext = path
    .extname(fileName)
    .toLowerCase()
    .replace(/[^.a-z0-9]/g, "")
    .slice(0, 10);
  const fileId = crypto.randomUUID() + ext;
  const meta = { fileName, mimeType, size };

  if (blobEnabled()) {
    const blob = await putPrivate(`uploads/${fileId}`, buffer, mimeType);
    return { storedName: blob.url, ...meta };
  }

  if (process.env.VERCEL) {
    assertDataUrlFallbackAllowed();
    // Vercel ohne Blob: als Data-URL in der DB ablegen (max. 5 MB)
    if (size > DATA_URL_MAX_SIZE) {
      throw new Error(
        "Für Dateien über 5 MB muss Vercel Blob konfiguriert sein " +
          "(BLOB_READ_WRITE_TOKEN oder ein per OIDC verbundener Store)."
      );
    }
    const base64 = buffer.toString("base64");
    return { storedName: `data:${mimeType};base64,${base64}`, ...meta };
  }

  // Lokale Entwicklung: Dateisystem
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), fileId), buffer);
  return { storedName: fileId, ...meta };
}

/**
 * Ist das eine URL unseres Blob-Speichers?
 *
 * Muss vor JEDEM Abruf geprüft werden, der ein Zugriffs-Token mitschickt.
 * `storedName` kommt aus der Datenbank; gelangte dort je eine fremde URL hinein
 * (Import, Migration, Manipulation), ginge das Token — Lese- UND Schreibrecht
 * auf sämtliche Kundendateien aller Mandanten — an einen beliebigen fremden
 * Server. Deshalb liegt die Prüfung hier und nicht als Kopie an jeder
 * Abrufstelle: Die zweite Abrufstelle (Teilbereichsanfragen in
 * api/files/[kind]/[id]) hatte sie genau darum lange nicht.
 */
export function isBlobUrl(storedName: string): boolean {
  if (!storedName.startsWith("https://")) return false;
  let host: string;
  try {
    host = new URL(storedName).hostname;
  } catch {
    return false;
  }
  return host === "blob.vercel-storage.com" || host.endsWith(".blob.vercel-storage.com");
}

export async function readUpload(storedName: string): Promise<Buffer> {
  // Data-URL (in DB gespeicherter Fallback)
  if (storedName.startsWith("data:")) {
    const commaIdx = storedName.indexOf(",");
    if (commaIdx === -1) throw new Error("Ungültiger Data-URL.");
    return Buffer.from(storedName.slice(commaIdx + 1), "base64");
  }
  // Vercel Blob (https://) – private Blobs offiziell über das SDK abrufen.
  // `get()` wählt die Zugangsart selbst: OIDC (kurzlebiges Token je Anfrage,
  // Store über BLOB_STORE_ID) oder BLOB_READ_WRITE_TOKEN. Genau deshalb ist
  // das SDK hier der richtige Weg und nicht ein eigener `fetch` mit
  // Bearer-Header — der kennt nur den zweiten Weg.
  if (storedName.startsWith("https://")) {
    // Zugriff NUR auf Vercel-Blob-Hosts. Sollte je eine fremde URL in storedName
    // gelangen (Import/DB-Manipulation), würde das Zugriffs-Token sonst an einen
    // beliebigen Host geleakt (SSRF + Credential-Exfiltration).
    if (!isBlobUrl(storedName)) throw new Error("Nicht erlaubter Speicher-Host.");
    const result = await get(storedName, { access: "private" });
    if (!result || result.statusCode !== 200) throw new Error("Datei nicht abrufbar.");
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }
  // Legacy-Dateiname (lokale Entwicklung / Altdaten)
  if (!/^[a-f0-9-]+(\.[a-z0-9]+)?$/.test(storedName)) {
    throw new Error("Ungültiger Dateiname.");
  }
  return readFile(path.join(uploadDir(), storedName));
}

// Löscht eine gespeicherte Datei (z. B. bei DSGVO-Anonymisierung).
// Data-URLs liegen in der DB und brauchen keinen separaten Löschaufruf.
// Lokale Entwicklungsdateien werden bewusst nicht gelöscht.
export async function deleteBlob(storedName: string): Promise<void> {
  if (!storedName || !storedName.startsWith("https://")) return;
  if (!blobEnabled()) return;
  try {
    await del(storedName);
  } catch {
    // Blob bereits gelöscht oder nicht gefunden – kein Fehler
  }
}
