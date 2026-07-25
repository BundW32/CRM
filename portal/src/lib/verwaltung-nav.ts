// Zentrales Menü-Modell für den Verwaltung-Bereich (professioneller Verwalter/Admin).
//
// Single source of truth für die neue Master-Detail-Führung: die Sidebar
// (`VerwaltungShell`) und potenziell weitere Ansichten leiten ihre Struktur aus
// dieser Datei ab – so bleibt die Gruppierung an einer Stelle pflegbar.
//
// Die eigentlichen Icons liegen im Client (`verwaltung-shell.tsx`) und werden über
// den `icon`-Schlüssel aufgelöst; hier bleibt das Modell frei von React/Lucide,
// damit es auch serverseitig ohne Client-Bundle nutzbar ist.

// Routen, die zur Verwaltungs-Arbeitsfläche gehören – inklusive der geteilten
// Bereiche außerhalb von /verwaltung. Bestimmt, wo die Sidebar erscheint und wo
// die Oberfläche die volle Bildschirmbreite nutzt.
export const VERWALTUNG_ROUTE_PREFIXES = [
  "/verwaltung",
  "/beschluesse",
  "/versammlungen",
  "/zaehler",
] as const;

export function isVerwaltungRoute(pathname: string): boolean {
  return VERWALTUNG_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export type VerwaltungIcon =
  | "objekte"
  | "nutzer"
  | "eigentuemer"
  | "kontakte"
  | "notizen"
  | "beschluesse"
  | "versammlungen"
  | "weg"
  | "zaehler"
  | "wartung"
  | "uebergabe"
  | "branding"
  | "integrationen"
  | "quellen"
  | "abrechnung"
  | "audit";

export type VerwaltungNavItem = {
  href: string;
  title: string;
  desc: string;
  icon: VerwaltungIcon;
  /** Schlüssel für ein optionales Zähler-Badge (siehe `VerwaltungCounts`). */
  countKey?: string;
};

export type VerwaltungGroup = {
  label: string;
  /** Nur für SuperAdmins sichtbar (Einstellungen). */
  adminOnly?: boolean;
  items: VerwaltungNavItem[];
};

// Vollständige Gruppenstruktur (professioneller Verwalter). Reihenfolge = Anzeige.
const GROUPS: VerwaltungGroup[] = [
  {
    label: "Stammdaten",
    items: [
      {
        href: "/verwaltung/objekte",
        title: "Objekte",
        desc: "Objekte, Einheiten und Eigentümer verwalten",
        icon: "objekte",
        countKey: "objekte",
      },
      {
        href: "/verwaltung/nutzer",
        title: "Nutzer",
        desc: "Zugänge anlegen, einladen, Zugangsschreiben & DSGVO",
        icon: "nutzer",
        countKey: "nutzer",
      },
      {
        href: "/verwaltung/eigentuemer",
        title: "Eigentümer & MEA",
        desc: "Miteigentumsanteile und Stimmprinzip je WEG-Objekt (Eigentümerliste, CSV)",
        icon: "eigentuemer",
      },
      {
        href: "/verwaltung/kontakte",
        title: "Kontakte",
        desc: "Handwerker und Kontaktbuch (Mieter/Eigentümer)",
        icon: "kontakte",
        countKey: "kontakte",
      },
      {
        href: "/verwaltung/notizen",
        title: "Notizen",
        desc: "Interne Notizen zu Objekten, Einheiten und Personen",
        icon: "notizen",
      },
    ],
  },
  {
    label: "WEG",
    items: [
      {
        href: "/beschluesse",
        title: "Beschlüsse",
        desc: "Umlaufbeschlüsse & Abstimmungen der WEG, Beschluss-Sammlung",
        icon: "beschluesse",
      },
      {
        href: "/versammlungen",
        title: "Versammlungen",
        desc: "Eigentümerversammlungen: Einladung, Tagesordnung, Protokoll",
        icon: "versammlungen",
      },
      {
        href: "/verwaltung/weg",
        title: "WEG-Finanzen",
        desc: "Konten, Buchungen, Wirtschaftsplan, Hausgeld & offene Posten, CSV-Bankimport",
        icon: "weg",
      },
    ],
  },
  {
    label: "Betrieb",
    items: [
      {
        href: "/zaehler",
        title: "Zähler",
        desc: "Zählerstände erfassen und Verbrauch je Einheit/Objekt verwalten",
        icon: "zaehler",
      },
      {
        href: "/verwaltung/wartung",
        title: "Wartung",
        desc: "Wiederkehrende Wartungen & Prüfungen mit Fälligkeit",
        icon: "wartung",
        countKey: "wartung",
      },
      {
        href: "/uebergabe",
        title: "Wohnungsübergabe",
        desc: "Übergabeprotokoll digital erstellen, unterschreiben und als PDF exportieren",
        icon: "uebergabe",
      },
    ],
  },
  {
    label: "Einstellungen",
    adminOnly: true,
    items: [
      {
        href: "/verwaltung/branding",
        title: "Branding",
        desc: "Logo, Akzentfarbe und Impressum Ihrer Hausverwaltung",
        icon: "branding",
      },
      {
        href: "/verwaltung/integrationen",
        title: "Integrationen",
        desc: "Optionale API-Zugänge (Open Banking, Messdienst) — ohne Schlüssel gilt der manuelle Weg",
        icon: "integrationen",
      },
      {
        href: "/verwaltung/dokument-quellen",
        title: "Dokument-Quellen",
        desc: "Google Drive Ordner automatisch ins Dokumenten-Portal synchronisieren",
        icon: "quellen",
      },
      {
        href: "/verwaltung/abrechnung",
        title: "Abrechnung",
        desc: "Tarif, Status und Abonnement Ihrer Hausverwaltung",
        icon: "abrechnung",
      },
      {
        href: "/verwaltung/audit",
        title: "Audit-Log",
        desc: "Sicherheitsrelevante Aktionen (Login, DSGVO, Freigaben)",
        icon: "audit",
      },
    ],
  },
];

/**
 * Liefert die für den aktuellen Verwalter sichtbaren Menü-Gruppen.
 *
 * @param isSuperAdmin  Einstellungen-Gruppe nur für Admins.
 * @param hasWegObjekte WEG-Finanzen nur einblenden, wenn WEG-Objekte im Scope sind.
 */
export function verwaltungGroups({
  isSuperAdmin,
  hasWegObjekte,
}: {
  isSuperAdmin: boolean;
  hasWegObjekte: boolean;
}): VerwaltungGroup[] {
  return GROUPS.filter((g) => !g.adminOnly || isSuperAdmin).map((g) => {
    if (!hasWegObjekte && g.label === "WEG") {
      return { ...g, items: g.items.filter((i) => i.href !== "/verwaltung/weg") };
    }
    return g;
  });
}
