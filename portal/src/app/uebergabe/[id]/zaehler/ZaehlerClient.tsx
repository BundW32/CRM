"use client";

import { useRef } from "react";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { PendingButton } from "@/components/pending-button";
import { Card, buttonClass, buttonSecondaryClass, inputClass } from "@/components/ui";
import { addMeter, updateMeter, deleteMeter, uploadMeterPhoto } from "./actions";
import { DateField } from "@/components/fields";

type Meter = {
  id: string;
  meterType: string;
  meterNumber: string | null;
  reading: string | null;
  readingDate: Date;
  photoStoredName: string | null;
  notes: string | null;
};

const METER_TYPES = [
  { value: "STROM", label: "Strom" },
  { value: "GAS", label: "Gas" },
  { value: "WASSER_KALT", label: "Wasser kalt" },
  { value: "WASSER_WARM", label: "Wasser warm" },
  { value: "HEIZUNG", label: "Heizung" },
  { value: "SONSTIGES", label: "Sonstiges" },
];

const METER_ICONS: Record<string, string> = {
  STROM: "⚡",
  GAS: "🔥",
  WASSER_KALT: "💧",
  WASSER_WARM: "♨️",
  HEIZUNG: "🌡️",
  SONSTIGES: "📊",
};

export function ZaehlerClient({ handoverId, initialMeters }: { handoverId: string; initialMeters: Meter[] }) {
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  return (
    <div className="space-y-4">
      {initialMeters.map((meter) => {
        const dateStr = new Date(meter.readingDate).toISOString().split("T")[0];
        return (
          <Card key={meter.id}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">{METER_ICONS[meter.meterType] ?? "📊"}</span>
                <span className="font-semibold text-gray-900">
                  {METER_TYPES.find((t) => t.value === meter.meterType)?.label ?? meter.meterType}
                </span>
              </div>
              <form action={deleteMeter}>
                <input type="hidden" name="meterId" value={meter.id} />
                <input type="hidden" name="handoverId" value={handoverId} />
                <ConfirmActionButton
                  className="text-xs text-red-500 hover:text-red-700 transition-colors"
                  confirmLabel="Wirklich entfernen?"
                  pendingLabel="Wird entfernt…"
                >
                  Entfernen
                </ConfirmActionButton>
              </form>
            </div>

            <form action={updateMeter} className="space-y-3">
              <input type="hidden" name="meterId" value={meter.id} />
              <input type="hidden" name="handoverId" value={handoverId} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Zählernummer</label>
                  <input
                    type="text"
                    name="meterNumber"
                    defaultValue={meter.meterNumber ?? ""}
                    className={inputClass}
                    placeholder="z. B. 12345678"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Zählerstand</label>
                  <input
                    type="text"
                    name="reading"
                    defaultValue={meter.reading ?? ""}
                    className={inputClass}
                    placeholder="z. B. 12345,6"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ablesedatum</label>
                  <DateField
                    name="readingDate"
                    defaultValue={dateStr}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Bemerkung</label>
                <input
                  type="text"
                  name="notes"
                  defaultValue={meter.notes ?? ""}
                  className={inputClass}
                  placeholder="Optionale Notiz …"
                />
              </div>
              <PendingButton className={buttonSecondaryClass}>Speichern</PendingButton>
            </form>

            {/* Foto */}
            <div className="mt-4">
              {meter.photoStoredName && (
                /* Dynamische, API-gelieferte Zählerfoto-Vorschau – <img> ist hier bewusst gewählt */
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`/api/files/handover-meter/${meter.id}`}
                  alt="Zählerfoto"
                  className="mb-2 h-24 rounded-lg object-cover border border-gray-200"
                />
              )}
              <form action={uploadMeterPhoto}>
                <input type="hidden" name="meterId" value={meter.id} />
                <input type="hidden" name="handoverId" value={handoverId} />
                <input
                  ref={(el) => { fileRefs.current[meter.id] = el; }}
                  type="file"
                  name="photo"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      e.target.form?.requestSubmit();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRefs.current[meter.id]?.click()}
                  className={buttonSecondaryClass}
                >
                  <svg viewBox="0 0 24 24" className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  {meter.photoStoredName ? "Foto ersetzen" : "Foto aufnehmen"}
                </button>
              </form>
            </div>
          </Card>
        );
      })}

      {/* Zähler hinzufügen */}
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">Zähler hinzufügen</p>
        <form action={addMeter} className="flex flex-wrap gap-3 items-end">
          <input type="hidden" name="handoverId" value={handoverId} />
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Art</label>
            <select name="meterType" className={inputClass}>
              {METER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <PendingButton className={buttonClass}>+ Hinzufügen</PendingButton>
        </form>
      </div>
    </div>
  );
}
