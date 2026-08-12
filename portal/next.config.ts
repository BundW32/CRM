import type { NextConfig } from "next";

// Sicherheits-Header für alle Routen. CSP bewusst pragmatisch gehalten,
// damit Next.js (inline-Styles/Scripts) funktioniert, aber externe Quellen
// blockiert werden.
// Google-Ads-Tag (gtag.js). Ohne diese Freigaben wird das Skript von der CSP
// blockiert — und zwar lautlos für alle außer der Browser-Konsole. Bewusst nur
// die Hosts, die das Tag wirklich anspricht: das Skript selbst von
// googletagmanager.com, die Conversion-Meldungen an die Google-Domains. Sie
// stehen hier auch dann, wenn das Tag mangels Einwilligung nie lädt — eine
// nach Modus verzweigende CSP wäre schwerer zu prüfen als sie nützt.
const GOOGLE_ADS_SKRIPT = "https://www.googletagmanager.com";
const GOOGLE_ADS_ZIELE = [
  "https://www.googletagmanager.com",
  "https://www.google.com",
  "https://www.google.de",
  "https://googleads.g.doubleclick.net",
  "https://www.google-analytics.com",
].join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  `script-src 'self' 'unsafe-inline' ${GOOGLE_ADS_SKRIPT}`,
  // pdf.js rendert die Dokumentvorschau in einem Web Worker. Ohne worker-src
  // greift die Vorschau auf script-src zurück; der Blob-Fallback von pdf.js
  // bräuchte dann blob: und würde sonst still scheitern.
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `connect-src 'self' ${GOOGLE_ADS_ZIELE}`,
  // Das Conversion-Tag hängt für die Klick-Zuordnung einen unsichtbaren Rahmen
  // ein. Ohne eigenen `frame-src` griffe `default-src 'self'` und der Rahmen
  // bliebe leer.
  "frame-src 'self' https://td.doubleclick.net https://www.googletagmanager.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  // Kein `X-Powered-By: Next.js` im Antwort-Header. Der Header nennt
  // Angreifern das Framework samt Hauptversion, ohne irgendetwas zu leisten —
  // und Pruefwerkzeuge werten ihn als vermeidbare Preisgabe.
  poweredByHeader: false,
  // Die PDF-Erzeugung liest Schriften und Logo zur Laufzeit von der Platte
  // (lib/documents/kit/fonts.ts, lib/handover-pdf.ts). Die Ablauf-Verfolgung
  // erkennt das nicht von selbst — ohne diesen Eintrag fehlen die Dateien im
  // Serverless-Bundle und jede PDF-Erzeugung schlüge in der Produktion fehl,
  // während sie lokal läuft.
  outputFileTracingIncludes: {
    // Beide Produktlogos: Welches gebraucht wird, entscheidet APP_MODE erst
    // zur Laufzeit (lib/branding.ts → defaultLogoPath) — die Verfolgung sieht
    // das nicht und ließe das andere im Bundle fehlen.
    "/**": ["public/fonts/**/*.ttf", "public/bw-logo.png", "public/wegportal24-logo.png"],
  },
  experimental: {
    // Standard ist 1 MB – zu klein für Foto-Uploads vom Handy
    serverActions: {
      bodySizeLimit: "200mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
