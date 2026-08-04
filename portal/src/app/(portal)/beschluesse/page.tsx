import Link from "next/link";
import { FileInput } from "@/components/file-input";
import { redirect } from "next/navigation";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { PendingButton } from "@/components/pending-button";
import {
  Pagination,
  Alert,
  Card,
  CollapsibleCard,
  EmptyState,
  PageTitle,
  buttonClass,
  buttonCompact,
  buttonDangerClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import {
  Badge,
  InlineFigures,
  KeyFigure,
  KeyFigures,
  type BadgeTone,
} from "@/components/data-display";
import { Begriff } from "@/components/begriff";
import { Tipp } from "@/components/tipp";
import { FilterBar, SortControl } from "@/components/filter-bar";
import { ownedProperties, propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDateOnly, resolutionStatusLabels, voteChoiceLabels } from "@/lib/labels";
import { propertyScopeFilters } from "@/lib/list-filters";
import { normalizeSearch, pageHrefFor, parsePage, resolveSort, toOrderBy } from "@/lib/list-query";
import { requireUser } from "@/lib/session";
import {
  computeOutcome,
  weightFor,
  MAJORITY_LABELS,
  type MajorityType,
  type OutcomeResult,
} from "@/lib/weg-voting";
import { FilePreviewLink } from "@/components/file-preview-link";
import {
  castVote,
  castVoteForOwner,
  closeResolution,
  deleteResolution,
  withdrawResolution,
} from "./actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

// Whitelist der Sortierfelder (verhindert beliebige Felder aus der URL).
const SORT_FIELDS = { datum: "createdAt", titel: "title", objekt: "property.name" } as const;

const sortOptions = [
  { value: "datum", label: "Datum" },
  { value: "titel", label: "Titel" },
  { value: "objekt", label: "Objekt" },
];

// Beschluss-Status als Ton des gemeinsamen Etiketts – vorher eine eigene
// Farbtabelle, die neben 60 weiteren im Portal stand.
const statusTone: Record<string, BadgeTone> = {
  OFFEN: "info",
  ANGENOMMEN: "success",
  ABGELEHNT: "danger",
  ZURUECKGEZOGEN: "neutral",
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
  compact = false,
}: {
  rawVotes: { choice: "JA" | "NEIN" | "ENTHALTUNG" }[];
  outcome: OutcomeResult;
  principle: string;
  majority: MajorityType;
  eligible: number;
  eligibleMea: number;
  showSuggestion: boolean;
  /**
   * Abgeschlossene Beschlüsse stehen zu dreißigst auf einer Seite. Große
   * Kennzahlen sind dort falsch: Sie machen die Liste unlesbar lang, obwohl die
   * Zahlen nur noch der Nachschau dienen. Bei laufenden Abstimmungen ist es
   * umgekehrt – da schaut man genau auf den Stand.
   */
  compact?: boolean;
}) {
  const head = (c: string) => rawVotes.filter((v) => v.choice === c).length;
  const weightLabel = principle === "MEA" ? "MEA" : principle === "OBJEKT" ? "Einheiten" : "";
  // Die Prognose braucht mindestens eine Stimme. Vorher rechnet sie zwar richtig,
  // sagt aber nichts – und „Voraussichtlich: Abgelehnt" unter einem Beschluss, über
  // den noch niemand abgestimmt hat, liest sich wie ein Ergebnis.
  const zeigeProgose = showSuggestion && rawVotes.length > 0;

  if (compact) {
    return (
      <p className="mt-2 text-xs text-gray-500">
        Ja: <strong className="text-good">{head("JA")}</strong> · Nein:{" "}
        <strong className="text-critical">{head("NEIN")}</strong> · Enthaltung:{" "}
        <strong className="text-gray-800">{head("ENTHALTUNG")}</strong>
        {eligible > 0 ? ` · ${rawVotes.length} von ${eligible} Eigentümern` : ""} ·
        Erforderlich: <strong className="text-gray-700">{MAJORITY_LABELS[majority]}</strong>
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-xl bg-gray-50 p-4">
      <KeyFigures>
        <KeyFigure label="Ja" value={head("JA")} tone="good" />
        <KeyFigure label="Nein" value={head("NEIN")} tone="critical" />
        <KeyFigure label="Enthaltung" value={head("ENTHALTUNG")} />
        <KeyFigure
          label="Beteiligung"
          value={eligible > 0 ? `${rawVotes.length}/${eligible}` : rawVotes.length}
          hint={eligible > 0 ? "Eigentümer" : undefined}
        />
      </KeyFigures>

      {principle !== "KOPF" ? (
        <p className="mt-3 text-xs text-gray-500">
          Nach {weightLabel} – Ja: <strong className="text-gray-800">{outcome.ja}</strong> · Nein:{" "}
          <strong className="text-gray-800">{outcome.nein}</strong> · Enthaltung:{" "}
          <strong className="text-gray-800">{outcome.enthaltung}</strong>
          {principle === "MEA" && eligibleMea > 0 ? ` von ${eligibleMea} MEA` : ""}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span>
          Erforderlich: <strong className="text-gray-700">{MAJORITY_LABELS[majority]}</strong>
        </span>
        {zeigeProgose ? (
          <>
            <span aria-hidden>·</span>
            <span>Voraussichtlich:</span>
            <Badge tone={outcome.suggestion === "ANGENOMMEN" ? "success" : "danger"}>
              {outcome.suggestion === "ANGENOMMEN" ? "Angenommen" : "Abgelehnt"}
            </Badge>
            {!outcome.reliable ? (
              <Badge tone="warning">unverbindlich – Daten prüfen</Badge>
            ) : null}
          </>
        ) : null}
      </div>

      {outcome.warnings.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-xs text-warn">
          {outcome.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      ) : null}
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
  const sort = resolveSort(params.sort, params.dir, SORT_FIELDS, "datum", "desc");
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

  // Die Versammlungs-Verknüpfung entscheidet über das Verfahren (siehe unten),
  // deshalb gehört sie in JEDE Abfrage dieser Seite.
  const include = {
    property: true,
    votes: { include: { user: true, castBy: true } },
    agendaItems: {
      select: {
        meeting: { select: { id: true, title: true, scheduledAt: true, status: true } },
      },
    },
  } as const;
  // Laufende Abstimmungen IMMER vollständig laden (nie paginieren – sonst könnte
  // eine ältere offene Abstimmung auf Seite 2 rutschen und übersehen werden).
  // Nur die entschiedenen Beschlüsse werden paginiert.
  const [open, decidedTotal, decided] = await Promise.all([
    db.resolution.findMany({
      where: { ...baseWhere, status: "OFFEN" },
      orderBy: toOrderBy(sort.field, sort.dir),
      include,
    }),
    db.resolution.count({ where: { ...baseWhere, status: { not: "OFFEN" } } }),
    db.resolution.findMany({
      where: { ...baseWhere, status: { not: "OFFEN" } },
      orderBy: toOrderBy(sort.field, sort.dir),
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include,
    }),
  ]);
  // ── Zwei Verfahren, die man nicht vermischen darf ──────────────────────────
  //
  // Ein Beschluss-Tagesordnungspunkt einer Versammlung legt sofort einen
  // Beschluss mit Status OFFEN an (`versammlungen/actions.ts`). Bis hierher sah
  // die Seite ihn nicht anders als einen Umlaufbeschluss: Er stand ganz oben
  // unter „Laufende Abstimmungen", trug eine Ergebnis-Prognose und – das war der
  // ernste Teil – ein Stimmformular für die Eigentümer. Damit konnte über einen
  // Punkt, der erst in der Versammlung nach Aussprache zu beschließen ist, vorab
  // abgestimmt werden. Das Gesetz trennt beides: Beschlussfassung in der
  // Versammlung (§ 23 Abs. 1 WEG) einerseits, Umlaufbeschluss mit eigenen
  // Anforderungen (§ 23 Abs. 3 WEG) andererseits.
  //
  // Nach der Versammlung ist die Trennung hinfällig – dann muss die Verwaltung
  // das dort gefasste Ergebnis eintragen können. Deshalb zählt nur eine noch
  // bevorstehende Versammlung (geplant oder einberufen).
  const bevorstehendeVersammlung = (r: (typeof open)[number]) =>
    r.agendaItems
      .map((a) => a.meeting)
      .find((m) => m.status === "GEPLANT" || m.status === "EINBERUFEN");

  const vorbereitet = open.filter((r) => bevorstehendeVersammlung(r));
  const laufend = open.filter((r) => !bevorstehendeVersammlung(r));

  const resolutions = [...open, ...decided];
  // Beide Listen stehen untereinander auf der Seite und tragen dieselbe
  // Sortierung – für die Sichtbarkeitsgrenze zählt deshalb ihre Summe.
  const resolutionTotal = open.length + decidedTotal;
  const totalPages = Math.max(1, Math.ceil(decidedTotal / PAGE_SIZE));

  const pageHref = pageHrefFor(`/beschluesse`, params);

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


  return (
    <>
      <PageTitle
        // Führt zur formellen Beschluss-Sammlung je WEG-Objekt mit PDF-Export
        // (§ 24 Abs. 7 WEG) – nicht zu verwechseln mit der Auflistung unten.
        action={
          <div className="flex flex-wrap items-center gap-2">
            {isVerwalter ? (
              <Link href="/beschluesse/neu" className={buttonClass}>
                Umlaufbeschluss starten
              </Link>
            ) : null}
            <Link href="/beschluesse/sammlung" className={buttonSecondaryClass}>
              Beschluss-Sammlung (PDF)
            </Link>
          </div>
        }
      >
        Beschlüsse &amp; Abstimmungen
      </PageTitle>

      {/* Die Unterscheidung der beiden Verfahren stand bisher nur im Quelltext.
          Für den Laien sind es zwei Knöpfe, die dasselbe zu tun scheinen — und
          der Unterschied entscheidet darüber, ob ein Beschluss wirksam ist. */}
      <Tipp className="mb-4">
        Hier stehen zwei Verfahren nebeneinander. Ein{" "}
        <Begriff name="umlaufbeschluss">Umlaufbeschluss</Begriff> wird ohne Versammlung
        schriftlich eingeholt. Über einen Tagesordnungspunkt einer geplanten Versammlung
        wird dagegen erst dort abgestimmt — er erscheint hier, lässt aber vorher keine
        Stimmabgabe zu.
      </Tipp>

      {fehler ? (
        <Alert variant="error" className="mb-4">
          {fehler === "keinweg"
            ? "Umlaufbeschlüsse sind nur für WEG-Objekte möglich."
            : fehler === "frist"
              ? "Die Abstimmungsfrist ist abgelaufen bzw. liegt in der Vergangenheit."
              : fehler === "versammlung"
              ? "Über diesen Punkt wird in der Versammlung abgestimmt, nicht vorab im Portal."
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

      {/* Sortiermenü nur für den Verwalter – er sieht Beschlüsse über viele
          Objekte hinweg; für Eigentümer ist die Datumsfolge die richtige. */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <FilterBar
          className="flex-1"
          searchPlaceholder="Suchen"
          searchHint="Nach Titel oder Beschlusstext suchen"
          comboboxes={scope.comboboxes}
        />
        <SortControl sortOptions={sortOptions} defaultSort="datum" total={resolutionTotal} />
      </div>

      <div className="space-y-4">
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
            Laufende Abstimmungen
          </h2>
          {laufend.length === 0 ? (
            <EmptyState>
              {hasFilter
                ? "Keine laufenden Abstimmungen für diese Filter."
                : "Derzeit keine laufenden Abstimmungen."}
            </EmptyState>
          ) : (
            laufend.map((r) => {
              const myVote = r.votes.find((v) => v.userId === user.id);
              const outcome = outcomeFor(r);
              const expired = r.deadline != null && r.deadline < new Date();
              return (
                <CollapsibleCard
                  key={r.id}
                  id={r.id}
                  // Offen, solange man selbst noch am Zug ist: Ein Eigentümer, der
                  // noch nicht abgestimmt hat, soll den Beschluss nicht erst
                  // aufklappen müssen. Wer schon gestimmt hat, und die Verwaltung,
                  // sehen die Kurzfassung – bei fünf laufenden Abstimmungen ist die
                  // ausgeklappte Ansicht sonst eine Bildschirmseite pro Beschluss.
                  defaultOpen={ownedIds.has(r.propertyId) && !myVote && !expired}
                  title={
                    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-gray-900">{r.title}</h3>
                        <p className="mt-0.5 text-xs font-normal text-gray-500">
                          {r.property.name}
                          {r.deadline ? ` · Frist: ${formatDateOnly(r.deadline)}` : ""}
                        </p>
                      </div>
                      {/* Der Stand gehört in die freie Mitte der Kopfzeile – dort war
                          bisher nur weiße Fläche, und die Zahlen sind das, wonach man
                          in einer Liste laufender Abstimmungen zuerst schaut. */}
                      <InlineFigures
                        items={[
                          {
                            label: "Ja",
                            value: r.votes.filter((v) => v.choice === "JA").length,
                            tone: "good",
                          },
                          {
                            label: "Nein",
                            value: r.votes.filter((v) => v.choice === "NEIN").length,
                            tone: "critical",
                          },
                          {
                            label: "Enthaltung",
                            value: r.votes.filter((v) => v.choice === "ENTHALTUNG").length,
                          },
                        ]}
                      />
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {ownedIds.has(r.propertyId) && !myVote && !expired ? (
                          <Badge tone="accent">Ihre Stimme fehlt</Badge>
                        ) : null}
                        <Badge tone={statusTone[r.status]} dot={r.status === "OFFEN"}>
                          {resolutionStatusLabels[r.status]}
                        </Badge>
                      </div>
                    </div>
                  }
                >
                  <p className="text-sm whitespace-pre-wrap text-gray-700">{r.description}</p>

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
                                  <FilePreviewLink
                                    src={`/api/files/vote-proof/${v.id}`}
                                    title="Stimmnachweis"
                                    className="text-brand-green hover:underline"
                                  >
                                    Nachweis
                                  </FilePreviewLink>
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
                              <FileInput
                                name="proof"
                                accept="image/*,application/pdf"
                              />
                              <PendingButton className={buttonSecondaryClass}>Stimme eintragen</PendingButton>
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
                        <PendingButton className={buttonClass}>Schließen</PendingButton>
                      </form>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <form action={withdrawResolution}>
                          <input type="hidden" name="id" value={r.id} />
                          <ConfirmActionButton
                            className={`${buttonSecondaryClass} ${buttonCompact}`}
                            confirmLabel="Wirklich zurückziehen?"
                            pendingLabel="Wird ausgeführt…"
                          >
                            Zurückziehen
                          </ConfirmActionButton>
                        </form>
                        <form action={deleteResolution}>
                          <input type="hidden" name="id" value={r.id} />
                          <ConfirmActionButton
                            className={`${buttonDangerClass} ${buttonCompact}`}
                            confirmLabel="Wirklich löschen?"
                            pendingLabel="Wird gelöscht…"
                          >
                            Löschen
                          </ConfirmActionButton>
                        </form>
                      </div>
                    </div>
                  ) : null}
                </CollapsibleCard>
              );
            })
          )}

          {/* Für eine Versammlung vorbereitet: sichtbar, aber ohne Stimmformular und
              ohne Prognose. Beschlossen wird in der Versammlung; von dort trägt die
              Verwaltung das Ergebnis ein. */}
          {vorbereitet.length > 0 ? (
            <>
              <h2 className="mt-6 text-sm font-semibold tracking-wide text-gray-300 uppercase">
                Für die nächste Versammlung vorbereitet
              </h2>
              <div className="space-y-3">
                {vorbereitet.map((r) => {
                  const m = bevorstehendeVersammlung(r)!;
                  return (
                    <Card key={r.id} id={r.id}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-gray-900">{r.title}</h3>
                          <p className="text-xs text-gray-500">
                            {r.property.name} · Versammlung am {formatDateOnly(m.scheduledAt)}
                          </p>
                        </div>
                        <Badge tone="info">Tagesordnungspunkt</Badge>
                      </div>
                      <p className="mt-3 text-sm whitespace-pre-wrap text-gray-700">
                        {r.description}
                      </p>
                      <p className="mt-3 text-xs text-gray-500">
                        Erforderlich:{" "}
                        <strong className="text-gray-700">{MAJORITY_LABELS[r.majority]}</strong> ·
                        Die Abstimmung findet in der Versammlung statt (§ 23 Abs. 1 WEG).
                      </p>
                      <div className="mt-3">
                        <Link
                          href={`/versammlungen/${m.id}`}
                          className={`${buttonSecondaryClass} ${buttonCompact}`}
                        >
                          Zur Versammlung „{m.title}&ldquo;
                        </Link>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          ) : null}

          <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-gray-300">
            Abgeschlossene Beschlüsse
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
                      <Badge tone={statusTone[r.status]}>
                        {resolutionStatusLabels[r.status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500">
                      {r.property.name}
                      {r.decidedAt ? ` · entschieden am ${formatDateOnly(r.decidedAt)}` : ""}
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
                      compact
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Pagination currentPage={currentPage} totalPages={totalPages} total={decidedTotal} hrefFor={pageHref} />
        </div>

        {/* Der Hinweis für Eigentümer bleibt – der Knopf oben rechts erscheint
            nur der Verwaltung, und ohne ihn wäre für Eigentümer nirgends erklärt,
            worum es auf dieser Seite geht. */}
        {!isVerwalter ? (
          <Card title="Hinweis">
            <p className="text-sm text-gray-600">
              Hier stimmen Sie über Umlaufbeschlüsse Ihrer Eigentümergemeinschaft ab. Ihre
              Stimme können Sie bis zum Abschluss der Abstimmung ändern.
            </p>
          </Card>
        ) : null}
      </div>
    </>
  );
}
