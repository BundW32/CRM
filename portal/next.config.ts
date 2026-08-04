import type { NextConfig } from "next";

// Sicherheits-Header für alle Routen. CSP bewusst pragmatisch gehalten,
// damit Next.js (inline-Styles/Scripts) funktioniert, aber externe Quellen
// blockiert werden.
const contentSecurityPolicy = [
  "default-src 'self'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "script-src 'self' 'unsafe-inline'",
  // pdf.js rendert die Dokumentvorschau in einem Web Worker. Ohne worker-src
  // greift die Vorschau auf script-src zurück; der Blob-Fallback von pdf.js
  // bräuchte dann blob: und würde sonst still scheitern.
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "connect-src 'self'",
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
