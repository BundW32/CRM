// Vorbereitung für den Immoware24-Stammdaten-Sync (Stufe 2).
//
// Status: Der API-Zugang bei Immoware24 ist noch nicht freigeschaltet.
// Sobald IMMOWARE24_API_URL und IMMOWARE24_API_KEY vorliegen, wird hier der
// Abgleich implementiert. Das Datenmodell ist vorbereitet:
// `Property.immoware24Id` referenziert die Liegenschaft in Immoware24.
//
// Geplanter Ablauf (Pull-Sync, z. B. täglich per Vercel Cron):
//   1. Liegenschaften abrufen → Property anlegen/aktualisieren (Match über immoware24Id)
//   2. Einheiten je Liegenschaft → Unit
//   3. Verträge/Kontakte → User (MIETER/EIGENTUEMER) + Tenancy/Ownership
//      (neue Nutzer werden inaktiv angelegt und erst nach Einladung aktiviert)

export function isImmoware24Configured() {
  return Boolean(process.env.IMMOWARE24_API_URL && process.env.IMMOWARE24_API_KEY);
}

export async function syncFromImmoware24(): Promise<never> {
  throw new Error(
    "Immoware24-Sync ist noch nicht konfiguriert. Bitte API-Zugang bei Immoware24 " +
      "anfragen und IMMOWARE24_API_URL / IMMOWARE24_API_KEY setzen."
  );
}
