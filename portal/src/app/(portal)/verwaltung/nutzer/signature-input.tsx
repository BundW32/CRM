"use client";

// Verkleinert das Unterschrift-Foto direkt im Browser, BEVOR es hochgeladen wird.
// Hintergrund: Vercel Serverless-Funktionen akzeptieren maximal ~4,5 MB pro
// Anfrage – ein Handy-Foto ist oft größer und würde die Anfrage abbrechen
// ("This page couldn't load"), bevor serverseitiger Code greift. Nach dem
// Verkleinern (max. Kantenlänge, JPEG) ist die Datei nur noch ~100–300 KB.
import { useRef, useState } from "react";

const MAX_DIMENSION = 1600; // längste Kante in Pixeln
const JPEG_QUALITY = 0.85;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Bild konnte nicht gelesen werden."));
    img.src = src;
  });
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

async function resizeToJpeg(file: File): Promise<File> {
  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);
  let { width, height } = img;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar.");
  // Weißer Hintergrund, falls das Original transparent ist (PNG)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );
  if (!blob) throw new Error("Bild konnte nicht konvertiert werden.");
  const baseName = file.name.replace(/\.[^.]+$/, "") || "unterschrift";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
}

export function SignatureInput({ inputClassName }: { inputClassName?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setStatus(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setStatus({ text: "Bitte ein Bild (PNG/JPG) wählen.", ok: false });
      return;
    }
    setBusy(true);
    setStatus({ text: "Bild wird optimiert …", ok: true });
    try {
      const resized = await resizeToJpeg(file);
      // Verkleinerte Datei zurück in das Datei-Feld schreiben, damit das
      // Formular (Server Action) genau diese kleine Datei überträgt.
      const dt = new DataTransfer();
      dt.items.add(resized);
      if (inputRef.current) inputRef.current.files = dt.files;
      const kb = Math.round(resized.size / 1024);
      setStatus({ text: `Bereit zum Speichern (${kb} KB).`, ok: true });
    } catch {
      // Fallback: Originaldatei behalten. Bei sehr großen Fotos schlägt der
      // Upload evtl. trotzdem fehl – dann erscheint eine Server-Fehlermeldung.
      setStatus({
        text: "Konnte nicht optimiert werden – Originalbild wird verwendet.",
        ok: false,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <input
        ref={inputRef}
        type="file"
        name="signature"
        accept="image/*"
        onChange={handleChange}
        disabled={busy}
        className={inputClassName}
      />
      {status ? (
        <span className={`text-[11px] ${status.ok ? "text-green-600" : "text-red-600"}`}>
          {status.text}
        </span>
      ) : null}
    </span>
  );
}
