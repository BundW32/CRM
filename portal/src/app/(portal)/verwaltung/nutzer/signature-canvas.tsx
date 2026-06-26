"use client";

import { useRef, useEffect, useState } from "react";

export function SignatureCanvas({ hasExisting }: { hasExisting: boolean }) {
  const [showCanvas, setShowCanvas] = useState(!hasExisting);
  const [drawing, setDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [dataUrl, setDataUrl] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!showCanvas) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#003630";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [showCanvas]);

  function getPos(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setDrawing(true);
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasContent(true);
  }

  function endDraw() {
    if (!drawing) return;
    setDrawing(false);
    const url = canvasRef.current!.toDataURL("image/png");
    setDataUrl(url);
  }

  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
    setDataUrl("");
  }

  function cancelNew() {
    setShowCanvas(false);
    setHasContent(false);
    setDataUrl("");
  }

  if (!showCanvas) {
    return (
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
          Unterschrift hinterlegt ✓
        </span>
        <button
          type="button"
          onClick={() => setShowCanvas(true)}
          className="text-xs text-brand-orange underline hover:text-brand-orange-dark"
        >
          Neu zeichnen
        </button>
        <input type="hidden" name="signatureDataUrl" value="" />
      </div>
    );
  }

  return (
    <div className="space-y-1.5 w-full">
      {hasExisting && (
        <button
          type="button"
          onClick={cancelNew}
          className="text-xs text-gray-400 underline hover:text-gray-600"
        >
          ← Vorhandene behalten
        </button>
      )}
      <input type="hidden" name="signatureDataUrl" value={dataUrl} />
      <div
        className={`rounded-xl border-2 transition-colors touch-none ${
          hasContent ? "border-brand-green/40" : "border-dashed border-gray-300"
        } bg-white`}
      >
        <canvas
          ref={canvasRef}
          width={600}
          height={150}
          className="w-full cursor-crosshair rounded-xl"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
      <div className="flex items-center justify-between">
        {hasContent ? (
          <button
            type="button"
            onClick={clear}
            className="text-xs text-red-500 hover:text-red-700 transition-colors"
          >
            Löschen
          </button>
        ) : (
          <p className="text-xs text-gray-400 italic">
            Hier mit Finger oder Maus unterschreiben
          </p>
        )}
        {hasContent && (
          <span className="text-xs text-brand-green font-medium">✓ Unterschrieben</span>
        )}
      </div>
    </div>
  );
}
