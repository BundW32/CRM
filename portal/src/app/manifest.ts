import type { MetadataRoute } from "next";
import { isWegSaas } from "@/lib/app-mode";

// Das Web-Manifest lag als statische Datei in `public/` und nannte in beiden
// Deployments „B&W Kundenportal" — wer wegportal24.de auf dem Homescreen
// ablegte, bekam also die Marke einer fremden Hausverwaltung aufs Gerät.
// Als Route liest es `APP_MODE` und antwortet passend.
// Zur Laufzeit auswerten statt beim Bauen vorzurechnen: `APP_MODE` entscheidet
// über die Marke, und diese Datei soll sich genauso verhalten wie Titel, Logo
// und Icons — sonst hängt eine Marke am Build und die übrigen an der Umgebung.
export const dynamic = "force-dynamic";

export default function manifest(): MetadataRoute.Manifest {
  const weg = isWegSaas();
  return {
    name: weg ? "wegportal24" : "B&W Kundenportal",
    short_name: weg ? "wegportal24" : "B&W Portal",
    description: weg
      ? "Portal für selbstverwaltete Wohnungseigentümergemeinschaften – Wirtschaftsplan, Jahresabrechnung, Hausgeld, Versammlung und Beschlüsse an einem Ort."
      : "Kundenportal der B&W Immobilien Management UG – Vorgänge, Dokumente, Nachrichten und mehr.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#1a1512",
    theme_color: "#1a1512",
    lang: "de",
    icons: [
      {
        src: weg ? "/icon-wegportal24-192.png" : "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: weg ? "/icon-wegportal24-512.png" : "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
