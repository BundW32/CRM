"use client";

// Bereitet das Unterschrift-Foto direkt im Browser auf, BEVOR es hochgeladen wird:
//  1. Verkleinern (Vercel-Serverless akzeptiert nur ~4,5 MB pro Anfrage; ein
//     Handy-Foto ist oft größer und würde die Anfrage abbrechen).
//  2. Freistellen: heller Papier-Hintergrund wird transparent, nur die Tinte
//     bleibt – so wirkt die Unterschrift im Dokument echt eingefügt.
//  3. Eng zuschneiden auf den tatsächlichen Schriftzug.
//  4. Ausgabe als PNG (mit Transparenz). Die Größe im Dokument passt der
//     PDF-Generator automatisch über das Seitenverhältnis an.
import { useRef, useState } from "react";
import { FileInput } from "@/components/file-input";

const MAX_DIMENSION = 1400; // längste Kante in Pixeln (Verarbeitungsauflösung)
// Helligkeitsschwellen für das Freistellen (0 = schwarz, 255 = weiß):
const BG_THRESHOLD = 215; // heller als dies -> Hintergrund (transparent)
const INK_THRESHOLD = 120; // dunkler als dies -> Tinte (deckend)

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

// Stellt die Unterschrift frei und schneidet sie zu. Gibt eine PNG-Datei zurück.
async function prepareSignature(file: File): Promise<File> {
  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);

  // Auf Verarbeitungsauflösung skalieren
  let w = img.width;
  let h = img.height;
  if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
    const scale = Math.min(MAX_DIMENSION / w, MAX_DIMENSION / h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas nicht verfügbar.");
  ctx.drawImage(img, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const px = imageData.data;

  // Hintergrund transparent machen, Bounding-Box der Tinte bestimmen
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      // wahrgenommene Helligkeit
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      let alpha: number;
      if (lum >= BG_THRESHOLD) {
        alpha = 0;
      } else if (lum <= INK_THRESHOLD) {
        alpha = 255;
      } else {
        // weicher Übergang für saubere Kanten
        alpha = Math.round(((BG_THRESHOLD - lum) / (BG_THRESHOLD - INK_THRESHOLD)) * 255);
      }
      // sehr schwache Reste (Papierrauschen/Schatten) verwerfen
      if (alpha < 40) alpha = 0;
      px[i + 3] = alpha;
      if (alpha > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Nichts erkannt? Dann unverändert (deckend) lassen, damit nichts verloren geht.
  if (maxX < minX || maxY < minY) {
    throw new Error("Keine Unterschrift erkannt.");
  }

  ctx.putImageData(imageData, 0, 0);

  // Eng zuschneiden mit etwas Rand
  const pad = Math.round(Math.max(w, h) * 0.02);
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(w, maxX + pad) - cropX + 1;
  const cropH = Math.min(h, maxY + pad) - cropY + 1;

  const out = document.createElement("canvas");
  out.width = cropW;
  out.height = cropH;
  const outCtx = out.getContext("2d");
  if (!outCtx) throw new Error("Canvas nicht verfügbar.");
  outCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  const blob = await new Promise<Blob | null>((resolve) =>
    out.toBlob(resolve, "image/png")
  );
  if (!blob) throw new Error("Bild konnte nicht konvertiert werden.");
  const baseName = file.name.replace(/\.[^.]+$/, "") || "unterschrift";
  return new File([blob], `${baseName}.png`, { type: "image/png" });
}

export function SignatureInput() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleChange(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      setStatus(null);
      setPreview(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setStatus({ text: "Bitte ein Bild (PNG/JPG) wählen.", ok: false });
      return;
    }
    setBusy(true);
    setStatus({ text: "Unterschrift wird freigestellt …", ok: true });
    try {
      const prepared = await prepareSignature(file);
      // Aufbereitete Datei zurück in das Datei-Feld schreiben, damit das
      // Formular (Server Action) genau dieses freigestellte PNG überträgt.
      const dt = new DataTransfer();
      dt.items.add(prepared);
      if (inputRef.current) inputRef.current.files = dt.files;
      setPreview(URL.createObjectURL(prepared));
      const kb = Math.round(prepared.size / 1024);
      setStatus({ text: `Freigestellt & bereit (${kb} KB).`, ok: true });
    } catch {
      setStatus({
        text: "Konnte nicht automatisch freigestellt werden – bitte ein kontrastreiches Foto (dunkle Tinte auf hellem Papier) verwenden.",
        ok: false,
      });
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <FileInput
        inputRef={inputRef}
        name="signature"
        accept="image/*"
        label="Unterschrift wählen"
        onFilesChange={handleChange}
        disabled={busy}
      />
      {preview ? (
        // Karierter Hintergrund zur Kontrolle der Transparenz
        <span
          className="inline-block w-fit rounded border border-gray-200 p-1"
          style={{
            backgroundImage:
              "linear-gradient(45deg,#e5e7eb 25%,transparent 25%),linear-gradient(-45deg,#e5e7eb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e7eb 75%),linear-gradient(-45deg,transparent 75%,#e5e7eb 75%)",
            backgroundSize: "10px 10px",
            backgroundPosition: "0 0,0 5px,5px -5px,-5px 0",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Vorschau der freigestellten Unterschrift" className="h-12 w-auto" />
        </span>
      ) : null}
      {status ? (
        <span className={`text-[11px] ${status.ok ? "text-green-600" : "text-red-600"}`}>
          {status.text}
        </span>
      ) : null}
    </span>
  );
}
