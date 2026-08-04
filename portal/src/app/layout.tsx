import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { isWegSaas } from "@/lib/app-mode";
import "./globals.css";

// Titel und Beschreibung hängen am Deployment, nicht am Code: Die WEG-SaaS
// tritt als wegportal24 auf, die B&W-Tür als Kundenportal. Ohne diese Weiche
// stünde „B&W Kundenportal" im Browser-Tab und in jedem Suchtreffer von
// wegportal24.de. Seiten mit eigenem `metadata`-Export (z. B. die Landing)
// überschreiben den Titel ohnehin – das hier ist der Rückfall für alles andere.
export function generateMetadata(): Metadata {
  const weg = isWegSaas();
  return {
    title: weg ? "wegportal24" : "B&W Kundenportal",
    description: weg
      ? "Portal für selbstverwaltete Wohnungseigentümergemeinschaften – Wirtschaftsplan, " +
        "Jahresabrechnung, Hausgeld, Versammlung und Beschlüsse an einem Ort."
      : "Kundenportal der B&W Immobilien Management UG – für Mieter, Eigentümer und Verwaltung.",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      title: weg ? "wegportal24" : "B&W Portal",
      statusBarStyle: "black-translucent",
    },
    // Titel und Beschreibung schalten längst nach Modus um — die Icons taten
    // es nicht. Auf wegportal24.de stand deshalb das B&W-Signet im Browser-Tab
    // und auf dem Homescreen, und bei 32 Pixeln ist davon nur ein Klecks übrig.
    icons: {
      icon: weg ? "/icon-wegportal24-192.png" : "/icon-192.png",
      shortcut: weg ? "/favicon-wegportal24.ico" : "/favicon-bw.ico",
      apple: weg ? "/apple-touch-icon-wegportal24.png" : "/apple-touch-icon.png",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#1a1512",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="h-full antialiased">
      <head>
        {/* Wichtigste Schriftschnitte vorladen – vermeidet FOIT/Layout-Shift */}
        <link rel="preload" href="/fonts/inter-400.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/inter-600.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/jakarta-700.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="bw-shell-bg flex min-h-full flex-col text-gray-100">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
