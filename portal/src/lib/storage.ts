// Datei-Ablage: Vercel Blob (wenn BLOB_READ_WRITE_TOKEN gesetzt ist) oder
// Base64-Data-URL in der Datenbank (Fallback für Preview-Deployments / lokale
// Entwicklung ohne Blob). Lokale UUID-Dateinamen (Altdaten) werden weiterhin
// aus dem Dateisystem gelesen.
import crypto from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { put } from "@vercel/blob";

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

function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function uploadDir() {
  return path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "./uploads");
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
    const blob = await put(`uploads/${fileId}`, file, {
      access: "public",
      contentType: file.type,
    });
    return { storedName: blob.url, ...meta };
  }

  if (process.env.VERCEL) {
    // Vercel ohne Blob: als Data-URL in der DB ablegen (max. 5 MB)
    if (file.size > DATA_URL_MAX_SIZE) {
      throw new Error(
        `Für Dateien über 5 MB muss Vercel Blob konfiguriert sein (BLOB_READ_WRITE_TOKEN).`
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
    const blob = await put(`uploads/${fileId}`, buffer, {
      access: "public",
      contentType: mimeType,
    });
    return { storedName: blob.url, ...meta };
  }

  if (process.env.VERCEL) {
    // Vercel ohne Blob: als Data-URL in der DB ablegen (max. 5 MB)
    if (size > DATA_URL_MAX_SIZE) {
      throw new Error(
        `Für Dateien über 5 MB muss Vercel Blob konfiguriert sein (BLOB_READ_WRITE_TOKEN).`
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

export async function readUpload(storedName: string): Promise<Buffer> {
  // Data-URL (in DB gespeicherter Fallback)
  if (storedName.startsWith("data:")) {
    const commaIdx = storedName.indexOf(",");
    if (commaIdx === -1) throw new Error("Ungültiger Data-URL.");
    return Buffer.from(storedName.slice(commaIdx + 1), "base64");
  }
  // Vercel Blob (https://)
  if (storedName.startsWith("https://")) {
    const res = await fetch(storedName);
    if (!res.ok) throw new Error("Datei nicht abrufbar.");
    return Buffer.from(await res.arrayBuffer());
  }
  // Legacy-Dateiname (lokale Entwicklung / Altdaten)
  if (!/^[a-f0-9-]+(\.[a-z0-9]+)?$/.test(storedName)) {
    throw new Error("Ungültiger Dateiname.");
  }
  return readFile(path.join(uploadDir(), storedName));
}
