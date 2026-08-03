import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { isWegSaas } from "@/lib/app-mode";
import "./globals.css";

// Eine Codebasis, zwei Marken: Der Titel im Browser-Tab, der Name auf dem
// Startbildschirm und die Farbe der Statusleiste hängen am App-Modus. Ein
// festes `metadata`-Objekt hier hätte die SaaS-Variante dauerhaft „B&W
// Kundenportal" genannt – bis in den Tab-Titel und die installierte App.
export function generateMetadata(): Metadata {
  const weg = isWegSaas();
  return {
    title: weg ? "Wegportal24 – WEG selbst verwalten" : "B&W Kundenportal",
    description: weg
      ? "Wegportal24: Wirtschaftsplan, Hausgeld, Buchhaltung, Versammlung und " +
        "Jahresabrechnung für selbstverwaltete Eigentümergemeinschaften."
      : "Kundenportal der B&W Immobilien Management UG – für Mieter, Eigentümer und Verwaltung.",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      title: weg ? "Wegportal24" : "B&W Portal",
      statusBarStyle: "black-translucent",
    },
    icons: {
      icon: "/icon-192.png",
      apple: "/apple-touch-icon.png",
    },
  };
}

export function generateViewport(): Viewport {
  return { themeColor: isWegSaas() ? "#0b2239" : "#1a1512" };
}

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
