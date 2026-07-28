-- Erklärende Hinweise je Person ein-/ausschaltbar. Standard AN: Wer sie nicht
-- braucht, schaltet sie ab — umgekehrt erreichten sie genau die nicht, für die
-- sie gedacht sind.
ALTER TABLE "User" ADD COLUMN "showHints" BOOLEAN NOT NULL DEFAULT true;
