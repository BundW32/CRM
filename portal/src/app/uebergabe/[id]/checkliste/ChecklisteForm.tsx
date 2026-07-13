"use client";

import { useState } from "react";
import { buttonClass, buttonSecondaryClass } from "@/components/ui";
import { saveCheckliste } from "./actions";

type CheckItem = { key: string; label: string };
type CheckSection = { title: string; items: CheckItem[] };

const STATE_OPTIONS = [
  { value: "ok", label: "In Ordnung", color: "text-green-600", dot: "bg-green-500" },
  { value: "maengel", label: "Mängel", color: "text-yellow-600", dot: "bg-yellow-500" },
  { value: "na", label: "Nicht vorhanden", color: "text-gray-400", dot: "bg-gray-300" },
];

function CheckRow({
  item,
  initial,
  initialNote,
}: {
  item: CheckItem;
  initial: string;
  initialNote: string;
}) {
  const [value, setValue] = useState(initial);
  const [note, setNote] = useState(initialNote);
  const [showNote, setShowNote] = useState(!!initialNote);

  return (
    <div className="py-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-gray-700 flex-1">{item.label}</span>
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
                name={`check_${item.key}`}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => setValue(opt.value)}
                className="sr-only"
              />
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${value === opt.value ? opt.dot : "bg-gray-300"}`} />
              <span className="hidden sm:inline">{opt.label}</span>
              <span className="sm:hidden">{opt.value === "ok" ? "✓" : opt.value === "maengel" ? "!" : "–"}</span>
            </label>
          ))}
          <button
            type="button"
            onClick={() => setShowNote((s) => !s)}
            className={`ml-1 rounded-lg px-2 py-1 text-xs transition-all active:scale-[0.98] ${
              showNote || note
                ? "bg-brand-orange/10 text-brand-orange-ink font-medium"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
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
            name={`note_${item.key}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Notiz zu diesem Punkt …"
            rows={2}
            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-700 focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/30 resize-none transition duration-150"
          />
        </div>
      )}
      {!showNote && note && <input type="hidden" name={`note_${item.key}`} value={note} />}
    </div>
  );
}

export function ChecklisteForm({
  handoverId,
  sections,
  saved,
  generalNotes,
  agreements,
}: {
  handoverId: string;
  sections: CheckSection[];
  saved: Record<string, string>;
  generalNotes: string | null;
  agreements: string | null;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <form action={saveCheckliste} className="space-y-5">
        <input type="hidden" name="id" value={handoverId} />

        <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/70">
          Allgemeine Haus- und Übergabepunkte. Raumbezogene Prüfungen (Wände, Fenster, Küche, Bad …) erfassen Sie direkt im Schritt <span className="font-medium text-white">Räume</span>.
        </div>

        {sections.map((section) => (
          <div key={section.title} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-3">{section.title}</h2>
            <div className="divide-y divide-gray-100">
              {section.items.map((item) => (
                <CheckRow
                  key={item.key}
                  item={item}
                  initial={saved[item.key] ?? ""}
                  initialNote={saved[`note_${item.key}`] ?? ""}
                />
              ))}
            </div>
          </div>
        ))}

        {/* General notes */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900">Anmerkungen &amp; Vereinbarungen</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Allgemeine Anmerkungen</label>
            <textarea
              name="generalNotes"
              defaultValue={generalNotes ?? ""}
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/30 resize-none transition duration-150"
              placeholder="Weitere Bemerkungen zum Zustand der Wohnung …"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Getroffene Vereinbarungen</label>
            <textarea
              name="agreements"
              defaultValue={agreements ?? ""}
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/30 resize-none transition duration-150"
              placeholder="z. B. Mieter streicht Wand bis 01.07. neu …"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button type="submit" name="_action" value="save" className={buttonSecondaryClass}>
            Speichern &amp; schließen
          </button>
          <button type="submit" name="_action" value="next" className={buttonClass}>
            Weiter: Zählerstände →
          </button>
        </div>
      </form>
    </div>
  );
}
