// White-Label-Branding (Phase 4.4)
// ---------------------------------
// Zentrale Helfer für die organisationsspezifische Darstellung: Akzentfarbe
// (überschreibt die Marken-Orange-Variablen zur Laufzeit) und Logo-URL.
// Die strukturelle Dunkelgrün-/Shell-Farbe bleibt als neutrale Chrome-Farbe
// bestehen – pro Mandant wird die Akzentfarbe und das Logo getauscht.

// Standard = aktuelles B&W-Orange (Fallback, wenn ein Mandant nichts gesetzt hat)
export const DEFAULT_PRIMARY = "#f69018";

// Validiert/normalisiert eine Hex-Farbe auf das Format „#rrggbb" (Kleinbuchstaben).
// Gibt null zurück, wenn die Eingabe keine gültige Hex-Farbe ist.
export function normalizeHex(input: string | null | undefined): string | null {
  if (!input) return null;
  let hex = input.trim().toLowerCase();
  if (!hex.startsWith("#")) hex = `#${hex}`;
  // Kurzform #abc -> #aabbcc
  if (/^#[0-9a-f]{3}$/.test(hex)) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return /^#[0-9a-f]{6}$/.test(hex) ? hex : null;
}

function toRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

// Mischt eine Farbe mit Weiß (amount > 0) oder Schwarz (amount < 0).
// amount in [-1, 1]: -0.15 = 15 % dunkler, 0.9 = 90 % Richtung Weiß.
function mix(hex: string, amount: number): string {
  const [r, g, b] = toRgb(hex);
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  return toHex(r + (target - r) * t, g + (target - g) * t, b + (target - b) * t);
}

// Leitet aus einer Primärfarbe die drei Marken-Orange-Slots ab:
//   base  – die Akzentfarbe selbst (Buttons, aktive Navigation, Badges)
//   dark  – ~16 % dunkler (Hover/aktive Zustände)
//   light – sehr heller Tint (Badge-Hintergründe, weiche Flächen)
export function deriveBrandShades(primary: string | null | undefined): {
  base: string;
  dark: string;
  light: string;
} {
  const base = normalizeHex(primary) ?? DEFAULT_PRIMARY;
  return {
    base,
    dark: mix(base, -0.16),
    light: mix(base, 0.9),
  };
}

// Relative Helligkeit nach WCAG – Grundlage für den Kontrastwert.
function luminance(hex: string): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = toRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

// Kontrastverhältnis gegen Weiß (Mail-Hintergrund).
function contrastOnWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05);
}

// Linkfarbe für E-Mails: die Akzentfarbe des Mandanten, so weit abgedunkelt,
// dass sie auf weißem Grund lesbar ist (WCAG AA, 4.5:1).
//
// Warum nicht einfach die Akzentfarbe selbst: Ein helles Marken-Orange
// (#f69018 kommt auf 2.1:1) ist als Fließtext-Link auf Weiß kaum zu entziffern.
// Vorher stand hier eine fest verdrahtete Farbe – die war zwar lesbar, aber bei
// jedem Mandanten dieselbe und damit ein White-Label-Bruch.
export function emailLinkColor(primary: string | null | undefined): string {
  let color = normalizeHex(primary) ?? DEFAULT_PRIMARY;
  // In Schritten abdunkeln, bis der Kontrast reicht; nach 20 Schritten ist die
  // Farbe praktisch schwarz und die Schleife endet in jedem Fall.
  for (let i = 0; i < 20 && contrastOnWhite(color) < 4.5; i++) {
    color = mix(color, -0.1);
  }
  return color;
}

// Dasselbe für den Dunkelmodus: Dort ist die abgedunkelte Linkfarbe unlesbar,
// weil sie gegen eine dunkle Fläche steht. Also in die andere Richtung
// aufhellen, bis der Kontrast gegen die dunkle Kartenfläche reicht.
const DARK_CARD = "#27272a";

export function emailLinkColorOnDark(primary: string | null | undefined): string {
  const gegen = luminance(DARK_CARD) + 0.05;
  let color = normalizeHex(primary) ?? DEFAULT_PRIMARY;
  for (let i = 0; i < 20 && (luminance(color) + 0.05) / gegen < 4.5; i++) {
    color = mix(color, 0.1);
  }
  return color;
}

// Schriftfarbe auf der Akzentfarbe (Knopfbeschriftung). Weiß auf einem hellen
// Marken-Gelb wäre unlesbar – deshalb entscheidet die Helligkeit, nicht die
// Gewohnheit.
export function onBrandTextColor(primary: string | null | undefined): string {
  const base = normalizeHex(primary) ?? DEFAULT_PRIMARY;
  return luminance(base) > 0.45 ? "#111827" : "#ffffff";
}

// URL, unter der das Logo der Organisation ausgeliefert wird. Fällt auf das
// statische B&W-Logo zurück, wenn der Mandant (noch) kein eigenes hinterlegt hat.
export function orgLogoUrl(org: {
  id: string;
  logoStoredName: string | null;
}): string {
  return org.logoStoredName ? `/api/files/org-logo/${org.id}` : "/bw-logo.png";
}

// ── Zentrale Branding-Strings für E-Mails & Dokumente ──────────────────────
// Eine vollständig aufgelöste Branding-Sicht einer Organisation. Wird überall
// dort verwendet, wo Texte/Logos einer Hausverwaltung erscheinen (E-Mails,
// PDFs, Schreiben). Fehlt der Org-Kontext, greift DEFAULT_BRANDING.
export type OrgBranding = {
  slug: string;
  displayName: string; // Anzeigename (z. B. „B&W Immobilien")
  legalName: string; // vollständiger Firmenname (Fußzeile/Unterschrift)
  email: string | null;
  phone: string | null;
  telHref: string | null; // normalisiert für tel:-Links
  website: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  addressLine: string | null; // „Straße · PLZ Ort"
  primaryColor: string;
  logoStoredName: string | null;
  isDefault: boolean; // true = Fallback (kein konkreter Mandant aufgelöst)
};

// Fallback-Branding (entspricht den bisherigen, fest verdrahteten B&W-Daten).
// Greift nur, wenn keine Organisation aufgelöst werden kann.
export const DEFAULT_BRANDING: OrgBranding = {
  slug: "bw",
  displayName: "B&W Immobilien Management",
  legalName: "B&W Immobilien Management UG (haftungsbeschränkt)",
  email: "info@bundwimmobilien.de",
  phone: "+49 151 29468127",
  telHref: "+4915129468127",
  website: "www.bundwimmobilien.de",
  street: "Goethestraße 42",
  zip: "45964",
  city: "Gladbeck",
  addressLine: "Goethestraße 42 · 45964 Gladbeck",
  primaryColor: DEFAULT_PRIMARY,
  logoStoredName: null,
  isDefault: true,
};

function telHrefFrom(phone: string | null): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned.length >= 4 ? cleaned : null;
}

function addressLineFrom(
  street: string | null,
  zip: string | null,
  city: string | null
): string | null {
  const cityLine = [zip, city].filter(Boolean).join(" ");
  return [street, cityLine].filter(Boolean).join(" · ") || null;
}

// Felder einer Organisation, die fürs Branding gebraucht werden.
type OrgBrandingSource = {
  slug: string;
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  primaryColor: string | null;
  logoStoredName: string | null;
};

// Löst eine Organisation in ein vollständiges Branding auf. Bei null (kein
// Mandant ermittelbar) greift DEFAULT_BRANDING. Bei vorhandener Org werden NUR
// deren Daten genutzt (keine B&W-Fallbacks für Adresse/E-Mail) – fehlende
// Felder bleiben leer und werden in der Ausgabe weggelassen.
export function brandingFromOrg(org: OrgBrandingSource | null | undefined): OrgBranding {
  if (!org) return DEFAULT_BRANDING;
  return {
    slug: org.slug,
    displayName: org.name,
    legalName: org.legalName?.trim() || org.name,
    email: org.email?.trim() || null,
    phone: org.phone?.trim() || null,
    telHref: telHrefFrom(org.phone),
    website: org.website?.trim() || null,
    street: org.street?.trim() || null,
    zip: org.zip?.trim() || null,
    city: org.city?.trim() || null,
    addressLine: addressLineFrom(org.street, org.zip, org.city),
    primaryColor: normalizeHex(org.primaryColor) ?? DEFAULT_PRIMARY,
    logoStoredName: org.logoStoredName,
    isDefault: false,
  };
}

// Öffentliche (unauthentifizierte) Logo-URL pro Mandant – für Login/öffentliche
// Seiten, wo die session-gebundene Route /api/files/org-logo nicht greift.
// Gibt null zurück, wenn der Mandant kein eigenes Logo hat.
export function publicOrgLogoUrl(org: {
  slug: string;
  logoStoredName: string | null;
}): string | null {
  return org.logoStoredName ? `/api/branding/${encodeURIComponent(org.slug)}/logo` : null;
}

// Logo-URL für E-Mails/externe Kontexte (absolute URL nötig). Eigenes Logo des
// Mandanten über die öffentliche Branding-Route; für das Standard-Branding das
// statische B&W-Logo; sonst null (Empfänger sieht den Namen als Text).
export function emailLogoUrl(b: OrgBranding, base: string): string | null {
  if (!base) return null;
  if (b.logoStoredName) return `${base}/api/branding/${encodeURIComponent(b.slug)}/logo`;
  if (b.isDefault) return `${base}/bw-logo.png`;
  return null;
}

// Branding für Mails, die der **Betreiber** verschickt (Plattform-Rechnungen,
// Mahnungen). Empfänger ist hier die Hausverwaltung, Absender die Plattform –
// deshalb darf hier NICHT das Mandanten-Branding stehen.
//
// Vorher lief das über den Standard-Fallback von `sendMail`, was zufällig
// richtig aussah, aber die fest verdrahteten B&W-Daten nahm statt der über
// PLATFORM_ISSUER_* konfigurierten. Ein Betreiber, der die Env sauber gesetzt
// hatte, bekam trotzdem B&W in die Fußzeile.
//
// Liest die Env direkt, statt `platformIssuer()` aufzurufen: platform.ts zieht
// next/navigation und die Session mit — das hätte jedes Modul, das nur einen
// Mailtext baut, an den Server-Kontext gekettet.
export function platformBranding(): OrgBranding {
  const e = process.env;
  const street = e.PLATFORM_ISSUER_STREET || null;
  const zip = e.PLATFORM_ISSUER_ZIP || null;
  const city = e.PLATFORM_ISSUER_CITY || null;
  const name = e.PLATFORM_ISSUER_NAME;
  return {
    ...DEFAULT_BRANDING,
    displayName: name || DEFAULT_BRANDING.displayName,
    legalName: name || DEFAULT_BRANDING.legalName,
    email: e.PLATFORM_ISSUER_EMAIL || DEFAULT_BRANDING.email,
    street: street ?? DEFAULT_BRANDING.street,
    zip: zip ?? DEFAULT_BRANDING.zip,
    city: city ?? DEFAULT_BRANDING.city,
    addressLine: addressLineFrom(street, zip, city) ?? DEFAULT_BRANDING.addressLine,
  };
}
