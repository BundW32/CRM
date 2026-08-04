import Link from "next/link";
import type { User } from "@/generated/prisma/client";
import { CountUp } from "@/components/count-up";
import { Card, EmptyState, PageTitle, cardSurfaceClass } from "@/components/ui";
import { announcementWhereForUser, ownedProperties, propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDate, formatDateOnly } from "@/lib/labels";
import { classifyDue, dueLabel } from "@/lib/weg/compliance";
import { loadRoadmapAlle } from "@/lib/weg/roadmap";
import { loadSetupStatus, loadSetupStatusAlle } from "@/lib/weg/setup-status";
import { Roadmap } from "./Roadmap";
import { SetupGuide } from "./SetupGuide";

// Schnellzugriff-Buttons: klar lesbarer Marken-Kontrast (dunkelgrüner Text auf
// Weiß, oranger Rahmen/Hover) statt der früheren grau-in-grau-Optik („Ton in Ton").
const quickLinkClass =
  "inline-flex items-center rounded-lg border border-brand-orange/40 bg-white px-3 py-2 font-medium text-brand-green transition hover:border-brand-orange hover:bg-brand-orange-light hover:text-brand-orange-ink";

// WEG-fokussierte Übersicht für selbstverwaltete Gemeinschaften (interner
// Verwalter oder Eigentümer) – statt der professionellen Ticket-Statistik.
export async function SelfManagedDashboard({ user }: { user: User }) {
  const isAdmin = user.role === "VERWALTER";

  // WEG-Objekte des Nutzers bestimmen. Nach Name sortiert, nicht in
  // Datenbankreihenfolge: Alles, was daraus folgt – Einrichtungsstand,
  // Fahrplan, Reihenfolge der Karten – wäre sonst von Lauf zu Lauf anders.
  const props = isAdmin
    ? await db.property.findMany({
        where: { ...(await propertyWhereForVerwalter(user)), managementType: "WEG" },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : (await ownedProperties(user.id))
        .filter((p) => p.managementType === "WEG")
        .map((p) => ({ id: p.id, name: p.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "de"));
  const propIds = props.map((p) => p.id);

  // ── Einrichtung zuerst ────────────────────────────────────────────────────
  // Solange die WEG nicht eingerichtet ist, IST die Übersicht die Anleitung.
  // Zahlen und Aushänge daneben zu zeigen wäre sinnlos: Sie stünden alle auf
  // null, weil noch nichts da ist, was sie zählen könnten.
  //
  // Nur der verwaltende Eigentümer richtet ein; die übrigen sehen so lange,
  // wie weit die Gemeinschaft ist, ohne selbst hakeln zu können.
  //
  // Jedes Objekt hat seinen eigenen Stand. Vorher hing die ganze Übersicht am
  // ersten: War eines fertig, galt die Einrichtung als erledigt, und ein
  // zweites Objekt bekam nie eine Führung.
  const setups = await loadSetupStatusAlle(propIds);
  const offene = setups.filter((s) => !s.fertig);
  // Die Übersicht wird nur dann ganz zur Anleitung, wenn es noch **nichts**
  // Laufendes gibt. Steht ein Objekt schon im Betrieb, hat es Zahlen, Fristen
  // und Aushänge – die dürfen nicht verschwinden, weil ein zweites Objekt neu
  // hinzugekommen ist.
  if (offene.length === setups.length) {
    const setup = offene[0] ?? (await loadSetupStatus(null));
    const name = props[setups.indexOf(setup)]?.name;
    return (
      <>
        <PageTitle>Willkommen, {user.name}</PageTitle>
        {isAdmin ? (
          <SetupGuide status={setup} isAdmin objektName={props.length > 1 ? name : undefined} />
        ) : (
          // Miteigentümer sehen den Fortschritt, aber keine Verwaltungs-Links:
          // Die führten für sie ins Leere, weil die Stammdaten-Seiten der
          // Verwaltung vorbehalten sind.
          <Card title="Die Einrichtung läuft">
            <p className="text-sm text-gray-600">
              Ihre Gemeinschaft richtet die Verwaltung gerade ein – {setup.erledigt} von{" "}
              {setup.gesamt} Schritten sind erledigt. Sobald der Wirtschaftsplan beschlossen
              ist, finden Sie hier Ihr Hausgeld, die Abrechnungen und alle Beschlüsse.
            </p>
          </Card>
        )}
      </>
    );
  }

  const now = new Date();
  // Fällige/überfällige Prüfpflichten (Vorwarnfenster 30 Tage) im Scope.
  const dueHorizon = new Date(now.getTime());
  dueHorizon.setDate(dueHorizon.getDate() + 30);
  // Der Fahrplan ersetzt für die Verwaltung die reine Prüfpflichten-Liste – er
  // enthält sie und ordnet sie zwischen Abrechnung, Plan und Versammlung ein.
  // Miteigentümer bekommen ihn nicht: Seine Ziele sind Verwaltungsseiten.
  //
  // Über alle Objekte zusammengefasst, nach Dringlichkeit sortiert. Jeder
  // Eintrag trägt sein Objekt mit — auch für den eigenen Termin und den
  // Kalender-Export, die daran hängen.
  const roadmap = isAdmin && props.length > 0 ? await loadRoadmapAlle(props, now) : null;

  const [openResolutions, nextMeeting, openMotions, announcements, complianceDuties] = await Promise.all([
    db.resolution.count({ where: { propertyId: { in: propIds }, status: "OFFEN" } }),
    db.ownersMeeting.findFirst({
      where: { propertyId: { in: propIds }, status: { in: ["GEPLANT", "EINBERUFEN"] }, scheduledAt: { gte: now } },
      orderBy: { scheduledAt: "asc" },
      select: { id: true, title: true, scheduledAt: true },
    }),
    // Admin: eingereichte Anträge im Scope; Eigentümer: eigene offene Anträge.
    isAdmin
      ? db.ownerMotion.count({ where: { propertyId: { in: propIds }, status: "EINGEREICHT" } })
      : db.ownerMotion.count({ where: { submittedById: user.id, status: "EINGEREICHT" } }),
    db.announcement.findMany({
      where: await announcementWhereForUser(user),
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { property: true },
    }),
    db.maintenanceTask.findMany({
      where: {
        propertyId: { in: propIds },
        active: true,
        catalogKey: { not: null },
        dueDate: { lte: dueHorizon },
      },
      orderBy: { dueDate: "asc" },
      take: 6,
      include: { property: { select: { id: true, name: true } } },
    }),
  ]);

  const stats = [
    { label: "Offene Beschlüsse", value: openResolutions, href: "/beschluesse" },
    { label: isAdmin ? "Eingereichte Anträge" : "Meine offenen Anträge", value: openMotions, href: "/antraege" },
  ];

  return (
    <>
      <PageTitle>Willkommen, {user.name}</PageTitle>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={`relative overflow-hidden p-4 transition hover:shadow-md ${cardSurfaceClass}`}
          >
            <span className="absolute inset-x-0 top-0 h-1 bg-brand-orange" />
            <p className="text-3xl font-bold tracking-tight text-brand-green"><CountUp value={s.value} /></p>
            <p className="mt-1 text-xs font-medium text-gray-500">{s.label}</p>
          </Link>
        ))}
        <Link
          href="/versammlungen"
          className={`col-span-2 p-4 transition hover:shadow-md ${cardSurfaceClass}`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Nächste Versammlung</p>
          {nextMeeting ? (
            <>
              <p className="mt-1 text-base font-semibold text-gray-900">{nextMeeting.title}</p>
              <p className="text-sm text-gray-500">{formatDate(nextMeeting.scheduledAt)}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-gray-400">Keine geplant</p>
          )}
        </Link>
      </div>

      {/* Ein noch nicht eingerichtetes Objekt neben einem laufenden: Die
          Führung dafür gehört sichtbar nach oben, nicht weg. Genau dieser Fall
          ließ den Assistenten vorher verschwinden. */}
      {isAdmin && offene.length > 0 ? (
        <div className="mt-6">
          <SetupGuide
            status={offene[0]}
            isAdmin
            objektName={props[setups.indexOf(offene[0])]?.name}
          />
        </div>
      ) : null}

      {roadmap ? (
        <div className="mt-6">
          <Roadmap items={roadmap} properties={props} />
        </div>
      ) : null}

      {!roadmap && complianceDuties.length > 0 ? (
        <div className="mt-6">
          <Card title="Fällige Prüfpflichten">
            <ul className="space-y-2">
              {complianceDuties.map((t) => {
                const { days, status } = classifyDue(t.dueDate, now);
                const tone =
                  status === "overdue"
                    ? "text-red-600"
                    : status === "soon"
                      ? "text-orange-600"
                      : "text-gray-500";
                const inner = (
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-sm font-medium text-gray-800">{t.title}</span>
                    <span className={`text-xs font-medium ${tone}`}>
                      fällig {formatDateOnly(t.dueDate)} · {dueLabel(days)}
                    </span>
                  </div>
                );
                return (
                  <li key={t.id} className="border-b border-gray-50 pb-2 last:border-0">
                    {isAdmin && t.property ? (
                      <Link
                        href={`/verwaltung/weg/${t.property.id}/pruefpflichten`}
                        className="block hover:opacity-80"
                      >
                        {inner}
                        <span className="text-xs text-gray-400">{t.property.name}</span>
                      </Link>
                    ) : (
                      <>
                        {inner}
                        {t.property ? (
                          <span className="text-xs text-gray-400">{t.property.name}</span>
                        ) : null}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Schnellzugriff">
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/beschluesse" className={quickLinkClass}>Beschlüsse</Link>
            <Link href="/versammlungen" className={quickLinkClass}>Versammlungen</Link>
            <Link href="/antraege" className={quickLinkClass}>Anträge</Link>
            <Link href="/gemeinschaft" className={quickLinkClass}>Gemeinschaft</Link>
            {isAdmin ? (
              <Link
                href="/verwaltung"
                className="inline-flex items-center rounded-lg bg-brand-orange px-3 py-2 font-medium text-white shadow-sm transition hover:bg-brand-orange-dark"
              >
                WEG-Verwaltung
              </Link>
            ) : null}
          </div>
        </Card>

        <Card title="Aushänge">
          {announcements.length === 0 ? (
            <EmptyState>Keine aktuellen Aushänge.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {announcements.map((a) => (
                <li key={a.id} className="border-b border-gray-50 pb-2 last:border-0">
                  <p className="text-sm font-medium text-gray-800">{a.title}</p>
                  <p className="text-xs text-gray-400">{a.property?.name} · {formatDate(a.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
