import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/sw-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "B&W Kundenportal",
  description:
    "Kundenportal der B&W Immobilien Management UG – für Mieter, Eigentümer und Verwaltung.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "B&W Portal",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

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
