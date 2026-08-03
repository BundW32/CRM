-- Erledigt-Vermerke für die Einrichtungsschritte einer selbstverwalteten WEG,
-- die außerhalb des Systems stattfinden (Unterlagen vom alten Verwalter,
-- WEG-Bankkonto, Verwalterbestellung). Alle übrigen Schritte leitet die
-- Anwendung aus den vorhandenen Daten ab und speichert dafür nichts.
CREATE TABLE "WegSetupStep" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doneById" TEXT,

    CONSTRAINT "WegSetupStep_pkey" PRIMARY KEY ("id")
);

-- Ein Vermerk je Schritt und Objekt – macht das Abhaken idempotent.
CREATE UNIQUE INDEX "WegSetupStep_propertyId_key_key" ON "WegSetupStep"("propertyId", "key");

ALTER TABLE "WegSetupStep" ADD CONSTRAINT "WegSetupStep_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Wer abgehakt hat, ist nur ein Vermerk: Wird das Konto gelöscht, bleibt der
-- Schritt erledigt.
ALTER TABLE "WegSetupStep" ADD CONSTRAINT "WegSetupStep_doneById_fkey"
    FOREIGN KEY ("doneById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
