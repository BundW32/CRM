import { Alert, EmptyState, PageTitle } from "@/components/ui";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { PendingButton } from "@/components/pending-button";
import { db } from "@/lib/db";
import { propertyIdsForVerwalter, propertyWhereForVerwalter } from "@/lib/access";
import { requireVerwalter } from "@/lib/session";
import { createDocumentSourceConfig, deleteDocumentSourceConfig, triggerSync } from "./actions";

export const dynamic = "force-dynamic";

const audienceLabels: Record<string, string> = {
  ALLE: "Alle",
  MIETER: "Mieter",
  EIGENTUEMER: "Eigentümer",
};

const categoryLabels: Record<string, string> = {
  ABRECHNUNG: "Abrechnung",
  PROTOKOLL: "Protokoll",
  VERTRAG: "Vertrag",
  BESCHEINIGUNG: "Bescheinigung",
  SONSTIGES: "Sonstiges",
};

export default async function DokumentQuellenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const verwalter = await requireVerwalter();
  const params = await searchParams;

  // Scope-Filter: eingeschränkte Verwalter sehen nur Quellen ihrer Objekte
  // (globale Quellen ohne Objekt sind SuperAdmin vorbehalten).
  const allowedIds = await propertyIdsForVerwalter(verwalter);
  const configWhere =
    allowedIds === null
      ? { active: true }
      : { active: true, propertyId: { in: allowedIds } };

  const [configs, properties] = await Promise.all([
    db.documentSourceConfig.findMany({
      where: configWhere,
      include: { property: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.property.findMany({
      where: await propertyWhereForVerwalter(verwalter),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const gdriveReady = Boolean(process.env.GDRIVE_SERVICE_ACCOUNT_JSON);

  return (
    <>
      <PageTitle
        back={{ href: "/verwaltung/einstellungen", label: "Einstellungen" }}
      >
        Dokument-Quellen
      </PageTitle>

      <p className="mb-6 text-sm text-gray-500">
        Automatischer Sync von Google Drive Ordnern ins Dokumenten-Portal. Neue Dateien werden
        importiert und Mieter/Eigentümer benachrichtigt. Bereits importierte Dateien werden
        übersprungen.
      </p>

      {!gdriveReady && (
        <Alert variant="warning" className="mb-6">
          <strong>Hinweis:</strong> Die Umgebungsvariable{" "}
          <code className="rounded bg-amber-100 px-1">GDRIVE_SERVICE_ACCOUNT_JSON</code> ist nicht
          gesetzt — Google Drive Sync ist deaktiviert. Bitte ein Service-Account-JSON hinterlegen.
        </Alert>
      )}

      {params.fehler === "eingabe" && (
        <Alert variant="error" className="mb-4">
          Ungültige Eingabe. Bitte alle Pflichtfelder ausfüllen.
        </Alert>
      )}

      {params.sync === "ok" && (
        <Alert variant="success" className="mb-4">
          Sync abgeschlossen.{" "}
          {params.imported && Number(params.imported) > 0
            ? `${params.imported} neue Dokument(e) importiert.`
            : "Keine neuen Dokumente gefunden."}
        </Alert>
      )}

      {params.sync === "fehler" && (
        <Alert variant="error" className="mb-4">
          Sync mit Fehlern abgeschlossen.{" "}
          {params.imported && Number(params.imported) > 0
            ? `${params.imported} Dokument(e) importiert, aber einige Dateien konnten nicht verarbeitet werden.`
            : "Keine Dokumente importiert."}
        </Alert>
      )}

      {/* Bestehende Quellen */}
      {configs.length > 0 && (
        <div className="mb-8 space-y-3">
          {configs.map((cfg) => {
            const folderConfig = cfg.config as { folderId?: string };
            return (
              <div
                key={cfg.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{cfg.label}</p>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {cfg.property?.name ?? "Alle Objekte"} ·{" "}
                      {audienceLabels[cfg.audience] ?? cfg.audience} ·{" "}
                      {categoryLabels[cfg.category] ?? cfg.category} · Google Drive
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {cfg.lastSyncAt
                        ? `Letzter Sync: ${new Date(cfg.lastSyncAt).toLocaleString("de-DE")}`
                        : "Noch nie synchronisiert"}
                    </p>
                    {folderConfig.folderId && (
                      <p className="mt-1 truncate font-mono text-xs text-gray-300">
                        Ordner-ID: {folderConfig.folderId}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <form action={triggerSync}>
                      <input type="hidden" name="id" value={cfg.id} />
                      <button
                        type="submit"
                        disabled={!gdriveReady}
                        className="rounded-lg bg-brand-orange px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Sync starten
                      </button>
                    </form>
                    <form action={deleteDocumentSourceConfig}>
                      <input type="hidden" name="id" value={cfg.id} />
                      <ConfirmActionButton
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                        confirmLabel="Wirklich löschen?"
                        pendingLabel="Wird gelöscht…"
                      >
                        Löschen
                      </ConfirmActionButton>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {configs.length === 0 && (
        <div className="mb-6">
          <EmptyState>Noch keine Quellen konfiguriert.</EmptyState>
        </div>
      )}

      {/* Neue Quelle anlegen */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Neue Google Drive Quelle</h2>
        <form action={createDocumentSourceConfig} className="space-y-4">
          <input type="hidden" name="source" value="GDRIVE" />

          <div>
            <label className="block text-sm font-medium text-gray-700">Bezeichnung</label>
            <input
              name="label"
              required
              placeholder="z. B. Jahresabrechnungen Musterstraße 1"
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-brand-orange focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Google Drive Ordner-ID</label>
            <input
              name="folderId"
              required
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs"
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 font-mono text-sm focus:border-brand-orange focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-400">
              Die ID aus der Google Drive URL:{" "}
              <span className="font-mono">drive.google.com/drive/folders/</span>
              <strong>HIER</strong>
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Objekt{" "}
                <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <select
                name="propertyId"
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-brand-orange focus:outline-none"
              >
                <option value="">– kein Objekt –</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Empfänger</label>
              <select
                name="audience"
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-brand-orange focus:outline-none"
              >
                <option value="ALLE">Alle</option>
                <option value="MIETER">Mieter</option>
                <option value="EIGENTUEMER">Eigentümer</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Kategorie</label>
              <select
                name="category"
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-brand-orange focus:outline-none"
              >
                <option value="ABRECHNUNG">Abrechnung</option>
                <option value="PROTOKOLL">Protokoll</option>
                <option value="VERTRAG">Vertrag</option>
                <option value="BESCHEINIGUNG">Bescheinigung</option>
                <option value="SONSTIGES">Sonstiges</option>
              </select>
            </div>
          </div>

          <PendingButton className="rounded-xl bg-brand-orange px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90">Quelle anlegen</PendingButton>
        </form>
      </div>
    </>
  );
}
