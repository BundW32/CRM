// Gemeinsame Begriffe der ⌘K-Suche – von Palette (Browser) und Abfrage
// (Server) genutzt.
//
// Bewusst getrennt von `portal-search-server.ts`: Dort hängen `db` und Prisma
// dran. Würde die Palette die Konstante von dort holen, zöge sie die gesamte
// Server-Kette ins Browser-Bündel und der Build bricht. Dieselbe Aufteilung wie
// bei `url.ts`/`url-server.ts` und `branding.ts`/`branding-server.ts`.

export type SearchGroup = "Objekte" | "Kontakte" | "Vorgänge";

export type SearchHit = {
  id: string;
  group: SearchGroup;
  title: string;
  /** Zweite Zeile – trennt Gleichnamiges voneinander. */
  subtitle: string;
  href: string;
};

/** Ab hier lohnt die Abfrage; kürzere Eingaben träfen fast alles. */
export const MIN_QUERY_LENGTH = 2;
