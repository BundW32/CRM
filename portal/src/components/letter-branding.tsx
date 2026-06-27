// Briefkopf & Fußzeile für gedruckte Schreiben (Zugangsschreiben etc.),
// org-spezifisch aus dem aufgelösten Branding.
import { OrgLogo } from "@/components/logo";
import type { OrgBranding } from "@/lib/branding";

export function LetterHead({
  branding,
  logoUrl,
}: {
  branding: OrgBranding;
  logoUrl: string;
}) {
  const cityLine = [branding.zip, branding.city].filter(Boolean).join(" ");
  return (
    <div className="mb-10 flex items-start justify-between">
      <OrgLogo src={logoUrl} alt={branding.displayName} className="h-20 w-auto" />
      <div className="text-right text-xs text-gray-500">
        <p className="font-semibold text-brand-green">{branding.legalName}</p>
        {branding.street ? <p>{branding.street}</p> : null}
        {cityLine ? <p>{cityLine}</p> : null}
        {branding.email ? <p>{branding.email}</p> : null}
        {branding.website ? <p>{branding.website}</p> : null}
      </div>
    </div>
  );
}

// Einzeilige Fußzeile „Firma · Adresse · E-Mail · Web" (leere Teile entfallen).
export function letterFooterLine(branding: OrgBranding): string {
  return [branding.legalName, branding.addressLine, branding.email, branding.website]
    .filter(Boolean)
    .join(" · ");
}
