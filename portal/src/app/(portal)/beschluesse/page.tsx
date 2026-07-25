import { redirect } from "next/navigation";
import { Pagination, Alert, Card, EmptyState, Field, PageTitle, buttonClass, buttonSecondaryClass, inputClass } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { ownedProperties, propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDate, resolutionStatusLabels, voteChoiceLabels } from "@/lib/labels";
import { propertyScopeFilters } from "@/lib/list-filters";
import { normalizeSearch, parsePage } from "@/lib/list-query";
import { requireUser } from "@/lib/session";
import {
  computeOutcome,
  weightFor,
  MAJORITY_LABELS,
  type MajorityType,
  type OutcomeResult,
} from "@/lib/weg-voting";
import {
  castVote,
  castVoteForOwner,
  closeResolution,
  createResolution,
  deleteResolution,
  withdrawResolution,
} from "./actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

const statusTone: Record<string, string> = {
  OFFEN: "bg-blue-100 text-blue-800",
  ANGENOMMEN: "bg-green-100 text-green-800",
  ABGELEHNT: "bg-red-100 text-red-700",
  ZURUECKGEZOGEN: "bg-gray-200 text-gray-700",
};

// Zusammenfassung einer Abstimmung: Kopf-Zählung, Gewichtung nach Stimmprinzip,
// erforderliche Mehrheit und (bei laufenden) der berechnete Ergebnis-Vorschlag.
function VoteSummary({
  rawVotes,
  outcome,
  principle,
  majority,
  eligible,
  eligibleMea,
  showSuggestion,
}: {
  rawVotes: { choice: "JA" | "NEIN" | "ENTHALTUNG" }[];
  outcome: OutcomeResult;
  principle: string;
  majority: MajorityType;
  eligible: number;
  eligibleMea: number;
  showSuggestion: boolean;
}) {
  const head = (c: string) => rawVotes.filter((v) => v.choice === c).length;
  const weightLabel = principle === "MEA" ? "MEA" : principle === "OBJEKT" ? "Einheiten" : "";
  return (
    <div className="mt-2 space-y-0.5 text-xs text-gray-500">
      <p>
        Ja: <strong className="text-gray-800">{head("JA")}</strong> · Nein:{" "}
        <strong className="text-gray-800">{head("NEIN")}</strong> · Enthaltung:{" "}
        <strong className="text-gray-800">{head("ENTHALTUNG")}</strong> · abgegeben{" "}
        {rawVotes.length}
        {eligible > 0 ? ` von ${eligible} Eigentümern` : ""}
      </p>
      {principle !== "KOPF" ? (
        <p>
          Nach {weightLabel} – Ja: <strong className="text-gray-800">{outcome.ja}</strong> · Nein:{" "}
          <strong className="text-gray-800">{outcome.nein}</strong> · Enthaltung:{" "}
          <strong className="text-gray-800">{outcome.enthaltung}</strong>
          {principle === "MEA" && eligibleMea > 0 ? ` von ${eligibleMea} MEA` : ""}
        </p>
      ) : null}
      <p>
        Erforderlich: <strong className="text-gray-700">{MAJORITY_LABELS[majority]}</strong>
      </p>
      {showSuggestion ? (
        <p>
          Voraussichtlich:{" "}
          <strong className={outcome.suggestion === "ANGENOMMEN" ? "text-green-700" : "text-red-700"}>
            {outcome.suggestion === "ANGENOMMEN" ? "Angenommen" : "Abgelehnt"}
          </strong>
          {!outcome.reliable ? (
            <span className="ml-1 text-amber-600">(unverbindlich – Daten prüfen)</span>
          ) : null}
        </p>
      ) : null}
      {outcome.warnings.map((w, i) => (
        <p key={i} className="text-amber-600">
          {w}
        </p>
      ))}
    </div>
  );
}

export default async function BeschluessePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  if (user.role !== "VERWALTER" && user.role !== "EIGENTUEMER") {
    redirect("/dashboard");
  }
  const params = await searchParams;
  const { fehler } = params;
  const currentPage = parsePage(params.page);
  const isVerwalter = user.role === "VERWALTER";

  let scopeWhere: Record<string, unknown> = {};
  if (isVerwalter) {
    const propWhere = await propertyWhereForVerwalter(user);
    scopeWhere = { property: propWhere };
  } else {
    // Defense-in-Depth: Eigentum zusätzlich auf die eigene Org einschränken.
    const props = (await ownedProperties(user.id)).filter(
      (p) => p.organizationId === user.organizationId,
    );
    scopeWhere = { propertyId: { in: props.map((p) => p.id) } };
  }

  // ── Filter: Suche und Objekt (Status trennt die Seite bereits selbst) ──
  // Einheit entfällt: ein Beschluss betrifft immer das ganze Objekt.
  const scope = await propertyScopeFilters(user, params, { withUnit: false });
  const q = normalizeSearch(params.q);

  const baseAnd: Record<string, unknown>[] = [scopeWhere];
  if (q) {
    baseAnd.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (scope.objektId) baseAnd.push({ propertyId: scope.objektId });
  const baseWhere = { AND: baseAnd };
  const hasFilter = Boolean(q || scope.active);

  const include = { property: true, votes: { include: { user: true, castBy: true } } } as const;
  // Laufende Abstimmungen IMMER vollständig laden (nie paginieren – sonst könnte
  // eine ältere offene Abstimmung auf Seite 2 rutschen und übersehen werden).
  // Nur die entschiedenen Beschlüsse werden paginiert.
  const [open, decidedTotal, decided] = await Promise.all([
    db.resolution.findMany({
      where: { ...baseWhere, status: "OFFEN" },
      orderBy: { createdAt: "desc" },
      include,
    }),
    db.resolution.count({ where: { ...baseWhere, status: { not: "OFFEN" } } }),
    db.resolution.findMany({
      where: { ...baseWhere, status: { not: "OFFEN" } },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include,
    }),
  ]);
  const resolutions = [...open, ...decided];
  const totalPages = Math.max(1, Math.ceil(decidedTotal / PAGE_SIZE));

  // Paginierung muss alle aktiven Filter mittragen.
  function pageHref(p: number) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v && k !== "page") sp.set(k, v);
    }
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `/beschluesse${qs ? `?${qs}` : ""}`;
  }

  const propIds = [...new Set(resolutions.map((r) => r.propertyId))];
  const ownerCounts = await db.ownership.groupBy({
    by: ["propertyId"],
    where: { propertyId: { in: propIds } },
    _count: { _all: true },
  });
  const ownerCountMap = new Map(ownerCounts.map((o) => [o.propertyId, o._count._all]));

  // Stimmgewichte je Eigentümer/Objekt (MEA für Wertprinzip, voteUnits für
  // Objektprinzip) + MEA-Summe je Objekt (für die doppelt qualifizierte Mehrheit).
  const ownershipData = await db.ownership.findMany({
    where: { propertyId: { in: propIds } },
    select: { propertyId: true, userId: true, mea: true, voteUnits: true, user: { select: { name: true } } },
  });
  // Eigentümer je Objekt (für die stellvertretende Stimmabgabe des Verwalters).
  const ownersByProp = new Map<string, { id: string; name: string }[]>();
  if (isVerwalter) {
    for (const o of ownershipData) {
      const list = ownersByProp.get(o.propertyId) ?? [];
      if (!list.some((e) => e.id === o.userId)) {
        list.push({ id: o.userId, name: o.user.name });
        ownersByProp.set(o.propertyId, list);
      }
    }
  }
  const ownerInfo = new Map<string, { mea: number | null; voteUnits: number | null }>();
  const meaTotalMap = new Map<string, number>();
  // Objekte, bei denen NICHT für jeden Eigentümer ein MEA hinterlegt ist – dann
  // ist die „Hälfte aller MEA"-Prüfung (doppelt qualifiziert) nicht belastbar.
  const meaIncompleteSet = new Set<string>();
  for (const o of ownershipData) {
    ownerInfo.set(`${o.propertyId}:${o.userId}`, { mea: o.mea, voteUnits: o.voteUnits });
    if (o.mea != null) {
      meaTotalMap.set(o.propertyId, (meaTotalMap.get(o.propertyId) ?? 0) + o.mea);
    } else {
      meaIncompleteSet.add(o.propertyId);
    }
  }

  // Pro Beschluss: Stimmen nach Stimmprinzip gewichten und Ergebnis vorberechnen.
  // Stimmen von Nutzern, die am Objekt kein aktuelles Eigentum (mehr) haben,
  // werden nicht gewertet (z. B. nach Eigentümerwechsel während der Abstimmung).
  function outcomeFor(r: (typeof resolutions)[number]): OutcomeResult {
    const currentVotes = r.votes.filter((v) => ownerInfo.has(`${r.propertyId}:${v.userId}`));
    const exOwnerCount = r.votes.length - currentVotes.length;
    const weighted = currentVotes.map((v) => {
      const info = ownerInfo.get(`${r.propertyId}:${v.userId}`) ?? { mea: null, voteUnits: null };
      const { weight, missing } = weightFor(r.property.votingPrinciple, info);
      return { choice: v.choice, weight, missingWeight: missing };
    });
    const meaJa = currentVotes
      .filter((v) => v.choice === "JA")
      .reduce((s, v) => s + (ownerInfo.get(`${r.propertyId}:${v.userId}`)?.mea ?? 0), 0);
    const result = computeOutcome({
      votes: weighted,
      majority: r.majority,
      meaJa,
      meaTotal: meaTotalMap.get(r.propertyId) ?? 0,
      meaIncomplete: meaIncompleteSet.has(r.propertyId),
      eligibleCount: ownerCountMap.get(r.propertyId) ?? 0,
      ballotsCast: currentVotes.length,
    });
    if (exOwnerCount > 0) {
      return {
        ...result,
        reliable: false,
        warnings: [
          ...result.warnings,
          `${exOwnerCount} Stimme(n) ehemaliger Eigentümer wurden nicht gewertet.`,
        ],
      };
    }
    return result;
  }

  // Objekte, deren Eigentümer der aktuelle Nutzer ist → darf dort mitstimmen
  // (rollenunabhängig; interner Verwalter = Verwalter UND Eigentümer).
  const myOwnership = await db.ownership.findMany({
    where: { userId: user.id, propertyId: { in: propIds } },
    select: { propertyId: true },
  });
  const ownedIds = new Set(myOwnership.map((o) => o.propertyId));

  // Nur WEG-Objekte können Umlaufbeschlüsse haben
  const properties = isVerwalter
    ? await db.property.findMany({ where: { ...await propertyWhereForVerwalter(user), managementType: "WEG" }, orderBy: { name: "asc" } })
    : [];

  return (
    <>
      <PageTitle
        action={
          <a href="/beschluesse/sammlung" className={buttonSecondaryClass}>
            Beschluss-Sammlung
          </a>
        }
      >
        Beschlüsse &amp; Abstimmungen
      </PageTitle>

      {fehler ? (
        <Alert variant="error" className="mb-4">
          {fehler === "keinweg"
            ? "Umlaufbeschlüsse sind nur für WEG-Objekte möglich."
            : fehler === "frist"
              ? "Die Abstimmungsfrist ist abgelaufen bzw. liegt in der Vergangenheit."
              : fehler === "geschlossen"
                ? "Die Abstimmung wurde soeben geschlossen – Ihre Stimme wurde nicht mehr gewertet."
                : fehler === "ergebnis"
                ? "Bitte ein Ergebnis (angenommen/abgelehnt) auswählen."
                : fehler === "eigentuemer"
                ? "Für die stellvertretende Stimme muss ein Eigentümer des Objekts gewählt werden."
                : fehler === "gefasst"
                  ? "Ein bereits gefasster Beschluss kann nicht gelöscht werden."
                  : "Bitte Objekt, Titel und Beschlusstext ausfüllen."}
        </Alert>
      ) : null}

      <FilterBar
        className="mb-5"
        searchPlaceholder="Suchen"
        searchHint="Nach Titel oder Beschlusstext suchen"
        comboboxes={scope.comboboxes}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
            Laufende Abstimmungen
          </h2>
          {open.length === 0 ? (
            <EmptyState>
              {hasFilter
                ? "Keine laufenden Abstimmungen für diese Filter."
                : "Derzeit keine laufenden Abstimmungen."}
            </EmptyState>
          ) : (
            open.map((r) => {
              const myVote = r.votes.find((v) => v.userId === user.id);
              const outcome = outcomeFor(r);
              const expired = r.deadline != null && r.deadline < new Date();
              return (
                <div
                  key={r.id}
                  id={r.id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{r.title}</h3>
                      <p className="text-xs text-gray-500">
                        {r.property.name}
                        {r.deadline ? ` · Frist: ${formatDate(r.deadline)}` : ""}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusTone[r.status]}`}
                    >
                      {resolutionStatusLabels[r.status]}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{r.description}</p>

                  <VoteSummary
                    rawVotes={r.votes}
                    outcome={outcome}
                    principle={r.property.votingPrinciple}
                    majority={r.majority}
                    eligible={ownerCountMap.get(r.propertyId) ?? 0}
                    eligibleMea={meaTotalMap.get(r.propertyId) ?? 0}
                    showSuggestion
                  />

                  {/* Frist abgelaufen: keine Stimmabgabe mehr möglich. */}
                  {expired ? (
                    <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-amber-600">
                      Frist abgelaufen – die Ergebnisfeststellung durch die Verwaltung steht aus.
                    </p>
                  ) : null}

                  {/* Abstimmen: jeder Eigentümer dieses Objekts (auch ein interner
                      Verwalter, der zugleich Eigentümer ist), solange die Frist läuft. */}
                  {ownedIds.has(r.propertyId) && !expired ? (
                    <form action={castVote} className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                      <input type="hidden" name="resolutionId" value={r.id} />
                      {myVote ? (
                        <p className="text-xs text-gray-600">
                          Ihre Stimme: <strong>{voteChoiceLabels[myVote.choice]}</strong> — Sie
                          können sie bis zum Abschluss ändern.
                        </p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2">
                        <select name="choice" required defaultValue={myVote?.choice ?? ""} className={`${inputClass} w-auto`}>
                          <option value="" disabled>
                            – Stimme wählen –
                          </option>
                          <option value="JA">Ja</option>
                          <option value="NEIN">Nein</option>
                          <option value="ENTHALTUNG">Enthaltung</option>
                        </select>
                        <input
                          type="text"
                          name="comment"
                          placeholder="Kommentar (optional)"
                          className={`${inputClass} w-auto flex-1`}
                        />
                        <button type="submit" className={buttonClass}>
                          {myVote ? "Stimme ändern" : "Abstimmen"}
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {/* Verwaltung (prof. oder interner Verwalter): Stimmen + Steuerung */}
                  {isVerwalter ? (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      {r.votes.length > 0 ? (
                        <ul className="mb-3 space-y-1 text-xs text-gray-500">
                          {r.votes.map((v) => (
                            <li key={v.id}>
                              {v.user.name}: <strong>{voteChoiceLabels[v.choice]}</strong>
                              {v.comment ? ` — ${v.comment}` : ""}
                              {v.castByUserId ? (
                                <span className="text-gray-400">
                                  {" "}· stellvertretend eingetragen
                                  {v.castBy ? ` von ${v.castBy.name}` : ""}
                                </span>
                              ) : null}
                              {v.proofStoredName ? (
                                <>
                                  {" "}·{" "}
                                  <a
                                    href={`/api/files/vote-proof/${v.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-brand-green hover:underline"
                                  >
                                    Nachweis
                                  </a>
                                </>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {/* Stellvertretende Stimmabgabe: Eigentümer, die die App nicht
                          nutzen, haben u. U. schriftlich abgestimmt (§ 25 WEG). */}
                      {!expired && (ownersByProp.get(r.propertyId)?.length ?? 0) > 0 ? (
                        <details className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <summary className="cursor-pointer text-xs font-medium text-gray-700">
                            Stimme für einen Eigentümer eintragen (schriftlich)
                          </summary>
                          <form action={castVoteForOwner} className="mt-2 space-y-2">
                            <input type="hidden" name="resolutionId" value={r.id} />
                            <div className="flex flex-wrap items-center gap-2">
                              <select name="ownerId" required defaultValue="" className={`${inputClass} w-auto`}>
                                <option value="" disabled>
                                  – Eigentümer –
                                </option>
                                {(ownersByProp.get(r.propertyId) ?? []).map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.name}
                                  </option>
                                ))}
                              </select>
                              <select name="choice" required defaultValue="" className={`${inputClass} w-auto`}>
                                <option value="" disabled>
                                  – Stimme –
                                </option>
                                <option value="JA">Ja</option>
                                <option value="NEIN">Nein</option>
                                <option value="ENTHALTUNG">Enthaltung</option>
                              </select>
                            </div>
                            <input
                              type="text"
                              name="comment"
                              placeholder="Kommentar (optional)"
                              className={inputClass}
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="file"
                                name="proof"
                                accept="image/*,application/pdf"
                                className="block max-w-full text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand-green hover:file:bg-gray-50"
                              />
                              <button type="submit" className={buttonSecondaryClass}>
                                Stimme eintragen
                              </button>
                            </div>
                            <p className="text-[11px] text-gray-400">
                              Nachweis optional (Bild/PDF des unterschriebenen Stimmzettels).
                            </p>
                          </form>
                        </details>
                      ) : null}
                      {/* Schließen mit Ergebnis-Feststellung: der berechnete
                          Vorschlag ist vorausgewählt, kann aber übersteuert werden. */}
                      <form action={closeResolution} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="id" value={r.id} />
                        <span className="text-xs text-gray-500">Feststellen als:</span>
                        <select
                          name="result"
                          defaultValue={outcome.suggestion}
                          className={`${inputClass} w-auto`}
                        >
                          <option value="ANGENOMMEN">Angenommen</option>
                          <option value="ABGELEHNT">Abgelehnt</option>
                        </select>
                        <button type="submit" className={buttonClass}>
                          Schließen
                        </button>
                      </form>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <form action={withdrawResolution}>
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className="text-xs text-gray-500 hover:underline">
                            Zurückziehen
                          </button>
                        </form>
                        <form action={deleteResolution}>
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className="text-xs text-red-600 hover:underline">
                            Löschen
                          </button>
                        </form>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}

          <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-gray-300">
            Beschlusssammlung
          </h2>
          {decided.length === 0 ? (
            <EmptyState>
              {hasFilter
                ? "Keine abgeschlossenen Beschlüsse für diese Filter."
                : "Noch keine abgeschlossenen Beschlüsse."}
            </EmptyState>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <ul className="divide-y divide-gray-100">
                {decided.map((r) => (
                  <li key={r.id} id={r.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {r.number ? `Nr. ${r.number} · ` : ""}
                        {r.title}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusTone[r.status]}`}
                      >
                        {resolutionStatusLabels[r.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {r.property.name}
                      {r.decidedAt ? ` · entschieden am ${formatDate(r.decidedAt)}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-gray-700">{r.description}</p>
                    <VoteSummary
                      rawVotes={r.votes}
                      outcome={outcomeFor(r)}
                      principle={r.property.votingPrinciple}
                      majority={r.majority}
                      eligible={ownerCountMap.get(r.propertyId) ?? 0}
                      eligibleMea={meaTotalMap.get(r.propertyId) ?? 0}
                      showSuggestion={false}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Pagination currentPage={currentPage} totalPages={totalPages} total={decidedTotal} hrefFor={pageHref} />
        </div>

        {isVerwalter ? (
          <Card title="Umlaufbeschluss starten">
            {properties.length === 0 ? (
              <p className="text-sm text-gray-500">
                Keine WEG-Objekte vorhanden. Legen Sie ein Objekt mit Verwaltungsart „WEG“ an,
                um Umlaufbeschlüsse zu starten.
              </p>
            ) : (
              <form action={createResolution} className="space-y-3">
                <Field label="Objekt (WEG)">
                  <select name="propertyId" required className={inputClass}>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Titel">
                  <input type="text" name="title" required minLength={3} className={inputClass} />
                </Field>
                <Field label="Beschlusstext">
                  <textarea name="description" required minLength={3} rows={6} className={inputClass} />
                </Field>
                <Field label="Erforderliche Mehrheit">
                  <select name="majority" defaultValue="EINFACH" className={inputClass}>
                    <option value="EINFACH">Einfache Mehrheit (Standard)</option>
                    <option value="DREIVIERTEL">Qualifizierte 3/4-Mehrheit</option>
                    <option value="DOPPELT_QUALIFIZIERT">
                      Doppelt qualifiziert (§21 II: 2/3 Stimmen + 1/2 MEA)
                    </option>
                    <option value="ALLSTIMMIG">Allstimmigkeit (alle Eigentümer)</option>
                  </select>
                </Field>
                <Field label="Frist (optional)">
                  <input type="date" name="deadline" className={inputClass} />
                </Field>
                <button type="submit" className={buttonClass}>
                  Abstimmung starten
                </button>
                <p className="text-xs text-gray-500">
                  Alle Eigentümer des Objekts werden per E-Mail zur Abstimmung eingeladen.
                </p>
              </form>
            )}
          </Card>
        ) : (
          <Card title="Hinweis">
            <p className="text-sm text-gray-600">
              Hier stimmen Sie über Umlaufbeschlüsse Ihrer Eigentümergemeinschaft ab. Ihre
              Stimme können Sie bis zum Abschluss der Abstimmung ändern.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
