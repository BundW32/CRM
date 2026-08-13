// Zentrales Menü-Modell des Portals — die eine Quelle für die Navigation aller Rollen.
//
// Die Menüführung ist Master-Detail: links eine gruppierte Bereichsliste, rechts der
// Inhalt. Wer einen neuen Menüpunkt einträgt, tut das HIER — nicht in `layout.tsx`.
//
// Die Icons liegen im Client (`app-shell.tsx`) und werden über den `icon`-Schlüssel
// aufgelöst; dieses Modell bleibt frei von React/Lucide, damit es auch serverseitig
// ohne Client-Bundle nutzbar ist.

import type { Role } from "@/generated/prisma/client";

export type NavIcon =
  | "dashboard"
  | "vorgaenge"
  | "nachrichten"
  | "aushaenge"
  | "dokumente"
  | "objekte"
  | "nutzer"
  | "eigentuemer"
  | "kontakte"
  | "notizen"
  | "beschluesse"
  | "versammlungen"
  | "antraege"
  | "gemeinschaft"
  | "finanzen"
  | "weg"
  | "zaehler"
  | "verbrauch"
  | "wartung"
  | "uebergabe"
  | "beirat"
  | "plattform"
  | "einstellungen"
  | "branding"
  | "integrationen"
  | "quellen"
  | "abrechnung"
  | "ablage"
  | "audit";

export type NavItem = {
  href: string;
  title: string;
  /** Kurzbeschreibung – genutzt in Übersichten (z. B. Einstellungs-Seite). */
  desc?: string;
  /**
   * Wen der Punkt überhaupt betrifft — für Einstellungen, die die meisten
   * Gemeinschaften nie brauchen.
   *
   * Die Einstellungsseite listet fünf Kacheln mit fachsprachlichen Untertiteln.
   * Ein Laie liest „Einbehalte anmelden — bis zum 10. des Folgemonats
   * (§ 48a EStG)" und schließt daraus, dass er etwas versäumt, wenn er es nicht
   * versteht. Dabei betrifft die Bauabzugsteuer nur, wer Bauleistungen oberhalb
   * bestimmter Schwellen bezahlt — für die allermeisten kleinen WEGs also nie.
   */
  nurWenn?: string;
  icon: NavIcon;
  /** Schlüssel für ein optionales Zähler-Badge (siehe `loadCounts`). */
  countKey?: string;
};

export type NavGroup = {
  /** Ohne Label erscheint die Gruppe ohne Überschrift (kurze Menüs). */
  label?: string;
  items: NavItem[];
};

export type NavContext = {
  role: Role;
  isSuperAdmin: boolean;
  isPlatformAdmin: boolean;
  selfManaged: boolean;
  /** Verwalter: gibt es WEG-Objekte im Zuständigkeitsbereich? */
  hasWegObjekte: boolean;
  /** Eigentümer: besitzt eine Einheit in einem WEG-Objekt? */
  ownsWeg: boolean;
  /** Eigentümer: Mitglied des Verwaltungsbeirats? */
  boardMember: boolean;
};

// ── Einstellungen ───────────────────────────────────────────────────────────
// Bewusst NICHT in der Hauptnavigation: Diese Punkte stellt man einmal ein und
// fasst sie monatelang nicht an. Sie liegen hinter dem Zahnrad am Fuß der Leiste
// und haben eine eigene Übersichtsseite. Hielte man sie oben, müsste die
// Hauptliste scrollen – und eine scrollende Navigation frisst ihren Vorteil auf.
export const SETTINGS_HREF = "/verwaltung/einstellungen";

/**
 * @param platformAdmin Betreiber-Konto (`isPlatformAdminUser`). Schaltet die
 *   Selbstprüfung der Dateiablage frei — eine Betriebsdiagnose, die einen
 *   Testupload schreibt und den Zustand des Blob-Stores nennt. Für eine
 *   Verwaltung wäre der Punkt nutzlos: Beheben kann ihn nur, wer an die
 *   Umgebungsvariablen kommt.
 */
export function settingsItems(selfManaged: boolean, platformAdmin = false): NavItem[] {
  return [
    ...(selfManaged
      ? [
          // Der Name der Gemeinschaft steht bei professionellen Verwaltungen
          // unter „Branding" – zwischen Logo, Farbe und Impressum, die dort
          // zusammengehören. Selbstverwaltete WEGs weist jene Seite ab, und
          // damit gab es für sie überhaupt keinen Weg zu ihrem eigenen Namen.
          {
            href: "/verwaltung/gemeinschaft",
            title: "Gemeinschaft",
            desc: "Name Ihrer WEG, wie er im Portal und auf Schreiben erscheint",
            icon: "branding" as const,
          },
          // Der Mustervertrag gehört zur Selbstverwaltung: Bei professionellen
          // Verwaltungen schließt die Gemeinschaft ihren Vertrag mit der
          // Verwaltung, nicht mit einem Miteigentümer.
          {
            href: "/verwaltung/verwaltervertrag",
            title: "Verwaltervertrag",
            desc: "Mustervertrag für die Bestellung eines Miteigentümers zum Verwalter — digital ausfüllen, nur noch unterschreiben",
            icon: "dokumente" as const,
          },
        ]
      : [
          {
            href: "/verwaltung/branding",
            title: "Branding",
            desc: "Logo, Akzentfarbe und Impressum Ihrer Hausverwaltung",
            icon: "branding" as const,
          },
        ]),
    {
      href: "/verwaltung/integrationen",
      title: "Integrationen",
      desc: "Optionale API-Zugänge (Open Banking, Messdienst) — ohne Schlüssel gilt der manuelle Weg",
      nurWenn: "Sie Kontoumsätze oder Zählerstände automatisch übernehmen möchten",
      icon: "integrationen",
    },
    ...(selfManaged
      ? []
      : [
          {
            href: "/verwaltung/dokument-quellen",
            title: "Dokument-Quellen",
            desc: "Google-Drive-Ordner automatisch ins Dokumenten-Portal synchronisieren",
            icon: "quellen" as const,
          },
        ]),
    {
      href: "/verwaltung/bauabzugsteuer",
      title: "Bauabzugsteuer",
      desc: "Einbehalte anmelden — bis zum 10. des Folgemonats (§ 48a EStG)",
      nurWenn: "Sie Bauleistungen beauftragen und mehr als 5.000 € im Jahr an eine Firma zahlen",
      icon: "abrechnung",
    },
    {
      href: "/verwaltung/basiszinssatz",
      title: "Basiszinssatz",
      desc: "Grundlage der Verzugszinsen bei säumigem Hausgeld (§ 247 BGB, halbjährlich)",
      nurWenn: "Sie Verzugszinsen für säumiges Hausgeld berechnen",
      icon: "abrechnung",
    },
    {
      href: "/verwaltung/abrechnung",
      title: "Abrechnung",
      desc: selfManaged
        ? "Tarif, Status und Abonnement Ihrer WEG"
        : "Tarif, Status und Abonnement Ihrer Hausverwaltung",
      icon: "abrechnung",
    },
    ...(platformAdmin
      ? [
          {
            href: "/verwaltung/ablage",
            title: "Dateiablage",
            desc: "Selbstprüfung: Token, Testupload, privater Blob-Store — mit Behebungsschritt",
            nurWenn: "Sie den Betrieb dieses Portals verantworten",
            icon: "ablage" as const,
          },
        ]
      : []),
    {
      href: "/verwaltung/audit",
      title: "Audit-Log",
      desc: "Sicherheitsrelevante Aktionen (Login, DSGVO, Freigaben)",
      nurWenn: "Sie nachvollziehen wollen, wer wann was geändert hat",
      icon: "audit",
    },
  ];
}

// ── Hauptnavigation je Rolle ────────────────────────────────────────────────

function verwalterGroups(ctx: NavContext): NavGroup[] {
  return [
    {
      label: "Alltag",
      items: [
        { href: "/dashboard", title: "Übersicht", icon: "dashboard" },
        { href: "/vorgaenge", title: "Vorgänge", icon: "vorgaenge" },
        { href: "/nachrichten", title: "Nachrichten", icon: "nachrichten" },
        { href: "/aushaenge", title: "Aushänge", icon: "aushaenge" },
        { href: "/dokumente", title: "Dokumente", icon: "dokumente" },
      ],
    },
    {
      label: "Stammdaten",
      items: [
        { href: "/verwaltung/objekte", title: "Objekte", icon: "objekte", countKey: "objekte" },
        // "Nutzer" ist bewusst NICHT mehr im Menü: Personen und Firmen stehen
        // gemeinsam unter "Kontakte", und hinter jedem Eintrag liegen dieselben
        // Einstellungen. Die Route bleibt bestehen, damit alte Links nicht brechen.
        { href: "/verwaltung/kontakte", title: "Kontakte", icon: "kontakte", countKey: "kontakte" },
        { href: "/verwaltung/eigentuemer", title: "Eigentümer & MEA", icon: "eigentuemer" },
        { href: "/verwaltung/notizen", title: "Notizen", icon: "notizen" },
      ],
    },
    {
      label: "WEG",
      items: [
        { href: "/beschluesse", title: "Beschlüsse", icon: "beschluesse" },
        { href: "/versammlungen", title: "Versammlungen", icon: "versammlungen" },
        ...(ctx.hasWegObjekte
          ? [{ href: "/verwaltung/weg", title: "WEG-Finanzen", icon: "weg" as const }]
          : []),
      ],
    },
    {
      label: "Betrieb",
      items: [
        { href: "/zaehler", title: "Zähler", icon: "zaehler" },
        { href: "/verwaltung/wartung", title: "Wartung", icon: "wartung", countKey: "wartung" },
        { href: "/uebergabe", title: "Wohnungsübergabe", icon: "uebergabe" },
      ],
    },
  ];
}

// Selbstverwaltete WEG: interner Verwalter aus der Eigentümergemeinschaft –
// ohne professionelle Werkzeuge (Vorgänge, Handwerker, Wartung, Übergabe).
function selfManagedVerwalterGroups(): NavGroup[] {
  return [
    {
      label: "Alltag",
      items: [
        { href: "/dashboard", title: "Übersicht", icon: "dashboard" },
        { href: "/nachrichten", title: "Nachrichten", icon: "nachrichten" },
        { href: "/aushaenge", title: "Aushänge", icon: "aushaenge" },
        { href: "/dokumente", title: "Dokumente", icon: "dokumente" },
      ],
    },
    {
      label: "Gemeinschaft",
      items: [
        { href: "/beschluesse", title: "Beschlüsse", icon: "beschluesse" },
        { href: "/versammlungen", title: "Versammlungen", icon: "versammlungen" },
        { href: "/antraege", title: "Anträge", icon: "antraege" },
        { href: "/gemeinschaft", title: "Gemeinschaft", icon: "gemeinschaft" },
      ],
    },
    {
      label: "Verwaltung",
      items: [
        { href: "/verwaltung/weg", title: "Finanzen & Buchhaltung", icon: "weg" },
        { href: "/verwaltung/objekte", title: "WEG-Objekt", icon: "objekte", countKey: "objekte" },
        { href: "/verwaltung/eigentuemer", title: "Eigentümer & Stimmrecht", icon: "eigentuemer" },
        { href: "/verwaltung/nutzer", title: "Zugänge", icon: "nutzer", countKey: "nutzer" },
        { href: "/zaehler", title: "Zähler", icon: "zaehler" },
        // Verwalter-Plus: Fragen an den zertifizierten Verwalter (§ 26a WEG).
        // Bewusst für ALLE selbstverwalteten WEGs sichtbar — ohne den Tarif
        // zeigt die Seite, was die Funktion kann, und den Weg zur Buchung;
        // gesperrt wird serverseitig (hatPlanFunktion), nie nur im Menü.
        { href: "/verwaltung/verwalter-tickets", title: "Verwalter-Tickets", icon: "vorgaenge" },
      ],
    },
  ];
}

// Eigentümer und Mieter haben wenige Punkte – dort wäre eine Gruppierung Ballast.
function eigentuemerItems(ctx: NavContext): NavItem[] {
  const wegItems: NavItem[] = ctx.ownsWeg
    ? [
        { href: "/beschluesse", title: "Beschlüsse", icon: "beschluesse" },
        { href: "/versammlungen", title: "Versammlungen", icon: "versammlungen" },
        ...(ctx.selfManaged
          ? [
              { href: "/antraege", title: "Anträge", icon: "antraege" as const },
              { href: "/gemeinschaft", title: "Gemeinschaft", icon: "gemeinschaft" as const },
            ]
          : []),
        { href: "/finanzen", title: "Finanzen", icon: "finanzen" },
      ]
    : [];

  return [
    { href: "/dashboard", title: "Übersicht", icon: "dashboard" },
    ...(ctx.selfManaged ? [] : [{ href: "/vorgaenge", title: "Vorgänge", icon: "vorgaenge" as const }]),
    ...wegItems,
    { href: "/zaehler", title: "Zähler", icon: "zaehler" },
    { href: "/verbrauch", title: "Verbrauch", icon: "verbrauch" },
    { href: "/nachrichten", title: "Nachrichten", icon: "nachrichten" },
    { href: "/aushaenge", title: "Aushänge", icon: "aushaenge" },
    { href: "/dokumente", title: "Dokumente", icon: "dokumente" },
    ...(ctx.boardMember ? [{ href: "/beirat", title: "Beirat", icon: "beirat" as const }] : []),
  ];
}

function mieterItems(): NavItem[] {
  return [
    { href: "/dashboard", title: "Übersicht", icon: "dashboard" },
    { href: "/vorgaenge", title: "Meine Vorgänge", icon: "vorgaenge" },
    { href: "/nachrichten", title: "Nachrichten", icon: "nachrichten" },
    { href: "/aushaenge", title: "Aushänge", icon: "aushaenge" },
    { href: "/dokumente", title: "Dokumente", icon: "dokumente" },
    { href: "/zaehler", title: "Zähler", icon: "zaehler" },
    { href: "/verbrauch", title: "Verbrauch", icon: "verbrauch" },
  ];
}

/**
 * Die Hauptnavigation für den angemeldeten Nutzer.
 *
 * Einstellungen sind bewusst NICHT enthalten – sie liegen hinter dem Zahnrad
 * (siehe `settingsItems`). Plattform-Betreiber bekommen ihren Bereich über das
 * Konto-Menü, nicht in die Arbeitsnavigation.
 */
export function navFor(ctx: NavContext): NavGroup[] {
  if (ctx.role === "VERWALTER") {
    return ctx.selfManaged ? selfManagedVerwalterGroups() : verwalterGroups(ctx);
  }
  if (ctx.role === "EIGENTUEMER") return [{ items: eigentuemerItems(ctx) }];
  if (ctx.role === "MIETER") return [{ items: mieterItems() }];
  // HANDWERKER haben kein Portalkonto mehr (Magic-Link per E-Mail auf
  // /auftraege/[token]); der Login ist gesperrt. Altbestände sehen daher nur
  // die Übersicht – eine Arbeitsnavigation gibt es für sie nicht.
  return [{ items: [{ href: "/dashboard", title: "Übersicht", icon: "dashboard" }] }];
}

/** Darf dieser Nutzer den Einstellungs-Bereich sehen? */
export function canSeeSettings(ctx: Pick<NavContext, "role" | "isSuperAdmin">): boolean {
  return ctx.role === "VERWALTER" && ctx.isSuperAdmin;
}

/** Zähler-Badges lohnen nur dort, wo es zählbare Bestände gibt. */
export function usesCounts(ctx: Pick<NavContext, "role">): boolean {
  return ctx.role === "VERWALTER";
}
