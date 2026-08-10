-- KI-Wissensindex (Vektorindex für den Assistenten — Konzept „KI-Berater", Phase 1).
--
-- Warum pgvector in DIESER Datenbank statt eines eigenen Vektordienstes: Der
-- Index bleibt eine gewöhnliche Tabelle, und die bestehende Mandantentrennung
-- (Organisations-Filter in jeder Abfrage + Isolationstests in der CI) gilt
-- unverändert. Zusätzlich sichert Row-Level-Security die Tabelle auf
-- Datenbank-Ebene ab: Ohne die Transaktionsvariable app.current_org_id liefert
-- sie NIEMANDEM eine Zeile — wegen FORCE auch dem Tabellen-Owner nicht, mit dem
-- sich die Anwendung verbindet. Ein vergessener Filter im Anwendungscode fällt
-- damit als leeres Ergebnis auf, nicht als Datenleck.
--
-- pgvector ist auf den üblichen verwalteten Postgres-Diensten (Neon, Vercel
-- Postgres, Supabase, RDS) verfügbar, aber nicht auf jedem Server
-- installierbar. Damit ein Deploy ohne pgvector nicht am Wissensindex
-- scheitert, bricht diese Migration nicht ab: Ohne Erweiterung entsteht die
-- Tabelle nicht, und der Assistent läuft ohne Vektorsuche weiter
-- (src/lib/ki/retrieval.ts erkennt das zur Laufzeit). Nachziehen, sobald die
-- Erweiterung verfügbar ist:  npm run ki:schema
-- (führt genau diese Datei erneut aus; alles hier ist gefahrlos wiederholbar).
DO $ki$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector nicht verfuegbar - Wissensindex wird uebersprungen (%)', SQLERRM;
  END;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RETURN;
  END IF;

  -- 768 Dimensionen, nicht die 3.072 der Modellvorgabe: pgvector-HNSW trägt
  -- höchstens 2.000. Die Einbettung wird deshalb mit output_dimensionality 768
  -- erzeugt und VOR dem Speichern normalisiert (unter 3.072 liefert
  -- gemini-embedding-001 nicht normierte Vektoren, sonst wäre die
  -- Cosine-Distanz verzerrt) — beides in src/lib/ki/gemini.ts.
  EXECUTE $t$
    CREATE TABLE IF NOT EXISTS "KiChunk" (
      "id"             text NOT NULL DEFAULT (gen_random_uuid())::text,
      "organizationId" text NOT NULL,
      "propertyId"     text,
      "quelleTyp"      text NOT NULL,
      "quelleId"       text NOT NULL,
      "titel"          text NOT NULL,
      "abschnitt"      text,
      "reihenfolge"    integer NOT NULL DEFAULT 0,
      "sichtbarkeit"   "Audience" NOT NULL,
      "inhaltHash"     text NOT NULL,
      "text"           text NOT NULL,
      "embedding"      vector(768) NOT NULL,
      "erstelltAm"     timestamptz(3) NOT NULL DEFAULT now(),
      CONSTRAINT "KiChunk_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "KiChunk_organizationId_fkey" FOREIGN KEY ("organizationId")
        REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "KiChunk_propertyId_fkey" FOREIGN KEY ("propertyId")
        REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  $t$;

  EXECUTE 'CREATE INDEX IF NOT EXISTS "KiChunk_embedding_idx" ON "KiChunk" USING hnsw ("embedding" vector_cosine_ops)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS "KiChunk_organizationId_quelleTyp_idx" ON "KiChunk" ("organizationId", "quelleTyp")';
  EXECUTE 'CREATE INDEX IF NOT EXISTS "KiChunk_quelleTyp_quelleId_idx" ON "KiChunk" ("quelleTyp", "quelleId")';

  -- Mandantentrennung auf DB-Ebene. FORCE, weil sich die Anwendung als
  -- Tabellen-Owner verbindet — ohne FORCE liefe die Policy für sie ins Leere.
  -- Was FORCE NICHT abdeckt: Superuser und Rollen mit BYPASSRLS stehen über
  -- jeder Policy. Die Anwendung darf sich in Produktion deshalb nie als
  -- Superuser verbinden (bei Neon/Vercel Postgres ist der Standardnutzer
  -- ohnehin keiner). Der Isolationstest prüft die Policy entsprechend mit
  -- einer unprivilegierten Rolle.
  -- current_setting(..., true) statt ohne zweites Argument: fehlt die
  -- Variable, ist das Ergebnis NULL und der Vergleich falsch — also NULL
  -- Zeilen statt einer Fehlermeldung, die jede Abfrage außerhalb einer
  -- vorbereiteten Transaktion bräche (z. B. das TRUNCATE des Testharnischs).
  EXECUTE 'ALTER TABLE "KiChunk" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "KiChunk" FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS "ki_chunk_mandant" ON "KiChunk"';
  EXECUTE $p$
    CREATE POLICY "ki_chunk_mandant" ON "KiChunk"
      USING ("organizationId" = current_setting('app.current_org_id', true))
      WITH CHECK ("organizationId" = current_setting('app.current_org_id', true))
  $p$;
END
$ki$;
