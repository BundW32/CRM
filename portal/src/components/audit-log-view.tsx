import Link from "next/link";
import type { User } from "@/generated/prisma/client";
import { PageTitle, Pagination, Card } from "@/components/ui";
import { Badge, stack } from "@/components/data-display";
import { FilterBar, type FilterConfig } from "@/components/filter-bar";
import { db } from "@/lib/db";
import { pageHrefFor } from "@/lib/list-query";
import { type AuditAccess, type AuditParams } from "@/lib/audit-query";
import { auditActionLabels, auditFieldLabels, auditTargetLabels, auditTimestamp, auditValue } from "@/lib/audit-display";
import { auditAreas, auditChangeKind, auditFriendlyField, auditFriendlyValue, auditGroupSentence, auditSentence, auditSubject, type AuditEvent } from "@/lib/audit-presentation";
import { auditGroupPage, AUDIT_GROUP_PREVIEW } from "@/lib/audit-groups";
import { auditTargetLinks } from "@/lib/audit-links";

const origins: Record<string, string> = { USER: "Nutzer", SUPPORT: "Support / Stellvertretung", SYSTEM: "Systemprozess", CRAFTSMAN: "Handwerker", UNKNOWN: "Nicht erfasst" };

function EventDetails({ row, link }: { row: AuditEvent; link?: { href: string; label: string } }) {
  return <div className="mt-4 space-y-4 text-sm text-gray-700">
    {row.schemaVersion === 0 && <Badge tone="warning">Älterer Eintrag ohne vollständige Feldhistorie</Badge>}
    {!row.operation && <p className="text-gray-500">Aktionsmeldung · ergänzt die einzelnen Feldänderungen.</p>}
    {row.changes.length > 0 ? <dl className="space-y-4">
      {row.changes.map(change => <div key={change.field} className="border-l-2 border-gray-200 pl-3">
        <dt className="mb-2 flex flex-wrap items-center gap-2 font-semibold">
          {auditFriendlyField(change.field)} <Badge tone="neutral">{auditChangeKind(change)}</Badge>
        </dt>
        {change.field.endsWith("Changed") ? <dd>Vertraulicher Inhalt geändert. Der Inhalt selbst wird nicht protokolliert.</dd> :
          <dd className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="min-w-0"><span className="text-xs text-gray-500">Vorher</span><p className="whitespace-pre-wrap break-words">{auditFriendlyValue(change, "before")}</p></div>
            <div className="min-w-0"><span className="text-xs text-gray-500">Nachher</span><p className="whitespace-pre-wrap break-words">{auditFriendlyValue(change, "after")}</p></div>
          </dd>}
      </div>)}
    </dl> : <p className="text-gray-500">{row.schemaVersion === 0 ? "Für diesen älteren Eintrag wurden keine Vorher-/Nachher-Werte gespeichert." : "Für dieses Ereignis liegen keine freigegebenen Vorher-/Nachher-Werte vor."}</p>}
    {link && <div className="space-y-1"><Link prefetch={false} href={link.href} className="font-medium text-teal-700 underline">{link.label} →</Link><p className="text-xs text-gray-500">Öffnet den aktuellen Stand. Das Audit-Log zeigt den damaligen Änderungsstand.</p></div>}
    <details className="border-t border-gray-100 pt-3 text-xs text-gray-500">
      <summary className="cursor-pointer">Technische Angaben</summary>
      <div className="mt-3 space-y-2 break-all">
        <p>Aktion: {row.action} · Erfassung: {row.operation ? "Feldänderung" : "Aktionsmeldung"}</p>
        <p>Ereignis-ID: {row.id}</p><p>Datensatz: {row.targetId ?? "Nicht erfasst"}</p>
        <p>Person-ID: {row.actorId ?? "Nicht erfasst"} · Herkunft: {origins[row.actorKind] ?? "Nicht erfasst"}</p>
        {row.effectiveActorId && row.effectiveActorId !== row.actorId && <p>Vertretenes Konto: {row.effectiveActorId}</p>}
        {row.requestId && <p>Transaktionskennung: {row.requestId}</p>}
        {row.ip && <p>IP-Adresse: {row.ip}</p>}
        {row.changes.filter(c => c.field.endsWith("Id")).map(c => <p key={c.field}>{auditFieldLabels[c.field] ?? c.field}: {auditValue(c.field, c.before)} → {auditValue(c.field, c.after)}</p>)}
        {Object.entries(row.meta).map(([key, value]) => <p key={key}>{auditFieldLabels[key] ?? key}: {auditValue(key, value)}</p>)}
      </div>
    </details>
  </div>;
}

export async function AuditLogView({ user, access, sp, base }: { user?: User; access: AuditAccess; sp: AuditParams; base: string }) {
  const journal = access.owner || sp.view === "journal";
  const result = await auditGroupPage(access, sp);
  const links = user ? await auditTargetLinks(user, result.groups.flatMap(g => g.rows)) : new Map<string, { href: string; label: string }>();
  const propertyNames = new Map(access.properties.map(p => [p.id, p.name]));
  const organizations = access.platform ? await db.organization.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];
  const organizationNames = new Map(organizations.map(o => [o.id, o.name]));
  const params = new URLSearchParams(Object.entries(sp).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  params.delete("page");
  const href = (updates: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [key, value] of Object.entries(updates)) { if (value === null) p.delete(key); else p.set(key, value); }
    return `${base}?${p}`;
  };
  const viewHref = (view: string) => href({ view, action: null, target: null, area: null, group: null, request: null });
  const exportHref = (format: string) => { const p = new URLSearchParams(params); p.set("format", format); return `${base}/export?${p}`; };
  const filters: FilterConfig[] = [
    { key: "area", label: "Bereich", allLabel: "Alle Bereiche", primary: true, options: Object.entries(auditAreas).map(([value, area]) => ({ value, label: area.label })) },
    { key: "target", label: "Datensatzart", allLabel: "Alle Datensatzarten", options: Object.entries(auditTargetLabels).map(([value, label]) => ({ value, label })) },
    { key: "action", label: "Aktion", allLabel: "Alle Aktionen", options: Object.entries(auditActionLabels).map(([value, label]) => ({ value, label })) },
    { key: "origin", label: "Herkunft", options: Object.entries(origins).map(([value, label]) => ({ value, label })) },
    { key: "capture", label: "Erfassung", options: [{ value: "changes", label: "Feldänderungen" }, { value: "events", label: "Aktionsmeldungen" }, { value: "legacy", label: "Altbestand" }] },
  ];
  return <>
    <PageTitle back={access.owner || access.platform ? undefined : { href: "/verwaltung/einstellungen", label: "Einstellungen" }} action={
      <div className="flex flex-wrap gap-3 text-sm text-white underline"><a href={exportHref("csv")} download>CSV exportieren</a><a href={exportHref("json")} download>JSON exportieren</a></div>
    }>Audit-Log{access.platform ? " · Plattform" : ""}</PageTitle>
    <div className={stack}>
      <nav aria-label="Protokollansicht" className="flex flex-wrap gap-3">
        {access.security && <Link href={viewHref("security")} aria-current={!journal ? "page" : undefined} className={`rounded-lg px-4 py-2 text-sm ${!journal ? "bg-white font-semibold text-gray-900" : "text-white underline"}`}>Sicherheitsprotokoll</Link>}
        <Link href={viewHref("journal")} aria-current={journal ? "page" : undefined} className={`rounded-lg px-4 py-2 text-sm ${journal ? "bg-white font-semibold text-gray-900" : "text-white underline"}`}>Fachliches Änderungsjournal</Link>
      </nav>
      <p className="text-sm text-gray-300">{access.owner ? "Gemeinschaftsbezogene Änderungen Ihrer WEG. Personenbezogene Einzelvorgänge und Sicherheitsereignisse sind nicht Teil dieser Ansicht." : journal ? "Wer hat was geändert? Öffnen Sie einen Vorgang, um die Änderungen im Detail zu sehen." : "Anmeldungen, Berechtigungen, Kontosicherheit und Supportzugriffe im berechtigten Bereich."}</p>
      <FilterBar searchPlaceholder="Person oder Kennung suchen" searchHint="Durchsucht gespeicherte Personennamen, Datensatzkennungen und technische Aktionscodes; keine Volltextsuche in Buchungstexten."
        moreFiltersLabel="Weitere Filter" resetKeepParams={["view", "display"]} filters={filters}
        dateRange={{ fromKey: "from", toKey: "to", label: "Zeitraum (einschließlich)", wrap: true }}
        comboboxes={[
          ...(access.properties.length > 1 || sp.property ? [{ key: "property", label: "Objekt", placeholder: "Alle berechtigten Objekte", options: access.properties.map(p => ({ value: p.id, label: p.name })) }] : []),
          ...(access.platform ? [{ key: "organization", label: "Organisation", placeholder: "Alle Organisationen", options: organizations.map(o => ({ value: o.id, label: o.name })) }] : []),
        ]} />
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-300">
        <p>{result.total} {result.single ? result.total === 1 ? "Eintrag" : "Einträge" : result.total === 1 ? "Vorgang" : "Vorgänge"} · {result.eventCount} {result.eventCount === 1 ? "Einzelnachweis" : "Einzelnachweise"} im Filterergebnis</p>
        <Link href={href({ display: result.single ? null : "entries" })} className="underline">{result.single ? "Vorgänge zusammenfassen" : "Einträge einzeln anzeigen"}</Link>
      </div>
      {sp.group && <p className="text-sm text-gray-300">Ein ausgewählter Vorgang. <Link href={href({ group: null, display: null })} className="underline">Zurück zu allen Vorgängen</Link></p>}
      {(sp.request || sp.record || sp.actor) && <p className="text-sm text-gray-300">Zusätzliche Eingrenzung aus einem Detail-Link aktiv. <Link href={href({ request: null, record: null, actor: null })} className="underline">Eingrenzung entfernen</Link></p>}
      {!result.groups.length && <Card title="Keine passenden Einträge"><p className="text-sm text-gray-500">Für Ihre Auswahl und Ihren Berechtigungsbereich wurden keine Einträge gefunden. Versuchen Sie einen anderen Zeitraum oder weniger Filter.</p></Card>}
      {result.groups.map(group => {
        const first = group.rows[0];
        if (!first) return null;
        const grouped = group.count > 1;
        const title = grouped ? auditGroupSentence(group.rows, group.count) : auditSentence(first);
        const subject = !grouped ? auditSubject(first) : null;
        const types = [...new Set(group.rows.map(r => auditTargetLabels[r.targetType ?? ""] ?? "Ereignis"))];
        return <Card key={group.id}>
          <article className="min-w-0 space-y-2" aria-label={title}>
            <h2 className="break-words font-semibold text-gray-900">{title}</h2>
            {subject && <p className="break-words text-sm text-gray-700">{subject}</p>}
            {grouped && <p className="text-sm text-gray-500">{types.slice(0, 4).join(" · ")}{types.length > 4 ? " · weitere Bereiche" : ""}</p>}
            <p className="text-xs text-gray-500"><time dateTime={group.latest}>{auditTimestamp(new Date(group.latest))}</time>{" · "}{propertyNames.get(first.propertyId ?? "") ?? (first.propertyId ? "Zugeordnetes Objekt" : "Organisationsweit / Objekt nicht erfasst")}{access.platform && <> · {organizationNames.get(first.organizationId ?? "") ?? "Organisation nicht zugeordnet"}</>}</p>
            {first.actorKind === "SUPPORT" && <Badge tone="neutral">Supportzugriff / gegebenenfalls Stellvertretung</Badge>}
            <details className="pt-2">
              <summary className="cursor-pointer text-sm font-medium text-teal-700">{grouped ? "Zusammengehörige Änderungen ansehen" : first.operation ? "Was wurde geändert?" : "Ereignis ansehen"}</summary>
              {grouped ? <div className="mt-3 space-y-4">
                <p className="text-xs text-gray-500">Gemeinsame Transaktion. Angezeigt werden nur Einträge, die zu Ihren Filtern und Berechtigungen passen.</p>
                {group.rows.map(row => <details key={row.id} className="border-t border-gray-100 pt-3">
                  <summary className="cursor-pointer text-sm text-gray-800">{auditSentence(row)}{auditSubject(row) ? ` · ${auditSubject(row)}` : ""}</summary>
                  <p className="mt-2 text-xs text-gray-500">{auditTimestamp(new Date(row.createdAt))}</p>
                  <EventDetails row={row} link={links.get(row.id)} />
                </details>)}
                {group.count > AUDIT_GROUP_PREVIEW && <p className="text-sm text-gray-600">Vorschau: {AUDIT_GROUP_PREVIEW} von {group.count} Einträgen. <Link href={href({ group: group.id, display: "entries" })} className="text-teal-700 underline">Alle Einträge dieses Vorgangs durchblättern</Link></p>}
              </div> : <EventDetails row={first} link={links.get(first.id)} />}
            </details>
          </article>
        </Card>;
      })}
      <Pagination currentPage={result.page} totalPages={result.totalPages} total={result.total} hrefFor={pageHrefFor(base, sp)} />
      <details className="text-xs text-gray-400"><summary className="cursor-pointer">Hinweise zur Anzeige und zum Export</summary><p className="mt-2">Zeitangaben: Europe/Berlin. Nur eindeutig zusammengehörige Einträge werden gebündelt. Ältere Einträge ohne Zuordnung bleiben einzeln; fehlende Angaben werden nicht nachträglich erfunden. Exporte enthalten die gefilterten Einzelnachweise, nicht nur die Zusammenfassungen (maximal 10.000 Einträge). Beträge sind Änderungsstände und dürfen nicht als Buchungssumme addiert werden.</p></details>
    </div>
  </>;
}
