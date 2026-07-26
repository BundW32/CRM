"use client";

import { useState, type ReactNode } from "react";
import { PendingButton } from "@/components/pending-button";
import { inputClass, buttonClass, buttonSecondaryClass } from "@/components/ui";
import { KeysSection } from "./KeysSection";
import { saveStammdaten } from "./actions";

type HandoverType = "EINZUG" | "AUSZUG" | "ZWISCHENZUSTAND";

const TYPE_OPTIONS: { value: HandoverType; label: string }[] = [
  { value: "EINZUG", label: "Einzug" },
  { value: "AUSZUG", label: "Auszug" },
  { value: "ZWISCHENZUSTAND", label: "Zwischenzustand" },
];

const MOVE_DATE_LABEL: Record<HandoverType, string> = {
  EINZUG: "Einzugsdatum",
  AUSZUG: "Auszugsdatum",
  ZWISCHENZUSTAND: "Stichtag",
};

const TENANT_ADDRESS_LABEL: Record<HandoverType, string> = {
  EINZUG: "Vorherige Anschrift",
  AUSZUG: "Neue Anschrift",
  ZWISCHENZUSTAND: "Anschrift Mieter",
};

type Initial = {
  type: HandoverType;
  handoverDate: string;
  moveDate: string;
  livingArea: string;
  roomCount: string;
  personCount: string;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string;
  tenantAddress: string;
  tenantBirthDate: string;
  tenant2Name: string;
  tenant2BirthDate: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  managerCompany: string;
  managerName: string;
  managerEmail: string;
  managerPhone: string;
  keysApartment: number | null;
  keysMailbox: number | null;
  keysBasement: number | null;
  keysGarage: number | null;
  keysOther: string | null;
  parkingSpace: string;
  cellarSpace: string;
};

const cardClass = "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4";
const labelClass = "block text-sm font-medium text-gray-700 mb-1";

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className={labelClass}>{children}</label>;
}

export function StammdatenForm({
  id,
  property,
  unit,
  initial,
}: {
  id: string;
  property: { name: string; street: string | null; zip: string | null; city: string | null };
  unit: { label: string; floor: string | null };
  initial: Initial;
}) {
  const [type, setType] = useState<HandoverType>(initial.type);
  const [showTenant2, setShowTenant2] = useState(!!initial.tenant2Name);

  const addressLine = [property.street, [property.zip, property.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  return (
    <form action={saveStammdaten} className="space-y-5">
      <input type="hidden" name="id" value={id} />

      {/* Objekt / Einheit */}
      <div className="rounded-2xl border border-brand-green/30 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">{property.name} · {unit.label}</p>
            {addressLine && <p className="text-sm text-gray-600">{addressLine}</p>}
            {unit.floor && <p className="text-xs text-gray-500">Etage: {unit.floor}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div>
            <FieldLabel>Wohnfläche (m²)</FieldLabel>
            <input type="text" inputMode="decimal" name="livingArea" defaultValue={initial.livingArea} className={inputClass} placeholder="z. B. 72,5" />
          </div>
          <div>
            <FieldLabel>Zimmer</FieldLabel>
            <input type="text" inputMode="decimal" name="roomCount" defaultValue={initial.roomCount} className={inputClass} placeholder="z. B. 3" />
          </div>
          <div>
            <FieldLabel>Personen im Haushalt</FieldLabel>
            <input type="number" min={0} name="personCount" defaultValue={initial.personCount} className={inputClass} placeholder="z. B. 2" />
          </div>
        </div>
      </div>

      {/* Übergabeart + Daten */}
      <div className={cardClass}>
        <h2 className="font-semibold text-gray-900">Übergabe</h2>
        <div>
          <span className="block text-sm font-medium text-gray-700 mb-2">Art</span>
          <div className="flex flex-wrap gap-4">
            {TYPE_OPTIONS.map((t) => (
              <label key={t.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value={t.value}
                  checked={type === t.value}
                  onChange={() => setType(t.value)}
                  className="accent-brand-orange"
                />
                <span className="text-sm text-gray-700">{t.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel>Protokolldatum</FieldLabel>
            <input type="date" name="handoverDate" defaultValue={initial.handoverDate} className={inputClass} />
            <p className="mt-1 text-xs text-gray-400">Tag der Protokollaufnahme</p>
          </div>
          <div>
            <FieldLabel>{MOVE_DATE_LABEL[type]}</FieldLabel>
            <input type="date" name="moveDate" defaultValue={initial.moveDate} className={inputClass} />
            <p className="mt-1 text-xs text-gray-400">
              {type === "ZWISCHENZUSTAND" ? "Stichtag der Begehung" : "Tatsächlicher Übergabetermin"}
            </p>
          </div>
        </div>
      </div>

      {/* Mieter */}
      <div className={cardClass}>
        <h2 className="font-semibold text-gray-900">Mieter</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel>Name</FieldLabel>
            <input type="text" name="tenantName" defaultValue={initial.tenantName} className={inputClass} placeholder="Vor- und Nachname" />
          </div>
          <div>
            <FieldLabel>Geburtsdatum</FieldLabel>
            <input type="date" name="tenantBirthDate" defaultValue={initial.tenantBirthDate} className={inputClass} />
          </div>
          <div>
            <FieldLabel>E-Mail</FieldLabel>
            <input type="email" name="tenantEmail" defaultValue={initial.tenantEmail} className={inputClass} />
          </div>
          <div>
            <FieldLabel>Telefon</FieldLabel>
            <input type="tel" name="tenantPhone" defaultValue={initial.tenantPhone} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel>{TENANT_ADDRESS_LABEL[type]}</FieldLabel>
            <input type="text" name="tenantAddress" defaultValue={initial.tenantAddress} className={inputClass} placeholder="Straße, PLZ Ort" />
          </div>
        </div>

        {showTenant2 ? (
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-4 animate-page-in">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Zweiter Mieter / Mitbewohner</p>
              <button
                type="button"
                onClick={() => setShowTenant2(false)}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Entfernen
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Name</FieldLabel>
                <input type="text" name="tenant2Name" defaultValue={initial.tenant2Name} className={inputClass} placeholder="Vor- und Nachname" />
              </div>
              <div>
                <FieldLabel>Geburtsdatum</FieldLabel>
                <input type="date" name="tenant2BirthDate" defaultValue={initial.tenant2BirthDate} className={inputClass} />
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowTenant2(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-brand-orange hover:text-brand-orange-dark active:scale-[0.98] transition-all"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Zweiten Mieter hinzufügen
          </button>
        )}
        {/* Damit ein bewusst entfernter Zweitmieter geleert wird */}
        {!showTenant2 && (
          <>
            <input type="hidden" name="tenant2Name" value="" />
            <input type="hidden" name="tenant2BirthDate" value="" />
          </>
        )}
      </div>

      {/* Eigentümer */}
      <div className={cardClass}>
        <h2 className="font-semibold text-gray-900">Eigentümer</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel>Name</FieldLabel>
            <input type="text" name="ownerName" defaultValue={initial.ownerName} className={inputClass} />
          </div>
          <div>
            <FieldLabel>E-Mail</FieldLabel>
            <input type="email" name="ownerEmail" defaultValue={initial.ownerEmail} className={inputClass} />
          </div>
          <div>
            <FieldLabel>Telefon</FieldLabel>
            <input type="tel" name="ownerPhone" defaultValue={initial.ownerPhone} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Verwaltung / Protokollführer */}
      <div className={cardClass}>
        <h2 className="font-semibold text-gray-900">Verwaltung &amp; Protokollführer</h2>
        <div>
          <FieldLabel>Verwaltung / Hausverwaltung</FieldLabel>
          <input type="text" name="managerCompany" defaultValue={initial.managerCompany} className={inputClass} placeholder="z. B. B&amp;W Immobilien Management UG" />
          <p className="mt-1 text-xs text-gray-400">Erscheint im Protokoll-Kopf (White-Label).</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <FieldLabel>Protokollführer <span className="text-red-500">*</span></FieldLabel>
            <input type="text" name="managerName" defaultValue={initial.managerName} required className={inputClass} placeholder="Name des Mitarbeiters" />
          </div>
          <div>
            <FieldLabel>E-Mail</FieldLabel>
            <input type="email" name="managerEmail" defaultValue={initial.managerEmail} className={inputClass} />
          </div>
          <div>
            <FieldLabel>Telefon</FieldLabel>
            <input type="tel" name="managerPhone" defaultValue={initial.managerPhone} className={inputClass} />
          </div>
        </div>
        <p className="text-xs text-gray-400">Der Protokollführer unterschreibt das Protokoll im letzten Schritt.</p>
      </div>

      {/* Schlüssel & Stellplatz */}
      <div className={cardClass}>
        <h2 className="font-semibold text-gray-900">Schlüssel &amp; Stellplatz</h2>
        <KeysSection
          initial={{
            keysApartment: initial.keysApartment,
            keysMailbox: initial.keysMailbox,
            keysBasement: initial.keysBasement,
            keysGarage: initial.keysGarage,
            keysOther: initial.keysOther,
          }}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
          <div>
            <FieldLabel>Stellplatz Nr.</FieldLabel>
            <input type="text" name="parkingSpace" defaultValue={initial.parkingSpace} className={inputClass} />
          </div>
          <div>
            <FieldLabel>Kellerabteil Nr.</FieldLabel>
            <input type="text" name="cellarSpace" defaultValue={initial.cellarSpace} className={inputClass} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <PendingButton name="_action" value="save" className={buttonSecondaryClass}>Speichern &amp; schließen</PendingButton>
        <PendingButton name="_action" value="next" className={buttonClass}>Weiter: Räume →</PendingButton>
      </div>
    </form>
  );
}
