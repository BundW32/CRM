-- Anrede-Snapshot für die Briefanrede der Hausgeld-Mahnung.
-- Wie recipientName/recipientAddress eingefroren: das Schreiben muss auch
-- später zeigen, wie es verschickt wurde.
ALTER TABLE "HausgeldMahnung" ADD COLUMN "recipientSalutation" TEXT;
ALTER TABLE "HausgeldMahnung" ADD COLUMN "recipientLastName" TEXT;
