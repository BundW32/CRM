// Gemeinsame Helfer für durchsuchbare/sortierbare Listen-Seiten.
// Serverseitig genutzt: Params aus `searchParams` lesen und daraus Prisma-
// `orderBy` bauen. Die Filter selbst (contains-Suche etc.) baut jede Seite
// domänenspezifisch – hier nur das, was wirklich überall gleich ist.

export type SortDir = "asc" | "desc";

/** Aktuelle Seite (1-basiert) robust aus einem String-Param lesen. */
export function parsePage(raw: string | undefined): number {
  return Math.max(1, Number.parseInt(raw ?? "1", 10) || 1);
}

/**
 * Sortierung aus `sort`/`dir` gegen eine erlaubte Feld-Liste auflösen.
 * `allowed` bildet den Param-Wert auf das Prisma-Feld ab (Whitelist – verhindert
 * beliebige Felder aus der URL). Fällt auf `defaultKey` zurück.
 */
export function resolveSort<A extends Record<string, string>>(
  raw: string | undefined,
  dirRaw: string | undefined,
  allowed: A,
  defaultKey: keyof A & string,
  defaultDir: SortDir = "desc",
): { key: keyof A & string; field: string; dir: SortDir } {
  // Der Typparameter hängt bewusst an `allowed`, nicht am Default: sonst würde
  // `key` auf den Default verengt und ein Vergleich mit den übrigen Schlüsseln
  // als unmöglich gemeldet.
  const key = (raw && raw in allowed ? raw : defaultKey) as keyof A & string;
  const dir: SortDir = dirRaw === "asc" || dirRaw === "desc" ? dirRaw : defaultDir;
  return { key, field: allowed[key], dir };
}

/** Prisma-orderBy aus einem aufgelösten Sort bauen (unterstützt verschachtelte Felder wie "property.name"). */
export function toOrderBy(field: string, dir: SortDir): Record<string, unknown> {
  const parts = field.split(".");
  return parts.reduceRight<Record<string, unknown>>((acc, p) => ({ [p]: acc }), dir as unknown as Record<string, unknown>);
}

/** Freitext trimmen; leere Suche → undefined (kein Filter). */
export function normalizeSearch(raw: string | undefined): string | undefined {
  const q = (raw ?? "").trim();
  return q.length > 0 ? q : undefined;
}

/**
 * Baut die `hrefFor`-Funktion für `<Pagination>`: der Link zu Seite `p` trägt
 * **alle** übrigen Params unverändert mit, damit Suche, Filter und Sortierung
 * beim Blättern erhalten bleiben.
 *
 * Bewusst zentral: diese Funktion stand zuvor gut zwanzigmal wortgleich in den
 * Seiten. Wer sie von Hand schreibt, vergisst irgendwann einen Param — dann
 * fällt beim Umblättern still ein Filter weg.
 *
 * @param basePath Pfad ohne Querystring, z. B. `/vorgaenge`.
 * @param sp       Die `searchParams` der Seite.
 * @param param    Name des Seiten-Params. Nur abweichen, wenn eine Seite
 *                 mehrere unabhängig blätterbare Listen trägt — sonst muss auch
 *                 die `FilterBar` über `pageParam` davon erfahren.
 */
export function pageHrefFor(
  basePath: string,
  sp: Record<string, string | undefined>,
  param = "page",
): (p: number) => string {
  return (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (v && k !== param) params.set(k, v);
    }
    if (p > 1) params.set(param, String(p));
    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };
}
