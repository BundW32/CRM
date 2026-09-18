# Audit-Log / Änderungsjournal – Implementierung und Betriebsfreigabe

Stand: 18.09.2026. Branch: `codex/audit-journal`, Basis: `33cb769d7df35cb32f8ffeb766e526c5f238dc36`.

## Umfang und sichtbare Änderungen

Sichtbare Änderungen sind auf `/verwaltung/audit` und `/plattform/audit` mit ihren Export-Endpunkten begrenzt. Keine neuen Felder, Historienkästen, Dialoge, Hauptmenüpunkte oder geänderten Buchungsformulare. Die gemeinsam genutzten Server-Actions erhalten ausschließlich die Transaktionskontexte für die Protokollierung; das betrifft auch gemeinsam mit dem B&W-CRM genutzte Funktionen.

Im Audit-Bereich: Umschaltung Sicherheitsprotokoll / fachliches Änderungsjournal, Zeitraum mit Berliner Tagesgrenzen, Objekt-/Aktions-/Datensatz-/Herkunftsfilter, Suche, stabile Sortierung, Paginierung, aufklappbare Feldänderungen, CSV-/JSON-Export. Aktionsmeldungen und tatsächliche Feldänderungen sind unterscheidbar; eine Aktion kann mehrere Einträge erzeugen. Beträge sind Änderungsstände und werden nicht als Buchungssumme addiert.

Die Navigation bleibt auf Wunsch unverändert. Deshalb ist die neu berechtigte Eigentümersicht derzeit nur über den direkten Audit-Link erreichbar; es wird kein zusätzlicher Menüpunkt außerhalb des Audit-Bereichs eingeführt.

## Erfassung

- PostgreSQL-Trigger erfassen INSERT/UPDATE/DELETE inklusive Bulk-Operationen in derselben Transaktion wie die Fachänderung. Rollbacks entfernen auch die zugehörigen Protokolle; fehlgeschlagene Journal-Schreibvorgänge brechen die Mutation ab.
- Explizite Feldlisten erfassen Buchhaltung, Konten, Kostenarten, Importstapel, Pläne, Sollstellungen, Zahlungsverteilungen, Abrechnungen, Eigentumsverhältnisse, Einheiten, Mahnungen, Sonderumlagen, Verpflichtungen, SEPA-Mandate, CO₂, Maßnahmen/Prüfpflichten, Beschlüsse/Stimmen, Versammlungen/TOPs, Dokumente/Empfänger, Vorgänge/Rechnungen, Rechte, Nutzer, Integrationen, Zähler/Ablesungen, Anträge und Beiratsaufgaben. Die verbindliche Liste steht in der Migration und wird gegen das Prisma-Schema getestet.
- Nicht jede Spalte wird dupliziert. Zugangsschlüssel, Passwort-Hashes, vollständige strukturierte Bankdaten, Dateipfade, Dokumentinhalte und Abrechnungssnapshots werden nicht als Werte protokolliert. Für ausgewählte sensible Felder werden nur Änderungsmarkierungen geschrieben. Fachliche Freitexte können personenbezogene Inhalte enthalten; sie sind kein anonymes Protokoll.
- `auditMutation` setzt die serverseitig ermittelte Identität transaktionslokal (`set_config(..., true)`). Support-Stellvertretung führt echten Akteur und vertretenen Nutzer getrennt. Verbindungspooling darf den Kontext nicht auf die nächste Transaktion übertragen.
- Nicht instrumentierte Jobs, direkte SQL-Schreibvorgänge und einige externe Eingänge werden trotzdem durch Trigger erfasst, aber ohne beweisbare Identität als `UNKNOWN` ausgewiesen. Es erfolgt keine erfundene Zuschreibung zum Ersteller eines Datensatzes oder zum „System“. Insbesondere die Handwerker-Magic-Link-Aktionen haben noch keinen eigenen Akteurskontext. Das ist eine erkennbare Abdeckungsgrenze, keine vollständige Eingabekontrolle aller Programmpfade.
- Ergänzende `logAudit`-Aktionsmeldungen bleiben aus Kompatibilitätsgründen best-effort, melden Fehler aber über den festen Fehlercode `AUDIT_WRITE_FAILED`. Exporte verlangen eine erfolgreiche Protokollierung vor der Auslieferung. Betriebsmonitoring muss auf diesen Fehlercode eingerichtet werden.

## Rechte und Datenschutz

| Rolle | Sicht |
|---|---|
| Organisationsadministrator | Sicherheits- und Fachprotokoll ausschließlich der eigenen Organisation; auch ohne noch existierenden Akteur |
| Eingeschränkter Verwalter | Fachprotokoll zugewiesener aktiver Objekte und eigene verifizierte Sicherheitsereignisse |
| Eigentümer / Beirat | Ausschließlich freigegebene Gemeinschaftsfelder der aktuell berechtigten WEG; keine zusätzlichen Rechte allein durch Beiratsstatus |
| Mieter / Handwerker-Portalkonto | Kein Audit-Zugriff |
| Plattformbetreiber | Plattformweite Sicht nur mit bestehender doppelter Plattformprüfung |

Die Eigentümersicht ist eine positive Liste: gemeinschaftliche Kontostammdaten ohne Bankverbindung, Kostenarten, beschlossene Pläne/Planpositionen, fertige Abrechnungen, Sonderumlagen, CO₂ und Erhaltungsmaßnahmen. Sie ist **kein vollständiges Buchungsjournal für alle Eigentümer**. Einzelbuchungen, Hausgeldrückstände, Mahnungen, SEPA-Mandate, Einzelverteilungen, Abstimmungen, Empfängerlisten, private Dokumente und Sicherheitsereignisse sind ausgeschlossen. Ein allgemeiner gesetzlicher Einsichtsanspruch wird durch diese technische Online-Auswahl nicht abschließend bewertet oder ersetzt.

Frühere oder zukünftige zeitbezogene Eigentümerschaften reichen nicht für laufenden Zugriff. Eine ältere objektweite Zuordnung ist nur der Rückfall, wenn keine zeitbezogene Einheitenzuordnung für diese Person und dieses Objekt existiert. Die Freigabe von Plan-/Abrechnungsereignissen wird am aktuellen veröffentlichten Status erneut geprüft; gelöschte oder wieder in Entwurf versetzte Datensätze bleiben Eigentümern verborgen.

Alle URL-Filter werden mit dem berechneten Rechtefilter per AND verbunden. Seite und Export verwenden dieselbe Rechtefunktion und dieselbe Feldprojektion. Rohmetadaten werden auch beim Lesen alter Einträge gefiltert. IP-Adressen erscheinen nur im berechtigten Sicherheitsprotokoll, nie im Eigentümerjournal. Die zusätzliche Namenskopie wird beim bestehenden Anonymisierungsvorgang entfernt, ausgenommen ausdrücklich gesperrte Beweise. Die verbleibenden IDs sind weiterhin pseudonyme, nicht zwingend anonyme Daten.

## Bestandsdaten und Aufbewahrung

Die Migration erfindet keine historischen Werte. Bestehende Einträge bleiben `schemaVersion=0`. Organisationszuordnungen werden nur aus noch verfügbaren Informationen rekonstruiert; unzuordenbare Einträge bleiben der Plattform vorbehalten. Historische Support-Akteure und fehlende Objektreferenzen lassen sich nicht zuverlässig nachträglich rekonstruieren. Besitzerwechsel der damaligen Akteurskonten können die einfache Altbestandszuordnung beeinflussen; für Altbestand besteht keine nachträgliche Vollständigkeitsgarantie.

Die bisherige IP-Löschung nach 90 Tagen bleibt erhalten. `AUDIT_SECURITY_RETENTION_DAYS` kann nach dokumentierter Datenschutzfreigabe eine technische Frist von 1 bis 3650 Tagen für **neu erfasste Sicherheitsereignisse mit Anwendungskontext** setzen. Ohne Konfiguration wird keine neue automatische Löschfrist angenommen. Fachjournal, Altbestand und kontextlose Triggerereignisse erhalten keine erfundene pauschale Frist. Das ist ein offener Betriebspunkt, **keine Freigabe für unbegrenzte Speicherung**.

Der Cleanup löscht nur ausdrücklich abgelaufene Einträge ohne `legalHold`. Gesperrte Einträge sind auch von der routinemäßigen IP-Entfernung ausgenommen. Eine Aufbewahrungssperre kann durch eine kontrollierte DB-Operation von false auf true gesetzt werden; der Trigger protokolliert dies separat. Es gibt absichtlich keinen Lösch-/Bearbeitenknopf im Portal. Freigabe einer Sperre oder nachträgliche Festlegung genehmigter Fristen benötigt ein dokumentiertes, privilegiertes Wartungsverfahren mit gesichertem Export, Anlass, verantwortlicher Person und Vier-Augen-Prüfung. Dafür enthält diese Änderung keinen allgemeinen Umgehungs-Endpunkt.

## Integrität und Grenzen

Der Guard verhindert normale Änderungen an Beweisinhalten und Löschungen vor Ablauf. Eng begrenzte Ausnahmen: alte IP entfernen, FK-Akteur bei Kontolöschung auf NULL setzen, Name nach Anonymisierung entfernen und Aufbewahrungssperre setzen. Er verhindert **nicht** Eingriffe eines Datenbankeigentümers/Superusers, `TRUNCATE`, Trigger-Abschaltung oder gefälschte INSERTs mit gestohlenen DB-Zugangsdaten. Keine Behauptung einer zertifizierten Revisionssicherheit oder einer automatisch erfüllten GoBD-Konformität.

Vor Freigabe: Runtime-DB-Rolle von Migrations-/Owner-Rolle trennen; keine DDL-/TRUNCATE-Rechte für die Anwendung, Trigger und Rollen prüfen, externe manipulationsgeschützte Backups/Log-Ausleitung und Wiederherstellungsnachweis vorsehen. Der Export-SHA256-Header ist nur eine Transportprüfsumme, keine Signatur oder unabhängige Beglaubigung. Exporte enthalten sensible Daten und müssen entsprechend aufbewahrt werden.

## Lokale Prüfungen und noch offene Freigaben

- Vollständige Migrationskette auf einer leeren lokalen PostgreSQL/WASM-Datenbank angewendet.
- `TZ=UTC npm run pruefung`: Typprüfung, ESLint und 1.039 Tests bestanden. Die TZ-Angabe entspricht dem CI-Lauf; ohne sie scheitert ein bereits vorhandener Bauabzugsteuer-Test an seiner UTC-Erwartung auf einem Berliner Rechner.
- 16 neue Audit-DB-Tests bestanden: Mutation/Rollback, Bulk-Writes, echte Mandantentrennung in beide Richtungen, Rollenfilter, Eigentümerprojektion, entzogene Eigentümerschaft, Entwurfsstatus, Support-Akteur, Cascades, Änderungs-/Löschschutz, IP-Frist, Aufbewahrungssperre, Anonymisierung und UTC-Speicherung unabhängig von der DB-Sitzungszeitzone.
- Standard-Produktionsbuild (`next build`, Turbopack) erfolgreich. Bestehende Warnungen zur dynamischen Dateisystemablage bleiben bestehen. Der alternativ versuchte Webpack-Build scheitert an der vorhandenen PDF-Worker-Einbindung; diese wurde nicht geändert.
- Lokaler HTTP-Smoke-Test erfolgreich: Audit-Seite, CSV und JSON, Exportprotokollierung, Cache-Schutz, Ablehnung anonymer/Mieter-/unberechtigter Plattformzugriffe, Eigentümerprojektion und mandantenfremder Objektfilter. Browserprüfung mit synthetischen Testdaten: Login, Journal und aufklappbare Vorher-/Nachher-Werte. Der Datumsfilter erhält einen ausschließlich in der Audit-Ansicht aktivierten mobilen Umbruch; sonstige Filterleisten behalten ihre Darstellung.
- Ein weiterer Audit-Test zu **parallelen** Transaktionskontexten bleibt auf echtem PostgreSQL zu verifizieren. Er ist im Quelltext aktiv und wird vom vorhandenen PostgreSQL-16-CI-Job ausgeführt. Lokal nur über den Testnamen ausgeklammert, weil PGlite mehrere Verbindungen auf eine PostgreSQL-Sitzung multiplexiert und Transaktionen nicht ausreichend isoliert. Ein nativer Testserver konnte wegen der Sandbox-Beschränkung für Shared Memory nicht starten.
- Die gesamte bestehende DB-Suite hatte zusätzlich einen Bestandsfehler in `mea-sync.dbtest.ts`: erwartet `[123,124]`, während die vorhandene Nachkommastellenlogik `[123.5,123.5]` liefert. Die Berechnungslogik wurde hier nicht geändert; dieser Test muss vor einem grünen Gesamt-CI gesondert abgeglichen werden.
- Noch nicht geprüft: produktiver Mengen-/Latenztest, reale Runtime-DB-Rollen/Backups, rechtliche Festlegung der Aufbewahrungsfristen und Nachweise über externe Protokollsicherung.

**Keine Veröffentlichung:** Auf ausdrücklichen Wunsch bleiben die Änderungen lokal. Der vorhandene Vercel-Build führt Migrationen automatisch aus. Vor einem Push muss geklärt sein, ob Preview- und Produktionsdatenbank wirklich getrennt sind. Nicht mergen/deployen, bevor eine isolierte Staging-Prüfung einschließlich PostgreSQL-Paralleltest und Wiederherstellung abgeschlossen ist.

## Weiterarbeiten

### PR-Freigabe ohne Deployment (18.09.2026)

Der Review-PR darf ohne Produktionsfreigabe veröffentlicht werden. Automatische
Vercel-Git-Deployments sind in `portal/vercel.json` ausschließlich für
`codex/audit-journal` deaktiviert. Dies verhindert Vorschau-Builds dieses Branches;
es deaktiviert weder die GitHub-Prüfungen noch Deployments des Zielbranches und
ist keine Sperre gegen manuell gestartete Deployments.

Der Zielbranch `claude/friendly-archimedes-ggmjhp` wurde vor Veröffentlichung
erneut abgeglichen und stand unverändert auf `33cb769d7df35cb32f8ffeb766e526c5f238dc36`.
Die lokale Wiederholungsprüfung bestand mit 1.046 Tests, Typprüfung, ESLint,
Next-Build und HTTP-Rollen-/Exportprüfung. Alle 112 Migrationen wurden auf einer
frischen lokalen PGlite-Datenbank erfolgreich angewendet.

Die neue Migration fügt Spalten, Indizes, Funktionen und Trigger hinzu und
ergänzt Zuordnungen vorhandener Audit-Einträge. Sie enthält kein Löschen von
Geschäftsdatensätzen. Dennoch können DDL-Sperren und neue Trigger den laufenden
Schreibbetrieb beeinflussen; ein erfolgreicher Leerdatenbanktest beweist keine
risikofreie Produktivmigration. Ein Code-Rollback entfernt die Trigger nicht.

**Vor Merge offen:** echter PostgreSQL-CI-Lauf einschließlich Paralleltest,
bestätigte aktuelle Produktionssicherung mit Wiederherstellungsweg sowie
kontrollierte Freigabe der gemeinsamen Datenbankmigration für beide Produkte.
Diese Punkte sind keine Voraussetzung für den deploymentfreien Entwurfs-PR,
aber der PR ist bis dahin ausdrücklich nicht produktionsfreigegeben.

### Ergänzung: vereinfachte Bedienung (lokaler Stand v2)

Der Name bleibt **Audit-Log**, die beiden Protokollansichten bleiben erhalten. Ausschließlich der Audit-Bereich erhält eine Vorgangsliste mit regelbasierten Ereignissätzen, aufklappbaren Vorher-/Nachher-Vergleichen und separat aufklappbaren technischen Angaben. Referenznamen stammen nur aus vorhandenen historischen Werten; fehlende Bezeichnungen werden nicht durch aktuelle Namen als vermeintliche historische Angaben ersetzt.

- Gruppierung erfolgt vor der Paginierung in der Datenbank, nach allen Rechte- und Suchfiltern. Gemeinsam sein müssen Transaktionskennung, Organisation, Objekt, Kategorie sowie tatsächliche/vertretene Identität einschließlich Akteursart und Namensstand. Altbestand, fehlende Kennungen und fehlende Organisation werden nicht gebündelt. Keine zeitbasierte Zusammenfassung und keine nachträgliche Änderung an Beweisen.
- 20 Vorgänge pro Seite. Große Gruppen zeigen höchstens 50 Einträge in der Vorschau; alle Einträge bleiben über die Einzelansicht mit Seitenwechsel erreichbar. Gruppen zählen ausschließlich die passenden, berechtigten Einträge. Exporte liefern weiterhin die vollständigen Einzelnachweise innerhalb der bestehenden 10.000er-Grenze, mit identischen Filtern einschließlich der ausgewählten Gruppe.
- Die SQL-Gruppierung übersetzt den gemeinsamen serverseitigen Prisma-Rechtefilter nur für explizit unterstützte Felder/Operatoren, bindet sämtliche Werte und verweigert unbekannte Bedingungen. Datenbanktests vergleichen SQL und Prisma für Administratoren, eingeschränkte Verwalter und Eigentümer. Bei künftigen Änderungen am Rechtefilter ist dieser Gleichlauf erneut zu prüfen.
- Standardfilter: Suche, frei wählbarer Zeitraum und fachlicher Bereich; Objektauswahl bei mehreren Objekten oder gesetztem Objektfilter. Spezialfilter unter „Weitere Filter“. Die Suche umfasst Namen, Datensatzkennungen und Aktionscodes, **nicht** sämtliche Buchungstexte. Zurücksetzen erhält die gewählte Protokollansicht. Änderungen an der gemeinsam genutzten FilterBar sind nur für Audit opt-in aktiviert.
- Links führen zu aktuell vorhandenen, berechtigten Buchungen (bestehender Einzelbuchungsfilter), Wirtschaftsplänen und Jahresabrechnungen. Eigentümer erhalten keine Links auf die nur für Verwalter zugänglichen Finanzseiten. Ein Plattform-Auditzugriff allein genügt ebenfalls nicht für einen mandantenfremden Fachseiten-Link. Zielseiten bleiben unverändert; die vorhandene Buchhaltungsseite bezeichnet ihren Einzelbuchungsfilter noch als Einstieg aus der Abrechnungs-Prüfliste.
- Keine zusätzliche Datenbankmigration für diese Bedienungsverbesserungen. Keine Navigation außerhalb des Audit-Bereichs verändert. Zwei bereits vorhandene unversionierte Dateien namens `page 2.tsx` wurden nicht angefasst oder ins Änderungspaket aufgenommen.
- Prüfung v2: 1.046 reguläre Tests; 24 Audit-Datenbanktests bestanden, der bereits beschriebene native PostgreSQL-Paralleltest lokal ausgeklammert. Produktionsbuild erfolgreich, bestehende Storage-Tracing-Warnungen unverändert. Lokaler HTTP-Test deckt Gruppen-/Einzelansicht, Bereichsfilter, Ziel-Link, JSON/CSV, Exportprotokollierung und Zugriffsablehnungen ab. Browserprüfung: Gruppe und Vergleich öffnen, Finanzfilter setzen/zurücksetzen und zur exakt gefilterten Buchung springen.

Die oben dokumentierten Freigabegrenzen (echtes PostgreSQL, Lasttest, Runtime-Rollen, externe Sicherung und Aufbewahrungsfreigabe) bestehen unverändert. v2 ist kein Produktions-Rollout.

### Vor einer Veröffentlichung

1. Diff fachlich und datenschutzseitig prüfen; insbesondere Eigentümer-Feldauswahl und Aufbewahrungszwecke bestätigen.
2. Preview-Datenbank und Runtime-Rolle nachweislich isolieren.
3. Branch/PR erst anschließend hochladen; normalen CI-Job mit PostgreSQL 16 ausführen und den vorhandenen MEA-Test abgleichen.
4. In Staging typische Abläufe testen: Bankimport/Rücknahme, Buchung/Storno, Wirtschaftsplan/Sollstellungen, Jahresabrechnung, Eigentümerwechsel, Dokumente, Support-Stellvertretung, Exporte und Cleanup.
5. Monitoring, Sicherung, Migration mit Backup und kontrollierten Rollout freigeben. Fehlende historische Werte bleiben als solche kenntlich.
