"use client";

import { useState } from "react";
import { PendingButton } from "@/components/pending-button";
import { Field, inputClass } from "@/components/ui";
import { DEFAULT_PRIMARY, normalizeHex } from "@/lib/branding";

export type BrandingDefaults = {
  name: string;
  slug: string;
  legalName: string;
  primaryColor: string;
  email: string;
  phone: string;
  website: string;
  street: string;
  zip: string;
  city: string;
  logoUrl: string | null;
};

export function BrandingForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaults: BrandingDefaults;
  submitLabel: string;
}) {
  const [color, setColor] = useState(
    normalizeHex(defaults.primaryColor) ?? DEFAULT_PRIMARY
  );

  return (
    <form action={action} encType="multipart/form-data" className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Anzeigename der Hausverwaltung">
          <input
            type="text"
            name="name"
            defaultValue={defaults.name}
            required
            maxLength={200}
            placeholder="z. B. Muster Hausverwaltung"
            className={inputClass}
          />
        </Field>
        <Field label="Vollständiger Firmenname (Impressum)">
          <input
            type="text"
            name="legalName"
            defaultValue={defaults.legalName}
            maxLength={200}
            placeholder="z. B. Muster Hausverwaltung GmbH"
            className={inputClass}
          />
        </Field>
      </div>

      {/* Subdomain / Kennung */}
      <div>
        <p className="mb-1.5 text-sm font-medium text-gray-700">Web-Adresse (Subdomain)</p>
        <input
          type="text"
          name="slug"
          defaultValue={defaults.slug}
          maxLength={40}
          placeholder="z. B. muster"
          className={`${inputClass} font-mono`}
        />
        <p className="mt-1 text-[11px] text-gray-400">
          Wird zu Ihrer Portal-Adresse (z. B. <span className="font-mono">muster.…</span>).
          Nur Kleinbuchstaben, Ziffern und Bindestriche.
        </p>
      </div>

      {/* Logo */}
      <div>
        <p className="mb-1.5 text-sm font-medium text-gray-700">Logo</p>
        <div className="flex flex-wrap items-center gap-4">
          {defaults.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={defaults.logoUrl}
              alt="Aktuelles Logo"
              className="h-12 w-auto rounded border border-gray-200 bg-white p-1"
            />
          ) : (
            <span className="text-xs text-gray-400 italic">Noch kein Logo hinterlegt</span>
          )}
          <input
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/webp"
            className="text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-brand-orange-light file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand-orange-dark"
          />
        </div>
        <p className="mt-1 text-[11px] text-gray-400">
          PNG mit transparentem Hintergrund empfohlen. Wird in der Kopfzeile angezeigt.
        </p>
      </div>

      {/* Akzentfarbe mit Live-Vorschau */}
      <div>
        <p className="mb-1.5 text-sm font-medium text-gray-700">Akzentfarbe</p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded border border-gray-200 bg-white p-0.5"
            aria-label="Farbe wählen"
          />
          <input
            type="text"
            name="primaryColor"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            maxLength={7}
            className={`${inputClass} w-32 font-mono`}
          />
          {/* Vorschau: so sehen Buttons & Akzente später aus */}
          <span
            className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm"
            style={{ backgroundColor: color }}
          >
            Vorschau
          </span>
        </div>
        <p className="mt-1 text-[11px] text-gray-400">
          Bestimmt die Farbe von Buttons, aktiven Menüpunkten und Hervorhebungen.
        </p>
      </div>

      {/* Kontakt / Impressum */}
      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">Kontakt &amp; Impressum</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E-Mail">
            <input
              type="email"
              name="email"
              defaultValue={defaults.email}
              maxLength={200}
              className={inputClass}
            />
          </Field>
          <Field label="Telefon">
            <input
              type="text"
              name="phone"
              defaultValue={defaults.phone}
              maxLength={50}
              className={inputClass}
            />
          </Field>
          <Field label="Webseite">
            <input
              type="text"
              name="website"
              defaultValue={defaults.website}
              maxLength={200}
              placeholder="www.beispiel.de"
              className={inputClass}
            />
          </Field>
          <Field label="Straße und Nr.">
            <input
              type="text"
              name="street"
              defaultValue={defaults.street}
              maxLength={200}
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="PLZ">
              <input
                type="text"
                name="zip"
                defaultValue={defaults.zip}
                maxLength={20}
                className={inputClass}
              />
            </Field>
            <div className="col-span-2">
              <Field label="Ort">
                <input
                  type="text"
                  name="city"
                  defaultValue={defaults.city}
                  maxLength={100}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <PendingButton className="inline-flex items-center justify-center rounded-lg bg-brand-green px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-green-dark active:scale-[0.98] disabled:opacity-50">
          {submitLabel}
        </PendingButton>
      </div>
    </form>
  );
}
