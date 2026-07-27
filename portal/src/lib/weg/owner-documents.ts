// Erzeugte Finanzdokumente je Eigentümer ablegen.
//
// Bis hierher waren Einzelwirtschaftsplan und Einzelabrechnung reine
// Abruf-Dokumente: Der Verwalter konnte sie herunterladen, der Eigentümer sie
// unter „Finanzen" selbst ziehen. Wer nicht hinschaut, bekam nichts — und ein
// PDF, das niemand abruft, hilft keinem Eigentümer.
//
// **Wer bekommt was, und wann?**
//
// - *Einzelwirtschaftsplan* — mit dem **Beschluss** des Wirtschaftsplans. Das
//   ist die Fassung, die der Eigentümer aufbewahrt: „ab Januar zahle ich X, so
//   setzt es sich zusammen." Erst der Beschluss macht die Vorschüsse fällig
//   (§ 28 Abs. 1 WEG), vorher gibt es nichts abzulegen.
// - *Einzelabrechnung* — mit dem **Fertigstellen** der Jahresabrechnung. Das
//   ist der Moment, in dem sie versandfertig ist: Die Eigentümer müssen sie
//   **vor** der Versammlung prüfen können, denn dort wird über die
//   Abrechnungsspitze beschlossen (§ 28 Abs. 2 Satz 1 WEG). Sie erst danach zu
//   verteilen wäre zu spät; das PDF weist deshalb aus, dass der Beschluss noch
//   aussteht.
//
// Adressiert wird gezielt über `DocumentRecipient`: Sind Empfänger gesetzt,
// sieht **nur** diese Person das Dokument (siehe `documentWhereForUser`).
// Niemand bekommt den Einzelplan des Nachbarn zu Gesicht.
import { db } from "@/lib/db";
import { deleteBlob, saveBuffer } from "@/lib/storage";

/** Ein Dokument, das für genau eine Einheit erzeugt wurde. */
export type UnitDocument = {
  unitId: string;
  /** Bezeichnung der Einheit — nur für die Rückmeldung an den Verwalter. */
  unitLabel: string;
  fileName: string;
  title: string;
  pdf: Buffer;
};

export type AblageErgebnis = {
  erstellt: number;
  ersetzt: number;
  /** Übersprungene Einheiten (kein aktueller Eigentümer erfasst), mit Bezeichnung. */
  uebersprungen: { unitId: string; label: string }[];
};

// Interaktive Transaktionen laufen standardmäßig nach fünf Sekunden ab. Eine
// große Gemeinschaft hat schnell hundert Einheiten und damit dreihundert kleine
// Schreibvorgänge; der Abbruch mittendrin wäre der schlechteste Ausgang.
const TX_TIMEOUT_MS = 30_000;

/**
 * Legt je Einheit ein Dokument ab und adressiert es an die **aktuellen**
 * Eigentümer dieser Einheit.
 *
 * `refPrefix` macht den Vorgang wiederholbar: Ein zweiter Durchlauf ersetzt die
 * vorhandenen Dokumente, statt die Ablage zu verdoppeln. Ohne diesen Schlüssel
 * hätte eine Gemeinschaft nach drei Korrekturläufen drei Fassungen derselben
 * Abrechnung in ihren Dokumenten — und keine Angabe, welche gilt.
 *
 * Empfänger werden beim Ablegen **eingefroren**. Wechselt die Einheit später
 * den Eigentümer, sieht der neue nicht die Abrechnung seines Vorgängers: Er war
 * nicht ihr Adressat, und sie enthält dessen Zahlungsdaten.
 *
 * **Ohne erfassten Eigentümer wird nichts abgelegt.** Ein Dokument ohne gezielte
 * Empfänger fiele auf die `audience`-Logik zurück und wäre damit für *alle*
 * Eigentümer des Objekts sichtbar — mitsamt fremder Zahlungsdaten. Solche
 * Einheiten werden übersprungen und zurückgemeldet, damit der Verwalter den
 * Eigentümer nachtragen kann.
 *
 * Ablauf in drei Schritten, damit kein halber Satz zurückbleibt: erst **alle**
 * Dateien hochladen, dann die Datenbank in **einer** Transaktion ändern, und
 * die alten Dateien erst löschen, wenn beides durch ist. Ein Fehler vorher
 * räumt die neuen Dateien weg und lässt die Datenbank unberührt.
 */
export async function legeEigentuemerDokumenteAb(args: {
  organizationId: string;
  propertyId: string;
  uploadedById: string;
  category: "ABRECHNUNG";
  refPrefix: string;
  documents: UnitDocument[];
}): Promise<AblageErgebnis> {
  const { organizationId, propertyId, uploadedById, category, refPrefix, documents } = args;
  if (documents.length === 0) return { erstellt: 0, ersetzt: 0, uebersprungen: [] };

  const jetzt = new Date();
  const ownerships = await db.unitOwnership.findMany({
    where: {
      unitId: { in: documents.map((d) => d.unitId) },
      validFrom: { lte: jetzt },
      OR: [{ validTo: null }, { validTo: { gt: jetzt } }],
    },
    select: { unitId: true, userId: true },
  });
  const empfaengerJeEinheit = new Map<string, string[]>();
  for (const o of ownerships) {
    empfaengerJeEinheit.set(o.unitId, [...(empfaengerJeEinheit.get(o.unitId) ?? []), o.userId]);
  }

  // Einheiten ohne aktuellen Eigentümer gar nicht erst ablegen (siehe oben).
  const uebersprungen = documents
    .filter((d) => (empfaengerJeEinheit.get(d.unitId) ?? []).length === 0)
    .map((d) => ({ unitId: d.unitId, label: d.unitLabel }));
  const abzulegen = documents.filter((d) => (empfaengerJeEinheit.get(d.unitId) ?? []).length > 0);
  if (abzulegen.length === 0) return { erstellt: 0, ersetzt: 0, uebersprungen };

  const vorhandene = await db.document.findMany({
    where: { organizationId, externalRef: { in: abzulegen.map((d) => `${refPrefix}:${d.unitId}`) } },
    select: { id: true, storedName: true, externalRef: true },
  });
  const alteJeRef = new Map(vorhandene.map((d) => [d.externalRef as string, d]));

  // ── 1) Alle Dateien hochladen ─────────────────────────────────────────────
  const hochgeladen: { doc: UnitDocument; ref: string; upload: Awaited<ReturnType<typeof saveBuffer>> }[] = [];
  try {
    for (const doc of abzulegen) {
      hochgeladen.push({
        doc,
        ref: `${refPrefix}:${doc.unitId}`,
        upload: await saveBuffer(doc.pdf, doc.fileName, "application/pdf", ["application/pdf"]),
      });
    }
  } catch (err) {
    await Promise.all(hochgeladen.map((h) => deleteBlob(h.upload.storedName).catch(() => {})));
    throw err;
  }

  // ── 2) Datenbank in einer Transaktion ─────────────────────────────────────
  const ergebnis: AblageErgebnis = { erstellt: 0, ersetzt: 0, uebersprungen };
  try {
    await db.$transaction(
      async (tx) => {
        for (const { doc, ref, upload } of hochgeladen) {
          const empfaenger = empfaengerJeEinheit.get(doc.unitId) ?? [];
          const daten = {
            organizationId,
            propertyId,
            unitId: doc.unitId,
            title: doc.title,
            category,
            // Die Sichtbarkeit steuern ausschließlich die Empfänger; ohne sie
            // wird gar nicht erst abgelegt. `audience` ist nur die Einordnung.
            audience: "EIGENTUEMER" as const,
            uploadedById,
            externalRef: ref,
            ...upload,
          };

          const alt = alteJeRef.get(ref);
          const id = alt
            ? (await tx.document.update({ where: { id: alt.id }, data: daten })).id
            : (await tx.document.create({ data: daten })).id;
          if (alt) await tx.documentRecipient.deleteMany({ where: { documentId: id } });
          await tx.documentRecipient.createMany({
            data: empfaenger.map((userId) => ({ documentId: id, userId })),
            skipDuplicates: true,
          });
        }
      },
      { timeout: TX_TIMEOUT_MS },
    );
  } catch (err) {
    await Promise.all(hochgeladen.map((h) => deleteBlob(h.upload.storedName).catch(() => {})));
    throw err;
  }

  // ── 3) Erst jetzt die ersetzten Dateien wegräumen ─────────────────────────
  for (const { ref } of hochgeladen) {
    const alt = alteJeRef.get(ref);
    if (alt) {
      ergebnis.ersetzt++;
      await deleteBlob(alt.storedName).catch(() => {});
    } else {
      ergebnis.erstellt++;
    }
  }
  return ergebnis;
}
