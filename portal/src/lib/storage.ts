// Datei-Ablage auf dem lokalen Dateisystem.
// Für den Produktivbetrieb auf Vercel muss dieses Modul durch Blob-Storage
// (z. B. Vercel Blob oder S3) ersetzt werden — die Aufrufer bleiben gleich.
import crypto from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export const DOCUMENT_TYPES = [...IMAGE_TYPES, "application/pdf"];

function uploadDir() {
  return path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "./uploads");
}

export async function saveUpload(file: File, allowedTypes: string[]) {
  if (file.size === 0) throw new Error("Die Datei ist leer.");
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Die Datei ist größer als 10 MB.");
  }
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Dateityp ${file.type || "unbekannt"} ist nicht erlaubt.`);
  }
  const ext = path
    .extname(file.name)
    .toLowerCase()
    .replace(/[^.a-z0-9]/g, "")
    .slice(0, 10);
  const storedName = crypto.randomUUID() + ext;
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(
    path.join(uploadDir(), storedName),
    Buffer.from(await file.arrayBuffer())
  );
  return {
    storedName,
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
  };
}

export async function readUpload(storedName: string) {
  if (!/^[a-f0-9-]+(\.[a-z0-9]+)?$/.test(storedName)) {
    throw new Error("Ungültiger Dateiname.");
  }
  return readFile(path.join(uploadDir(), storedName));
}
