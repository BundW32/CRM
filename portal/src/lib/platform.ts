import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";

// ── Plattform-Betreiber-Ebene (B&W) ──────────────────────────────────────────
// Zugang zu /plattform ist doppelt abgesichert: (1) User.isPlatformAdmin (nur per
// DB/Seed setzbar, nie über eine Oberfläche) UND (2) die E-Mail muss in der
// Server-Env PLATFORM_ADMIN_EMAILS (kommagetrennt) stehen. Beides muss gelten.

// Parst die Allowlist aus der Env: trennt an Kommas, trimmt, klein, leere raus.
export function parseAdminAllowlist(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// Ist dieser Nutzer ein Plattform-Betreiber? Flag UND E-Mail in der Allowlist.
export function isPlatformAdminUser(
  user: { isPlatformAdmin: boolean; email: string | null },
): boolean {
  if (!user.isPlatformAdmin) return false;
  if (!user.email) return false;
  const allow = parseAdminAllowlist(process.env.PLATFORM_ADMIN_EMAILS);
  return allow.includes(user.email.trim().toLowerCase());
}

// Guard für alle /plattform-Seiten und -Server-Actions. Bei fehlender Berechtigung
// kommentarlos zurück ins normale Portal. Loggt NICHT (das übernimmt das Layout
// einmal pro Aufruf; ein Log hier würde in jeder Action doppelt feuern).
export async function requirePlatformAdmin() {
  const user = await requireUser();
  if (!isPlatformAdminUser(user)) redirect("/dashboard");
  return user;
}

// ── Testphase (Trial) ─────────────────────────────────────────────────────────
// Standard 30 Tage; über die HausMatch-Kooperation 90 Tage ("drei Monate gratis").
export function trialDays(referralSource: string | null | undefined): number {
  return referralSource === "hausmatch" ? 90 : 30;
}

// Neues Trial-Ende: um `days` verlängern, Basis ist das spätere von jetzt/aktuellem
// Ende (eine noch laufende Testphase wird also nicht verkürzt).
export function computeTrialEnd(current: Date | null, now: Date, days: number): Date {
  const base = current && current.getTime() > now.getTime() ? current : now;
  return new Date(base.getTime() + days * 86_400_000);
}

// ── Rechnungs-Briefkopf des Betreibers ────────────────────────────────────────
export type PlatformIssuer = {
  legalName: string;
  contactLine: string; // Straße · PLZ Ort · E-Mail
  iban: string | null;
  bank: string | null;
  vatId: string | null;
};

// Briefkopf aus Env (PLATFORM_ISSUER_*), mit sinnvollen B&W-Fallbacks.
export function platformIssuer(): PlatformIssuer {
  const e = process.env;
  const name = e.PLATFORM_ISSUER_NAME || "B&W Immobilien Management UG";
  const street = e.PLATFORM_ISSUER_STREET || "";
  const zip = e.PLATFORM_ISSUER_ZIP || "";
  const city = e.PLATFORM_ISSUER_CITY || "";
  const email = e.PLATFORM_ISSUER_EMAIL || "";
  const contactLine = [street, [zip, city].filter(Boolean).join(" "), email]
    .filter(Boolean)
    .join(" · ");
  return {
    legalName: name,
    contactLine,
    iban: e.PLATFORM_ISSUER_IBAN || null,
    bank: e.PLATFORM_ISSUER_BANK || null,
    vatId: e.PLATFORM_ISSUER_VAT_ID || null,
  };
}

// ── Rechnungs-Helfer (pure, testbar) ──────────────────────────────────────────
// Anzeige-Nummer, z. B. BW-2026-0001.
export function formatInvoiceNumber(year: number, number: number): string {
  return `BW-${year}-${String(number).padStart(4, "0")}`;
}

// Cent → deutsche Währungsdarstellung (z. B. "1.234,50 €").
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
}
