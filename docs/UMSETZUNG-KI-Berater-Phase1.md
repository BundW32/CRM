# KI-Berater — Umsetzungsstand Phase 1

Umsetzung des Konzepts `docs/KONZEPT-KI-Berater.md` (Stand 10.08.2026, v2).
Dieser Vermerk hält fest, **was davon gebaut ist**, wo es von der Vorlage
abweicht und was bewusst offen bleibt.

## Was Phase 1 (Fundament) umfasst — und jetzt im Portal steckt

| Konzept | Umsetzung |
|---|---|
| pgvector in der bestehenden DB, RLS, Isolationstests in CI | Migration `20260810120000_ki_wissensindex`: Tabelle `KiChunk` (`vector(768)`, HNSW-Index) mit Row-Level-Security **FORCE** über `app.current_org_id`. Isolationstests: `src/lib/ki/wissensindex.dbtest.ts`, laufen im `datenbank`-Job der CI (Image auf `pgvector/pgvector:pg16` umgestellt). |
| Ingest-Pipeline für portalinterne Texte (keine PDFs) | `src/lib/ki/wissensindex.ts`: Beschlüsse, Versammlungen samt Tagesordnung, Eigentümer-Anträge, Aushänge, Dokument-**Titel**. Abgleich über Inhalts-Hash (unverändert = keine erneute Einbettung), verwaiste Quellen werden entfernt. |
| Chunking semantisch, 400–800 Token, 15 % Overlap | `src/lib/ki/chunking.ts` (+ Tests): Trennung an TOP-/§-/Markdown-Überschriften und Absätzen, Abschnitt bleibt als Metadatum für die Quellenangabe erhalten. |
| Retrieval-Endpunkt mit Rollenfilter | `src/lib/ki/retrieval.ts`: Sichtbarkeitsmenge zentral in `scopeFuer` (Rolle → {ALLE, eigene Stufe}, BEIRAT je Mandats-Objekt, Verwalter alles im Objekt-Scope), Filter **in der SQL-WHERE-Klausel**, dazu RLS als zweites Netz. |
| Vertex AI, Region europe-west3, `global` gesperrt | `src/lib/ki/gemini.ts`: gemeinsamer Client für Assistent + Embeddings. Vertex per Service-Konto (`VERTEX_SERVICE_ACCOUNT_JSON`, Token über signierte JWT), Region ausgeschrieben in der URL, `VERTEX_LOCATION=global` wird abgelehnt. Fallback: bisherige Developer API. |
| Embeddings `gemini-embedding-001`, dim 768, normalisiert | ebd. — `output_dimensionality: 768`, L2-Normalisierung vor jedem Speichern/Suchen (unter 3.072 Dimensionen liefert das Modell nicht normierte Vektoren). |
| Guardrails (3.5) | Sperrliste **vor** jedem Modellaufruf (`src/lib/ki/sperrthemen.ts` + Tests): Bonität, Mahnentscheidung, Beschlussfeststellung, Rechtevergabe → feste Ablehnung mit Verweis. System-Prompt nach Konzept §4 (`bauePrompt` in `assistant.ts` + Struktur-Test): Kontext in `<kontext>`-Block, direkt dahinter die Untrusted-Ansage. Score-Schwelle: unterhalb 0,5 gilt „Dazu finde ich in Ihren Unterlagen nichts". KI-Kennzeichnung + Rechtsberatungs-Hinweis fest im Widget, nicht generiert. |
| Kostenbremsen | Hash-Abgleich beim Ingest; nächtlicher Cron (`/api/cron/ki-index`, 03:30) bettet nur Geändertes ein; Aufbau-Knopf nur für SuperAdmins. |

Bedienung: Verwaltung → Einstellungen → Integrationen → Karte „KI-Assistent",
Abschnitt **Wissensindex** (Status, Aufbau/Abgleich). Ohne pgvector oder ohne
Index arbeitet der Assistent unverändert mit der Schlüsselwortsuche weiter —
nichts bricht.

## Bewusste Abweichungen vom Konzeptpapier

1. **`KiChunk` statt `ki_chunks`, Organisation statt `weg_id`.** Das Portal
   kennt keine Tabelle `weg`; Mandant ist die `Organization`, das Objekt die
   `Property`. Die RLS-Variable heißt entsprechend `app.current_org_id`, und
   Chunks tragen zusätzlich die `propertyId` für den Objekt-Scope. Spaltennamen
   folgen der Prisma-Konvention des Bestands (camelCase, PascalCase-Tabelle).
2. **Sichtbarkeit als `Audience`-Stufe, nicht als `min_rolle`-Hierarchie.** Die
   Zugriffslogik des Portals ist nicht streng hierarchisch: Ein Eigentümer
   sieht Mieter-Aushänge NICHT (siehe `announcementWhereForUser`). Der Index
   spiegelt deshalb die bestehende Audience-Semantik statt einer neuen
   Rangordnung — Rolle → {ALLE, eigene Stufe}, BEIRAT nur mit Mandat je Objekt,
   Verwalter alles.
3. **Vorgänge (Tickets) sind nicht im Index.** Ihre Sichtbarkeit hängt an der
   einzelnen Person (Ersteller/Einheit/Zuweisung) und ließe sich über
   Sichtbarkeitsstufen nicht abbilden. Sie bleiben im Live-Retrieval über
   `ticketWhereForUser`. Ebenso ausgenommen: Dokumente mit gezielten
   Empfängern.
4. **Migration bricht ohne pgvector nicht ab.** Auf einer Datenbank ohne die
   Erweiterung entsteht die Tabelle nicht und der Assistent läuft ohne
   Vektorsuche weiter; `npm run ki:schema` zieht das Schema später nach. Ein
   harter Fehler hätte jeden Deploy an die Verfügbarkeit der Erweiterung
   gekettet.
5. **Superuser-Vorbehalt der RLS dokumentiert und getestet.** FORCE bindet den
   Tabellen-Owner, aber keinen Superuser. Der Isolationstest prüft die Policy
   deshalb mit einer eigens angelegten unprivilegierten Rolle; in Produktion
   darf sich die Anwendung nie als Superuser verbinden (bei Neon/Vercel
   Postgres ist das ohnehin so).
6. **Modellwahl unverändert (`GEMINI_MODEL`, Vorgabe gemini-2.0-flash).** Das
   Konzept sagt selbst: Modell bei Kickoff nach den drei Kriterien fixieren
   (GA + Residency, kein Abschaltdatum, JSON/Tool-Support) — das ist eine
   Betreiber-Entscheidung per Umgebungsvariable, kein Code.

## Rechtliches (Konzept Abschnitt 8)

Phase 1 hält die bestehenden Zusagen der KI-Transparenzseite ein: Es werden
weiterhin **nur Titel und im Portal erfasste Texte** verarbeitet, keine
Dateiinhalte — Lücke A entsteht erst mit Phase 4 und ist deren ausdrückliche
Vorbedingung. Zu Lücke B (Drittland): Sobald der Betreiber auf Vertex AI mit
`europe-west3` umstellt, sollte die Transparenzseite von „Verarbeitung
außerhalb der EU" auf die konkrete Regionsangabe umgestellt werden — das ist
eine Textänderung, die zur tatsächlichen Konfiguration passen muss und deshalb
nicht vorauseilend im Code steht.

## Offen (nächste Phasen laut Konzept)

- **Phase 2 — Fachwissen (Schicht 1):** WEG/BGB/BetrKV/HeizkostenV/GEG
  paragraphenweise indexieren (das Chunking erkennt §-Überschriften bereits),
  Goldset aus Verwalter-Plus-Tickets, Eval-Pipeline in CI. Dafür braucht der
  Index eine Ablage für mandantenfreie Inhalte (z. B. `organizationId` einer
  System-Organisation oder eigene Tabelle) — bewusst noch nicht angelegt.
- **Phase 3 — Function Calling:** Saldo/MEA/Fristen/Beschlusssuche als Tools.
  Heute liefert `assistant-finanzen.ts` die Live-Zahlen als Kontextquellen;
  echtes Tool-Calling ist der nächste Schritt.
- **Phase 4 — Dokumenten-Analyse:** OCR, strukturierte Extraktion,
  Review-Workflow, Altbestand. **Vorbedingung:** Rechtstexte aus Abschnitt 8
  anpassen (Transparenzseite, Datenschutzerklärung, AVV, DSFA prüfen).
- **Triage/Objekt-Import auf den gemeinsamen Client umziehen** (`lib/ai.ts`,
  `lib/objekt-extraction.ts` rufen die Developer API noch direkt), damit auch
  sie über Vertex laufen können.
- **Daumen-hoch/-runter** unter Assistent-Antworten als Zulauf fürs Goldset
  (Konzept 5.1).
