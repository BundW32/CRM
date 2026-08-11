import type { Metadata, Viewport } from "next";
import { EinwilligungBanner } from "@/components/einwilligung-banner";
import { GoogleAds } from "@/components/google-ads";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { TrackingSnippet } from "@/components/tracking-snippet";
import { isWegSaas } from "@/lib/app-mode";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

// Eine Codebasis, zwei Marken: Der Titel im Browser-Tab, der Name auf dem
// Startbildschirm und die Farbe der Statusleiste hängen am App-Modus. Ein
// festes `metadata`-Objekt hier hätte die SaaS-Variante dauerhaft „B&W
// Kundenportal" genannt – bis in den Tab-Titel und die installierte App.
// Seiten mit eigenem `metadata`-Export (etwa die Landing) überschreiben den
// Titel ohnehin; das hier ist der Rückfall für alles andere. Die Marke wird
// klein geschrieben – so, wie die Wortmarke sie zeigt.
export function generateMetadata(): Metadata {
  const weg = isWegSaas();
  return {
    // Basis für alle relativen Adressen in den Metadaten. Ohne sie kann Next
    // weder ein Canonical noch eine absolute og:image-Adresse bilden – beides
    // verlangen Suchmaschinen und soziale Netze absolut.
    metadataBase: new URL(siteUrl()),
    title: weg ? "wegportal24 – WEG selbst verwalten" : "B&W Kundenportal",
    description: weg
      ? "Portal für selbstverwaltete Wohnungseigentümergemeinschaften – " +
        "Wirtschaftsplan, Jahresabrechnung, Hausgeld, Versammlung und Beschlüsse an einem Ort."
      : "Kundenportal der B&W Immobilien Management UG – für Mieter, Eigentümer und Verwaltung.",
    // Selbstverweisendes Canonical für JEDE Seite. "./" löst Next gegen
    // metadataBase und den aktuellen Pfad auf – eine Zeile hier ersetzt einen
    // Eintrag je Route. Vorher hatte keine einzige Seite ein Canonical, womit
    // dieselbe Seite mit und ohne Schrägstrich und mit Query-Parametern als
    // mehrere Adressen zählte.
    alternates: { canonical: "./" },
    // Die B&W-Tür ist ein reines Kundenportal: nichts davon gehört in einen
    // Suchindex. wegportal24 dagegen ausdrücklich freigeben, mit großen
    // Vorschaubildern und ungekürzten Snippets.
    robots: weg
      ? {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        }
      : { index: false, follow: false, nocache: true },
    openGraph: {
      type: "website",
      locale: "de_DE",
      siteName: weg ? "wegportal24" : "B&W Kundenportal",
      url: "./",
    },
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

export function generateViewport(): Viewport {
  return { themeColor: isWegSaas() ? "#0b2239" : "#1a1512" };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Werbe-Tag und Einwilligungs-Banner gehören zusammen und gehören nur an die
  // wegportal24-Tür: Dort werden Anzeigen geschaltet. Das B&W-Kundenportal
  // wirbt nicht, ist nicht indexiert und bekäme mit dem Banner nur eine
  // Rückfrage ohne Anlass. In der Vorschau bleibt beides weg — sie soll weder
  // Konversionen melden noch Testklicks in die Kampagnenzahlen tragen (dieselbe
  // Regel gilt für das eigene Zählwerk, siehe tracking-snippet.tsx).
  const werbung = isWegSaas() && process.env.VERCEL_ENV !== "preview";

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
        {/* Cookiefreies First-Party-Tracking (kein Consent nötig, siehe
            components/tracking-snippet.tsx) — läuft unabhängig vom Banner. */}
        <TrackingSnippet />
        {/* Vor {children}: Das Tag muss sein `config` abgesetzt haben, bevor
            eine Seite darunter eine Konversion meldet. */}
        {werbung ? <GoogleAds /> : null}
        {children}
        {werbung ? <EinwilligungBanner /> : null}
      </body>
    </html>
  );
}
