"use client";

import { useState, useRef } from "react";
import { inputClass, buttonClass, buttonSecondaryClass } from "@/components/ui";
import { addRoom, updateRoom, deleteRoom, uploadRoomPhoto, deletePhoto } from "./actions";

type Photo = { id: string; storedName: string; fileName: string; caption: string | null };
type Room = {
  id: string;
  name: string;
  roomType: string;
  overallNote: string | null;
  wallsNote: string | null;
  ceilingNote: string | null;
  floorNote: string | null;
  windowsNote: string | null;
  doorsNote: string | null;
  heatingNote: string | null;
  sanitaryNote: string | null;
  otherNote: string | null;
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

const NOTE_FIELDS = [
  { name: "overallNote", label: "Allgemeiner Zustand" },
  { name: "wallsNote", label: "Wände" },
  { name: "ceilingNote", label: "Decke" },
  { name: "floorNote", label: "Boden" },
  { name: "windowsNote", label: "Fenster" },
  { name: "doorsNote", label: "Türen" },
  { name: "heatingNote", label: "Heizung" },
  { name: "sanitaryNote", label: "Sanitär" },
  { name: "otherNote", label: "Sonstiges" },
];

export function RaeumeClient({ handoverId, initialRooms }: { handoverId: string; initialRooms: Room[] }) {
  const [openRoomId, setOpenRoomId] = useState<string | null>(initialRooms[0]?.id ?? null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  return (
    <div className="space-y-4">
      {/* Bestehende Räume */}
      {initialRooms.map((room) => (
        <div key={room.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenRoomId(openRoomId === room.id ? null : room.id)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
          >
            <span className="font-semibold text-gray-900">{room.name}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">{ROOM_TYPES.find((r) => r.value === room.roomType)?.label}</span>
              <span className="text-xs bg-gray-100 rounded-full px-2 py-0.5 text-gray-500">
                {room.photos.length} Foto{room.photos.length !== 1 ? "s" : ""}
              </span>
              <svg
                viewBox="0 0 24 24"
                className={`h-4 w-4 text-gray-400 transition-transform ${openRoomId === room.id ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </button>

          {openRoomId === room.id && (
            <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-5">
              {/* Note fields */}
              <form action={updateRoom} className="space-y-4">
                <input type="hidden" name="roomId" value={room.id} />
                <input type="hidden" name="handoverId" value={handoverId} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {NOTE_FIELDS.map((f) => (
                    <div key={f.name}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                      <textarea
                        name={f.name}
                        defaultValue={room[f.name as keyof Room] as string ?? ""}
                        rows={2}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/30 resize-none"
                        placeholder="Zustand beschreiben …"
                      />
                    </div>
                  ))}
                </div>
                <button type="submit" className={buttonSecondaryClass}>
                  Notizen speichern
                </button>
              </form>

              {/* Fotos */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Fotos</p>
                {room.photos.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {room.photos.map((photo) => (
                      <div key={photo.id} className="relative group">
                        <img
                          src={photo.storedName.startsWith("data:") || photo.storedName.startsWith("http") ? photo.storedName : `/api/uploads/${photo.storedName}`}
                          alt={photo.fileName}
                          className="h-20 w-20 rounded-lg object-cover border border-gray-200"
                        />
                        <form action={deletePhoto} className="absolute top-0.5 right-0.5 hidden group-hover:block">
                          <input type="hidden" name="photoId" value={photo.id} />
                          <input type="hidden" name="handoverId" value={handoverId} />
                          <button
                            type="submit"
                            className="rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600"
                            title="Foto löschen"
                          >
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
                    ref={(el) => { fileInputRefs.current[room.id] = el; }}
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
                    onClick={() => fileInputRefs.current[room.id]?.click()}
                    className={buttonSecondaryClass}
                  >
                    <svg viewBox="0 0 24 24" className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    Foto aufnehmen / hochladen
                  </button>
                </form>
              </div>

              {/* Raum löschen */}
              <form action={deleteRoom}>
                <input type="hidden" name="roomId" value={room.id} />
                <input type="hidden" name="handoverId" value={handoverId} />
                <button type="submit" className="text-xs text-red-500 hover:text-red-700 transition-colors">
                  Raum entfernen
                </button>
              </form>
            </div>
          )}
        </div>
      ))}

      {/* Raum hinzufügen */}
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">Raum hinzufügen</p>
        <form action={addRoom} className="flex flex-wrap gap-3 items-end">
          <input type="hidden" name="handoverId" value={handoverId} />
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Bezeichnung</label>
            <input type="text" name="name" required placeholder="z. B. Wohnzimmer" className={inputClass} />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Art</label>
            <select name="roomType" className={inputClass}>
              {ROOM_TYPES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <button type="submit" className={buttonClass}>
            + Hinzufügen
          </button>
        </form>
      </div>
    </div>
  );
}
