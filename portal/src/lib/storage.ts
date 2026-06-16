// Datei-Ablage: Vercel Blob (wenn BLOB_READ_WRITE_TOKEN gesetzt ist, z. B. in
// Produktion) oder lokales Dateisystem (Entwicklung). `storedName` enthält
// entweder die Blob-URL oder den lokalen Dateinamen.
import crypto from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { put } from "@vercel/blob";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

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
  const fileId = crypto.randomUUID() + ext;
  const meta = { fileName: file.name, mimeType: file.type, size: file.size };

  if (blobEnabled()) {
    // Die Blob-URL ist zufällig und nicht erratbar; ausgeliefert wird trotzdem
    // ausschließlich über /api/files/** mit Berechtigungsprüfung.
    const blob = await put(`uploads/${fileId}`, file, {
      access: "public",
      contentType: file.type,
    });
    return { storedName: blob.url, ...meta };
  }

  await mkdir(uploadDir(), { recursive: true });
  await writeFile(
    path.join(uploadDir(), fileId),
    Buffer.from(await file.arrayBuffer())
  );
  return { storedName: fileId, ...meta };
}

// Speichert direkt aus einem Buffer (z. B. Base64-Anhänge aus eingehenden E-Mails),
// ohne das auf dem Server ggf. nicht global verfügbare `File`-Objekt zu benötigen.
export async function saveBuffer(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  allowedTypes: string[]
) {
  const size = buffer.byteLength;
  if (size === 0) throw new Error("Die Datei ist leer.");
  if (size > MAX_FILE_SIZE) throw new Error("Die Datei ist größer als 10 MB.");
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

  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), fileId), buffer);
  return { storedName: fileId, ...meta };
}

export async function readUpload(storedName: string): Promise<Buffer> {
  if (storedName.startsWith("https://")) {
    const res = await fetch(storedName);
    if (!res.ok) throw new Error("Datei nicht abrufbar.");
    return Buffer.from(await res.arrayBuffer());
  }
  if (!/^[a-f0-9-]+(\.[a-z0-9]+)?$/.test(storedName)) {
    throw new Error("Ungültiger Dateiname.");
  }
  return readFile(path.join(uploadDir(), storedName));
}
