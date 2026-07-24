"use client";

import { useState, useRef } from "react";
import { inputClass, buttonClass, buttonSecondaryClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { checksForRoomType, countRoomMaengel, type CheckPoint } from "@/lib/handover-checks";
import { addRoom, updateRoomMeta, updateRoomChecks, deleteRoom, uploadRoomPhoto, deletePhoto } from "./actions";

type Photo = { id: string; storedName: string; fileName: string; caption: string | null };
type Room = {
  id: string;
  name: string;
  roomType: string;
  checks: Record<string, string> | null;
  overallNote: string | null;
  photos: Photo[];
};

const ROOM_TYPES = [
  { value: "WOHNZIMMER", label: "Wohnzimmer" },
  { value: "SCHLAFZIMMER", label: "Schlafzimmer" },
  { value: "KINDERZIMMER", label: "Kinderzimmer" },
  { value: "KUECHE", label: "Küche" },
  { value: "BAD", label: "Bad" },
  { value: "GAESTE_WC", label: "Gäste-WC" },
  { value: "FLUR", label: "Flur / Diele" },
  { value: "ABSTELLRAUM", label: "Abstellraum" },
  { value: "BALKON", label: "Balkon" },
  { value: "TERRASSE", label: "Terrasse" },
  { value: "KELLER", label: "Keller" },
  { value: "GARAGE", label: "Garage" },
  { value: "BUERO", label: "Büro" },
  { value: "ESSZIMMER", label: "Esszimmer" },
  { value: "GARDEROBE", label: "Garderobe" },
  { value: "HAUSWIRTSCHAFTSRAUM", label: "Hauswirtschaftsraum" },
  { value: "SONSTIGES", label: "Sonstiges" },
];

const QUICK_ROOMS = [
  { label: "Wohnzimmer", type: "WOHNZIMMER" },
  { label: "Schlafzimmer", type: "SCHLAFZIMMER" },
  { label: "Küche", type: "KUECHE" },
  { label: "Bad", type: "BAD" },
  { label: "Flur", type: "FLUR" },
];

const STATE_OPTIONS = [
  { value: "ok", label: "In Ordnung", short: "✓" },
  { value: "maengel", label: "Mängel", short: "!" },
  { value: "na", label: "Nicht vorhanden", short: "–" },
];

function RoomCheckRow({
  point,
  initial,
  initialNote,
}: {
  point: CheckPoint;
  initial: string;
  initialNote: string;
}) {
  const [value, setValue] = useState(initial);
  const [note, setNote] = useState(initialNote);
  const [showNote, setShowNote] = useState(!!initialNote);

  return (
    <div className="py-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-gray-700 flex-1 min-w-0">{point.label}</span>
        <div className="flex items-center gap-1 shrink-0">
          {STATE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full cursor-pointer text-xs font-medium border transition-all select-none ${
                value === opt.value
                  ? opt.value === "ok"
                    ? "bg-green-50 border-green-300 text-green-700"
                    : opt.value === "maengel"
                    ? "bg-yellow-50 border-yellow-300 text-yellow-700"
                    : "bg-gray-100 border-gray-300 text-gray-600"
                  : "bg-white border-gray-200 text-gray-400 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name={`check_${point.key}`}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => setValue(opt.value)}
                className="sr-only"
              />
              <span className="hidden sm:inline">{opt.label}</span>
              <span className="sm:hidden">{opt.short}</span>
            </label>
          ))}
          <button
            type="button"
            onClick={() => setShowNote((s) => !s)}
            className={`ml-0.5 rounded-lg px-2 py-1 text-xs transition-all active:scale-[0.98] ${
              showNote || note ? "bg-brand-orange/10 text-brand-orange-ink font-medium" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            }`}
            title={showNote ? "Notiz verbergen" : "Notiz hinzufügen"}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      {showNote && (
        <div className="animate-page-in">
          <textarea
            name={`note_${point.key}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Notiz zu diesem Punkt …"
            rows={2}
            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-700 focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/30 resize-none transition duration-150"
          />
        </div>
      )}
      {!showNote && note && <input type="hidden" name={`note_${point.key}`} value={note} />}
    </div>
  );
}

function RoomCard({
  room,
  handoverId,
  open,
  onToggle,
}: {
  room: Room;
  handoverId: string;
  open: boolean;
  onToggle: () => void;
}) {
  const metaRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const points = checksForRoomType(room.roomType);
  const checks = room.checks ?? {};
  const maengel = countRoomMaengel(room.checks);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header: Inline-Bearbeitung von Bezeichnung & Art */}
      <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
        <form ref={metaRef} action={updateRoomMeta} className="flex flex-1 items-center gap-2 min-w-0">
          <input type="hidden" name="roomId" value={room.id} />
          <input type="hidden" name="handoverId" value={handoverId} />
          <input
            name="name"
            defaultValue={room.name}
            onBlur={() => metaRef.current?.requestSubmit()}
            aria-label="Bezeichnung"
            className="flex-1 min-w-0 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-semibold text-gray-900 hover:border-gray-200 focus:border-brand-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 transition"
          />
          <select
            name="roomType"
            defaultValue={room.roomType}
            onChange={() => metaRef.current?.requestSubmit()}
            aria-label="Art"
            className="shrink-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/20 transition max-w-[8.5rem]"
          >
            {ROOM_TYPES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </form>

        <div className="flex items-center gap-1.5 shrink-0">
          {maengel > 0 && (
            <span className="hidden sm:inline-flex items-center rounded-full bg-yellow-50 border border-yellow-200 px-2 py-0.5 text-xs font-medium text-yellow-700">
              {maengel} {maengel === 1 ? "Mangel" : "Mängel"}
            </span>
          )}
          {room.photos.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              {room.photos.length}
            </span>
          )}
          <form action={deleteRoom}>
            <input type="hidden" name="roomId" value={room.id} />
            <input type="hidden" name="handoverId" value={handoverId} />
            <button
              type="submit"
              title="Raum entfernen"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 active:scale-[0.98] transition-all"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a1 1 0 01-1 1H6a1 1 0 01-1-1V6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
          <button
            type="button"
            onClick={onToggle}
            title={open ? "Zuklappen" : "Zustand erfassen"}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 active:scale-[0.98] transition-all"
          >
            <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 px-3 pb-5 pt-3 sm:px-5 space-y-5 animate-page-in">
          {/* Strukturierte Prüfpunkte */}
          <form action={updateRoomChecks} className="space-y-3">
            <input type="hidden" name="roomId" value={room.id} />
            <input type="hidden" name="handoverId" value={handoverId} />
            <div className="divide-y divide-gray-100">
              {points.map((p) => (
                <RoomCheckRow
                  key={p.key}
                  point={p}
                  initial={checks[p.key] ?? ""}
                  initialNote={checks[`note_${p.key}`] ?? ""}
                />
              ))}
            </div>
            <div className="pt-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Weitere Anmerkungen zum Raum</label>
              <textarea
                name="overallNote"
                defaultValue={room.overallNote ?? ""}
                rows={2}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/30 resize-none transition duration-150"
                placeholder="z. B. Kratzer am Parkett vor dem Fenster …"
              />
            </div>
            <SubmitButton className={buttonSecondaryClass} pendingLabel="Wird gespeichert…">
              Zustand speichern
            </SubmitButton>
          </form>

          {/* Fotos */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Fotos</p>
            {room.photos.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {room.photos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    {/* Dynamische, API-gelieferte Foto-Vorschau – <img> ist hier bewusst gewählt */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/files/handover-photo/${photo.id}`}
                      alt={photo.fileName}
                      className="h-20 w-20 rounded-lg object-cover border border-gray-200"
                    />
                    <form action={deletePhoto} className="absolute top-0.5 right-0.5 hidden group-hover:block">
                      <input type="hidden" name="photoId" value={photo.id} />
                      <input type="hidden" name="handoverId" value={handoverId} />
                      <button type="submit" className="rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600" title="Foto löschen">
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
                        </svg>
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
            <form action={uploadRoomPhoto}>
              <input type="hidden" name="handoverId" value={handoverId} />
              <input type="hidden" name="roomId" value={room.id} />
              <input
                ref={fileRef}
                type="file"
                name="photo"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) e.target.form?.requestSubmit();
                }}
              />
              <button type="button" onClick={() => fileRef.current?.click()} className={buttonSecondaryClass}>
                <svg viewBox="0 0 24 24" className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Fotos aufnehmen / hochladen
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function RaeumeClient({ handoverId, initialRooms }: { handoverId: string; initialRooms: Room[] }) {
  const [openRoomId, setOpenRoomId] = useState<string | null>(initialRooms[0]?.id ?? null);
  const [customName, setCustomName] = useState("");
  const [customType, setCustomType] = useState("WOHNZIMMER");

  return (
    <div className="space-y-4">
      {initialRooms.map((room) => (
        <RoomCard
          key={room.id}
          room={room}
          handoverId={handoverId}
          open={openRoomId === room.id}
          onToggle={() => setOpenRoomId(openRoomId === room.id ? null : room.id)}
        />
      ))}

      {/* Raum hinzufügen */}
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 space-y-4">
        <p className="text-sm font-semibold text-gray-700">Raum hinzufügen</p>

        {/* Schnellauswahl */}
        <div className="flex flex-wrap gap-2">
          {QUICK_ROOMS.map((q) => (
            <form key={q.label} action={addRoom}>
              <input type="hidden" name="handoverId" value={handoverId} />
              <input type="hidden" name="name" value={q.label} />
              <input type="hidden" name="roomType" value={q.type} />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-brand-orange/40 hover:bg-brand-orange/5 hover:text-brand-orange-dark active:scale-[0.98] transition-all"
              >
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {q.label}
              </button>
            </form>
          ))}
        </div>

        {/* Eigener Raum */}
        <form action={addRoom} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 sm:items-end">
          <input type="hidden" name="handoverId" value={handoverId} />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Eigene Bezeichnung</label>
            <input
              type="text"
              name="name"
              required
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="z. B. Arbeitszimmer"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Art</label>
            <select
              name="roomType"
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              className={`${inputClass} sm:w-44`}
            >
              {ROOM_TYPES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <button type="submit" className={`${buttonClass} sm:h-[38px]`}>
            Hinzufügen
          </button>
        </form>
      </div>
    </div>
  );
}
