import type { DocumentCategory, Audience } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { saveBuffer, DOCUMENT_TYPES } from "@/lib/storage";
import { notifyDocumentPublished } from "@/lib/notify";
import { googleDriveConnector } from "./google-drive";
import type { DocumentConnector } from "./types";

const connectors: Record<string, DocumentConnector> = {
  GDRIVE: googleDriveConnector,
};

export type SyncResult = {
  configId: string;
  label: string;
  imported: number;
  skipped: number;
  errors: string[];
};

export async function syncDocumentSource(
  configId: string,
  triggeredById: string
): Promise<SyncResult> {
  const config = await db.documentSourceConfig.findUnique({ where: { id: configId } });
  const result: SyncResult = {
    configId,
    label: config?.label ?? configId,
    imported: 0,
    skipped: 0,
    errors: [],
  };

  if (!config || !config.active) {
    result.errors.push("Quelle nicht gefunden oder inaktiv.");
    return result;
  }

  const connector = connectors[config.source];
  if (!connector) {
    result.errors.push(`Kein Connector für Quelle: ${config.source}`);
    return result;
  }

  try {
    const files = await connector.listFiles(config.config as Record<string, unknown>);

    for (const file of files) {
      // Nur erlaubte Dokumenttypen importieren (PDFs + Bilder)
      if (!DOCUMENT_TYPES.includes(file.mimeType)) {
        result.skipped++;
        continue;
      }

      // Deduplizierung über externe ID
      const exists = await db.document.findFirst({
        where: { externalRef: file.id },
        select: { id: true },
      });
      if (exists) {
        result.skipped++;
        continue;
      }

      try {
        const buffer = await connector.downloadFile(
          file.id,
          config.config as Record<string, unknown>
        );
        const upload = await saveBuffer(buffer, file.name, file.mimeType, DOCUMENT_TYPES);
        const title = file.name.replace(/\.[^/.]+$/, ""); // Dateiendung als Titel weglassen

        const doc = await db.document.create({
          data: {
            title,
            category: config.category as DocumentCategory,
            audience: config.audience as Audience,
            propertyId: config.propertyId ?? null,
            unitId: null,
            uploadedById: triggeredById,
            source: config.source,
            externalRef: file.id,
            ...upload,
          },
        });

        // Mieter/Eigentümer benachrichtigen (fire-and-forget, wie beim manuellen Upload)
        await notifyDocumentPublished(doc.id);
        result.imported++;
      } catch (err) {
        result.errors.push(
          `${file.name}: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`
        );
      }
    }
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : "Verbindungsfehler");
  }

  await db.documentSourceConfig
    .update({ where: { id: configId }, data: { lastSyncAt: new Date() } })
    .catch(() => {});

  return result;
}
