-- Vermieter-Zusatzmodul (M-K): monatliche Betriebskosten-Vorauszahlung des
-- Mieters je Mietverhältnis (Basis der Betriebskostenabrechnung). Rein additiv.
ALTER TABLE "Tenancy" ADD COLUMN IF NOT EXISTS "bkPrepaymentMonthlyCents" INTEGER;
