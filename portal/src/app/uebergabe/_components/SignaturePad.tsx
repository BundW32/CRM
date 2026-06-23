"use client";

import { useRef, useEffect, useState } from "react";

export function SignaturePad({
  label,
  signerName,
  onChange,
  initialValue,
}: {
  label: string;
  signerName?: string;
  onChange: (dataUrl: string | null) => void;
  initialValue?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(!!initialValue);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#003630";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (initialValue) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = initialValue;
    }
  }, [initialValue]);

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
    onChange(canvasRef.current!.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      {signerName && <p className="text-xs text-gray-500">{signerName}</p>}
      <div className={`rounded-xl border-2 transition-colors touch-none ${hasContent ? "border-brand-green/40" : "border-dashed border-gray-300"} bg-white`}>
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
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
            Unterschrift löschen
          </button>
        ) : (
          <p className="text-xs text-gray-400 italic">Hier mit Finger oder Maus unterschreiben</p>
        )}
        {hasContent && <span className="text-xs text-brand-green font-medium">✓ Unterschrieben</span>}
      </div>
    </div>
  );
}
