# Sicherheits- und Marktreifebericht

**Auftraggeber:** B&W Immobilien Management
**Gegenstand:** CRM/Portal für Hausverwaltungen (`portal/`), Stand `cb3d2c5`
**Datum:** 29.07.2026
**Rolle des Prüfers:** Sicherheitsbeauftragter / Softwareentwickler

---

## 0. Gesamturteil

Das Produkt ist fachlich weit — WEG-Buchhaltung, Abrechnungen, Beschlüsse,
Übergaben, Mandantenfähigkeit, Branding sind vorhanden und in bemerkenswerter
Tiefe umgesetzt. Die Zugriffsprüfungen sind an vielen Stellen sauber und
durchdacht (`src/lib/access.ts`, `src/app/api/files/[kind]/[id]/route.ts` prüfen
konsequent Organisation *und* Objektbezug).

**Marktreif ist es trotzdem nicht.** Der Grund ist nicht die Fachlichkeit,
sondern das Sicherheitsfundament:

1. Es gibt einen konkreten Weg, auf dem ein beliebiger Kunde
   Plattform-Betreiberrechte über *alle* Mandanten erlangt (P0-1).
2. Sitzungen lassen sich nicht widerrufen — nach einem Passwortdiebstahl kann
   ein Angreifer bis zu sieben Tage weiterarbeiten, auch nachdem das Opfer sein
   Passwort geändert hat (P0-2).
3. Von 42 automatisierten Tests prüft **kein einziger** Zugriffskontrolle oder
   Mandantentrennung. Das gesamte Sicherheitsmodell ist unversioniert und
   ungeprüft — jede Änderung kann es still aufbrechen (P0-5).
4. Für ein Produkt, das Bankdaten, SEPA-Mandate, Steuernummern und
   Eigentümerdaten verarbeitet, fehlen die Nachweise, die jeder professionelle
   Kunde in der Beschaffung verlangt: TOM nach Art. 32 DSGVO, Backup- und
   Wiederanlaufkonzept, Pentest, Incident-Response (P3).

Punkt 4 ist kein Formalismus: Ohne diese Unterlagen scheitert der Vertrieb an
jeder Hausverwaltung mit eigener Rechtsabteilung — unabhängig davon, wie gut das
Programm ist.

**Empfehlung:** P0 vor jedem weiteren Kundenzugang schließen, P1 vor dem
offiziellen Marktstart, P2 innerhalb des ersten Quartals nach Start, P3
parallel als Dauerthema.

---

## P0 — Blocker (kein weiterer Produktivkunde, bis behoben)

### P0-1 Rechteausweitung: Plattform-Admin hängt an einer veränderbaren E-Mail

**Ort:** `portal/src/lib/platform-admin.ts:18`,
`portal/src/app/(portal)/verwaltung/nutzer/actions.ts:237` und `:382`

Wer Plattform-Betreiber ist, wird allein daran entschieden, ob die
E-Mail-Adresse des Nutzers in der Umgebungsvariable `PLATFORM_ADMIN_EMAILS`
steht:

```ts
export function isPlatformAdminUser(user: { email: string | null }): boolean {
  const allow = parseAdminAllowlist(process.env.PLATFORM_ADMIN_EMAILS);
  return allow.includes(user.email.trim().toLowerCase());
}
```

Gleichzeitig darf jeder Verwalter mit SuperAdmin-Rolle in seiner eigenen
Organisation Nutzer mit **frei wählbarer E-Mail-Adresse** anlegen und deren
Erstpasswort setzen (`createUser`, Feld `email` aus dem Formular, `passwordHash`
aus einem selbst erzeugten `tempPassword`).

**Angriff:** Ein Kunde legt in seiner eigenen Organisation einen Nutzer mit einer
Adresse aus `PLATFORM_ADMIN_EMAILS` an, bekommt dessen Erstpasswort im
Zugangsschreiben angezeigt, meldet sich damit an — und ist Plattform-Betreiber
mit Zugriff auf `/plattform`, alle Organisationen, alle Rechnungen und der
Impersonation-Funktion in jeden fremden Mandanten hinein.

Die einzige Bremse ist die Eindeutigkeit der E-Mail-Spalte: Der Angriff
funktioniert für jede Betreiber-Adresse, zu der noch kein Nutzerkonto existiert.
Genau das ist bei Support- oder Sammeladressen (`support@…`, `admin@…`,
Zweitadressen von Mitarbeitern) der Normalfall. Eine Verifikation der Adresse
wird für die Berechtigung nirgends verlangt — `emailVerifiedAt` fließt in
`isPlatformAdminUser` nicht ein.

**Maßnahme (verbindlich, in dieser Reihenfolge):**
1. Plattform-Rechte an ein Datenbank-Flag binden (`User.isPlatformAdmin`), das
   ausschließlich per Migration/Konsole gesetzt wird — nicht an ein Attribut,
   das die Anwendung selbst schreiben kann. Die Env-Allowlist darf höchstens als
   *zusätzliche* Bedingung dienen (UND-Verknüpfung), nie als alleinige.
2. Bis dahin als Sofortmaßnahme: Beim Anlegen und Ändern von Nutzern jede
   Adresse aus `PLATFORM_ADMIN_EMAILS` serverseitig ablehnen, und
   `isPlatformAdminUser` zusätzlich `emailVerifiedAt != null` verlangen.
3. Für alle Adressen in der Allowlist sofort Konten anlegen, damit keine
   „freie" Betreiberadresse mehr existiert.

---

### P0-2 Sitzungen sind nicht widerrufbar

**Ort:** `portal/src/lib/session.ts:23-40`,
`portal/src/app/(portal)/konto/actions.ts:28`,
`portal/src/app/login/reset/[token]/actions.ts:29`

Die Sitzung ist ein reines JWT mit `sub` und sieben Tagen Laufzeit. Es gibt
keinen serverseitigen Sitzungsspeicher, keine `jti`, keine Sitzungsversion am
Nutzer. Daraus folgt:

- **Ein Passwortwechsel beendet keine andere Sitzung.** Weder `changePassword`
  noch `resetPassword` noch `setInitialPassword` berühren bestehende Tokens.
  Wer ein Passwort erbeutet hat, behält den Zugang bis zu sieben Tage, obwohl
  das Opfer genau das Gegenteil beabsichtigt hat. Das ist die zentrale
  Schutzmaßnahme nach einem Vorfall — und sie wirkt hier nicht.
- **Es gibt kein „von allen Geräten abmelden".** Bei verlorenem Laptop oder
  Handy hat der Kunde keine Handhabe.
- **Ein Rollenentzug wirkt, ein Passwortentzug nicht.** (`loadUser` liest
  `active` und Rolle bei jedem Request neu — das ist richtig gelöst und zeigt,
  dass der Gedanke da war.)

**Maßnahme:** `User.sessionsValidFrom` (Zeitstempel) einführen, im JWT `iat`
mitprüfen, und bei Passwortwechsel, Passwort-Reset, Rollenwechsel und
Deaktivierung hochsetzen. Zusätzlich eine Schaltfläche „Überall abmelden" im
Konto. Aufwand gering, Wirkung groß.

---

### P0-3 Sitzungs- und Impersonations-Token sind austauschbar

**Ort:** `portal/src/lib/session.ts:23-40` und `:96-110`

Beide Tokens werden mit demselben Secret, demselben Algorithmus und derselben
Nutzlast (`{ sub }`) signiert. Es gibt keinen `typ`- oder `aud`-Claim, der sie
unterscheidet. Ein Impersonations-Token für Kunde X ist damit ein vollwertiges
Sitzungs-Token für Kunde X.

**Wirkung:** Ein Plattform-Betreiber, der die Support-Ansicht startet, kann den
Inhalt des `bw_impersonate`-Cookies in `bw_session` kopieren und arbeitet danach
als der Kunde — ohne Impersonations-Banner, ohne dass `getSession()` die
Stellvertretung erkennt, ohne `PLATFORM_IMPERSONATE_STOP`-Eintrag im Audit-Log.
Die gesamte Nachvollziehbarkeit der Support-Zugriffe, die im Code sichtbar
sorgfältig gebaut wurde, lässt sich mit zwei Klicks im Browser aushebeln.

Für ein Produkt, dessen Betreiber vertraglich zusichert, Kundendaten nur
protokolliert einzusehen, ist das ein Nachweisproblem, kein Randthema.

**Maßnahme:** Beiden Token-Arten einen unterscheidenden Claim geben
(`typ: "session"` bzw. `typ: "impersonation"`) und beim Prüfen erzwingen. Das
Impersonations-Token zusätzlich an den ausstellenden Betreiber binden
(`act: <realUserId>`) und beim Einlösen gegen die echte Session prüfen.

---

### P0-4 Bekannte Schwachstellen in Abhängigkeiten, keine Prüfung in der CI

**Ort:** `portal/package.json`, `.github/workflows/pruefung.yml`

`npm audit --omit=dev` meldet **11 Schwachstellen (6 hoch, 5 mittel)** in den
Produktivabhängigkeiten. Relevant vor allem:

| Paket | Schwere | Bezug zu diesem Projekt |
|---|---|---|
| `next` 16.2.9 | hoch | u. a. *Middleware/Proxy-Bypass im App Router*, SSRF in Server Actions, Cache-Confusion bei Requests mit Body. Dieses Projekt löst die **Mandantenzuordnung** im Proxy auf (`src/proxy.ts`) — ein Proxy-Bypass trifft genau diese Schicht. |
| `undici` ≤6.26.0 | hoch | HTTP-Header-Injection über `Set-Cookie`, Response-Queue-Poisoning bei Keep-Alive. Wird für alle ausgehenden Aufrufe (Blob-Store, Gemini, Stripe) genutzt. |
| `fast-uri` | hoch | Host-Confusion bei URL-Auswertung. |
| `hono`, `@hono/node-server` | mittel | über `prisma` eingezogen (Build-Kette). |

Die CI (`pruefung.yml`) prüft Typen, Linter und Tests — aber **kein
`npm audit`, kein Dependency-Scanning, kein Secret-Scanning, kein SAST**. Die
Lücken können also beliebig lange unbemerkt bleiben.

**Maßnahme:**
1. `npm audit fix` einspielen, Next.js auf die aktuelle Patch-Version heben,
   danach Regressionslauf.
2. `npm audit --omit=dev --audit-level=high` als eigenen, blockierenden
   CI-Schritt ergänzen.
3. Dependabot/Renovate aktivieren, GitHub Secret Scanning und CodeQL
   einschalten.
4. Eine feste Frist vereinbaren, in der „hoch"-Befunde behoben sein müssen
   (Empfehlung: 7 Tage). Diese Frist ist später auch der Satz, den man Kunden
   in den TOM zeigt.

---

### P0-5 Kein einziger Test für Zugriffskontrolle oder Mandantentrennung

**Ort:** 42 Testdateien unter `portal/src/**/*.test.ts`

Alle vorhandenen Tests prüfen reine Fachlogik: Verteilungsschlüssel,
Heizkosten, SEPA, Bauabzugsteuer, Umlaufbeschlüsse, Textbausteine. Das ist gute
Arbeit — aber es gibt **keine** `access.test.ts`, keine `session.test.ts`, keine
Prüfung, dass ein Mieter der Organisation A kein Dokument der Organisation B
sehen kann.

Damit ist der sicherheitskritischste Teil des Systems der einzige völlig
ungetestete. `src/lib/access.ts` hat 23 KB mit Dutzenden Verzweigungen nach
Rolle, Objektzuweisung, Beiratsstatus und Selbstverwaltung; die Datei-Route
`api/files/[kind]/[id]` unterscheidet 12 Ressourcenarten mit je eigener
Prüflogik. Eine unglückliche Änderung an einer dieser Stellen fällt heute
niemandem auf — der Build bleibt grün.

**Maßnahme:** Eine Integrationstest-Ebene gegen eine Testdatenbank aufbauen mit
mindestens diesen Fällen, je Rolle und je Ressourcenart:

- Nutzer aus Org A greift auf jede ID aus Org B zu → immer 404/403.
- Eingeschränkter Verwalter greift auf ein nicht zugewiesenes Objekt zu.
- Mieter greift auf Belege, SEPA-Mandate, Mietverträge fremder Einheiten zu.
- Handwerker-Magic-Link greift auf Anhänge fremder Vorgänge zu.
- Eigentümer ohne Beiratsstatus greift auf Beiratsbereiche zu.

Diese Tests sind das Fundament, ohne das keine der übrigen Maßnahmen dauerhaft
hält. Sie gehören in die CI als Pflichtlauf.

---

## P1 — Vor dem Marktstart

### P1-6 Passwort-Reset: Klartext-Token, kein Limit, keine Invalidierung

**Ort:** `portal/src/app/login/forgot/actions.ts:32`,
`portal/src/app/login/reset/[token]/actions.ts`

- Der Reset-Token wird **im Klartext** in `User.passwordResetToken` abgelegt.
  Wer lesenden Datenbankzugriff erlangt (Backup, Log, Fehlkonfiguration,
  Dienstleister), kann jedes Konto sofort übernehmen. Korrekt wäre, nur den
  SHA-256-Hash zu speichern.
- Auf das **Einlösen** des Tokens wirkt kein Rate-Limit — nur auf das Anfordern.
- Nach erfolgreichem Reset werden bestehende Sitzungen nicht beendet (siehe
  P0-2). Der Reset schließt den Angreifer also nicht aus.
- Gleiches gilt für `emailVerifyToken` (`registrieren/actions.ts:104`).

**Maßnahme:** Token gehasht speichern, Rate-Limit auf `/login/reset/[token]`,
Sitzungsinvalidierung ergänzen, alte Tokens beim Neuanfordern verwerfen.

### P1-7 Erstpasswort in der URL

**Ort:** `portal/src/app/(portal)/verwaltung/nutzer/actions.ts:391`

```ts
redirect(`/zugangsschreiben/${user.id}?pw=${encodeURIComponent(tempPassword)}`);
```

Das Erstpasswort landet damit in Server-Zugriffsprotokollen, im Browserverlauf,
im Referrer und in jedem Proxy dazwischen. Dass es einmalig ist und
`mustChangePassword` gesetzt wird, mildert das, hebt es aber nicht auf: Zwischen
Ausstellung und erster Anmeldung liegen in der Praxis Tage (Postversand).

**Maßnahme:** Passwort nicht über die URL transportieren — kurzlebiges
Server-seitiges Token für die Zugangsschreiben-Seite, oder das Passwort direkt
in der Antwort der Server Action rendern.

### P1-8 Blob-Schreibtoken geht an einen nicht geprüften Host

**Ort:** `portal/src/app/api/files/[kind]/[id]/route.ts:224-226`

Im Pfad für Teilbereichsanfragen (Video-Streaming) wird
`BLOB_READ_WRITE_TOKEN` als `Authorization`-Header an `file.storedName`
geschickt — ohne den Host zu prüfen:

```ts
if (blobToken) blobHeaders["Authorization"] = `Bearer ${blobToken}`;
const upstream = await fetch(file.storedName, { headers: blobHeaders });
```

`src/lib/storage.ts:readUpload` schützt genau davor („SSRF +
Credential-Exfiltration", Kommentar im Code) und lässt nur
`*.blob.vercel-storage.com` zu — **dieser zweite Pfad hat den Schutz nicht.**
Gelangt je eine fremde URL in `storedName` (Import, Migration,
Datenbankmanipulation), wird das Schreibtoken für den gesamten Blob-Speicher an
einen fremden Server geleitet. Das Token gibt Lese- *und* Schreibzugriff auf
alle Kundendateien aller Mandanten.

**Maßnahme:** Die Host-Prüfung aus `readUpload` in eine gemeinsame Funktion
ziehen und an beiden Stellen aufrufen. Kleiner Eingriff, hohe Wirkung.

### P1-9 Rate-Limit: fail-open, Rennbedingung, spoofbare IP

**Ort:** `portal/src/lib/rate-limit.ts`

- **Fail-open:** `catch { return true; }` — bei Datenbankstörung ist die
  Anmeldung unbegrenzt oft versuchbar. Für die Anmeldung ist das die falsche
  Richtung; wer die Datenbank stören kann, hebelt damit den Brute-Force-Schutz
  aus.
- **Rennbedingung:** Lesen, prüfen, dann erhöhen. Parallele Anfragen lesen alle
  denselben Zählerstand und kommen alle durch. Das Limit „5 Versuche" gilt
  faktisch nur bei sequenziellen Anfragen; ein Angreifer schickt sie parallel.
- **IP spoofbar:** `getClientIp()` liest `x-real-ip` vor `x-forwarded-for`. Auf
  Vercel überschreibt die Plattform beides, hinter einem anderen Proxy oder
  beim Wechsel des Hosters nicht — dann kann jeder Client seinen Zähler durch
  einen erfundenen Header umgehen.

**Maßnahme:** Atomarer Zähler (ein `UPDATE … RETURNING` bzw. Redis), für die
Anmeldung fail-closed mit sinnvollem Fehlerbild, und die IP-Quelle explizit an
die eingesetzte Plattform binden statt an frei setzbare Header.

### P1-10 Keine Zwei-Faktor-Authentisierung

Im gesamten Code kommt weder TOTP noch WebAuthn noch ein zweiter Faktor vor. Ein
Verwalterkonto sieht sämtliche Mieter-, Eigentümer- und Bankdaten der
Organisation; ein Plattform-Betreiberkonto sieht alle Organisationen. Beides
hängt an einem einzigen Passwort.

Für ein CRM, das Marktführer werden will, ist MFA für privilegierte Rollen
inzwischen eine Ausschreibungsanforderung, keine Kür.

**Maßnahme:** TOTP (RFC 6238) mit Wiederherstellungscodes, verpflichtend für
Plattform-Betreiber und Verwalter-SuperAdmins, optional für alle anderen.

### P1-11 Keine Sicherheitsüberwachung, blinde Flecken im Audit-Log

**Ort:** `portal/prisma/schema.prisma:1386`,
`portal/src/app/(portal)/verwaltung/audit/page.tsx:53`

- `AuditLog` hat **keine `organizationId`**. Die Kundenansicht filtert deshalb
  über die Actor-Relation — was korrekt und bewusst gelöst ist, aber zur Folge
  hat, dass **fehlgeschlagene Anmeldungen (kein Actor) für den Kunden unsichtbar
  sind**. Genau die will ein Verwalter sehen, wenn jemand seine Konten
  durchprobiert.
- Es gibt keinerlei Alarmierung: kein Sentry, kein Logging-Dienst, keine
  Benachrichtigung bei Häufungen von `LOGIN_FAILED`, bei Impersonation, bei
  DSGVO-Exporten fremder Nutzer.
- Ohne Überwachung ist die Meldefrist aus Art. 33 DSGVO (72 Stunden ab
  Kenntnis) nicht haltbar — man erlangt schlicht keine Kenntnis.

**Maßnahme:** `organizationId` am Audit-Log ergänzen (bei
Anmeldeversuchen über die getroffene Kennung auflösen), Fehler- und
Sicherheitsmonitoring anbinden, Schwellwert-Alarme für Anmeldefehler,
Impersonation und Massenexporte.

### P1-12 CSP erlaubt `unsafe-inline` für Skripte

**Ort:** `portal/next.config.ts:15`

`script-src 'self' 'unsafe-inline'` nimmt der Content-Security-Policy ihre
wichtigste Wirkung: Sie fängt eine gefundene XSS-Lücke nicht mehr ab. Die
übrigen Header (HSTS mit Preload, `frame-ancestors 'none'`, nosniff,
Referrer-Policy, Permissions-Policy) sind vorbildlich gesetzt — umso ärgerlicher
ist diese Ausnahme.

Positiv: Es gibt kein einziges `dangerouslySetInnerHTML` und kein `eval` im
Code; die aktuelle XSS-Fläche ist klein. Die CSP ist die zweite
Verteidigungslinie, und die fehlt.

**Maßnahme:** Nonce-basierte CSP über den Proxy (Next.js unterstützt das
nativ), `unsafe-inline` entfernen, `object-src 'none'` ergänzen.

### P1-13 Handwerker-Magic-Link: unbefristeter Dauerschlüssel in der URL

**Ort:** `portal/src/app/(portal)/verwaltung/kontakte/actions.ts:100`,
`portal/src/app/auftraege/[token]/page.tsx:35`

`accessToken` (24 Zufalls-Bytes) ist kryptografisch stark, aber:

- er **läuft nie ab**,
- er wird **nicht rotiert**, auch nicht nach Abschluss eines Auftrags,
- er steht in der URL jeder E-Mail an den Handwerker und damit in dessen
  Postfach, Browserverlauf und ggf. Weiterleitungen,
- er gewährt Zugriff auf **alle** Aufträge dieses Handwerks, auch künftige, und
  auf deren Anhänge (`api/files`, `kind === "anhang"` und `"rechnung"`),
- ein Widerruf ist nur durch Löschen des Kontakts oder Setzen auf `null`
  möglich, ohne Audit-Eintrag.

Ein weitergeleiteter Auftrags-E-Mail-Verlauf ist damit ein dauerhafter Zugang zu
den Objektdaten des Kunden.

**Maßnahme:** Token mit Ablauf versehen (z. B. 30 Tage, verlängerbar durch
neuen Auftrag), pro Auftrag statt pro Handwerker vergeben oder zumindest auf
aktive Aufträge einschränken, Rotation und Widerruf in der Oberfläche anbieten,
beides protokollieren.

---

## P2 — Erstes Quartal nach Marktstart

### P2-14 Audit-Log unvollständig und nicht manipulationssicher

Rund 80 Aktionskonstanten sind definiert — protokolliert wird aber nur ein Teil
der sicherheitsrelevanten Vorgänge. Es fehlen unter anderem: Passwortänderung,
Passwort-Reset durch den Verwalter, Nutzeranlage, Rollenänderung, Änderung von
Objektzuweisungen, Dokumentzugriff, Änderungen an SEPA-Mandaten.

Zudem ist das Log eine gewöhnliche Tabelle: Jeder mit Datenbankzugriff kann
Einträge löschen oder ändern, ohne Spur. Für die Rechenschaftspflicht nach
Art. 5 Abs. 2 DSGVO ist das dünn.

**Maßnahme:** Protokollpflichtige Aktionen vollständig abdecken, Log
append-only auslegen (DB-Rechte, oder Hash-Verkettung), Export für Kunden
anbieten, Aufbewahrungsfrist definieren (heute wird nur die IP nach 90 Tagen
entfernt, `src/lib/retention.ts:8`).

### P2-15 Besonders sensible Felder liegen unverschlüsselt

`src/lib/crypto.ts` implementiert AES-256-GCM sauber — verwendet wird es aber
ausschließlich für Integrations-Secrets. **IBANs, SEPA-Mandatsdaten,
Steuernummern und Freistellungsbescheinigungen liegen im Klartext** in der
Datenbank.

Zwei zusätzliche Probleme im Schlüsselmanagement:

- Der Schlüssel wird notfalls aus `SESSION_SECRET` abgeleitet
  (`crypto.ts:10`). Damit ist **`SESSION_SECRET` faktisch nicht rotierbar**:
  Wer es tauscht, verliert alle verschlüsselten Integrations-Secrets — und
  bemerkt es erst, wenn eine Integration ausfällt.
- Es gibt kein Versions- oder Rotationskonzept für `INTEGRATION_ENC_KEY`.

**Maßnahme:** Verschlüsselung auf Bank- und Steuerdaten ausweiten, den
Verschlüsselungsschlüssel vom Sitzungsschlüssel trennen (Fallback auf
`SESSION_SECRET` entfernen), Schlüsselversion im Chiffrat mitführen
(`v1:` ist bereits da — nur wird sie für Rotation nicht genutzt), und die
Rotation dokumentiert durchspielen.

### P2-16 KI-Funktionen: Datenabfluss und Prompt-Injection

**Ort:** `portal/src/lib/ai.ts`, `portal/src/lib/assistant.ts:250-300`

Die Opt-in-Absicherung ist vorbildlich gelöst und dokumentiert (standardmäßig
aus, doppelte Bedingung, Hinweis auf AVV-Pflicht). Offen bleiben:

- **Prompt-Injection:** Der Assistent baut den Prompt aus Dokumentinhalten
  (`retrieveContext`). Ein präpariertes Dokument — etwa eine per E-Mail
  eingegangene Rechnung — kann Anweisungen enthalten, die das Modell befolgt.
  Die Ausgabe ist derzeit nur Text, der Schaden also begrenzt; sobald der
  Assistent Aktionen auslösen kann, wird daraus eine ernste Lücke.
- **Keine Protokollierung** der KI-Verarbeitung: Welcher Nutzer welche Inhalte
  an Google gesendet hat, ist nicht nachvollziehbar. Für Betroffenenauskünfte
  nach Art. 15 DSGVO ist das ein Problem.
- Der API-Schlüssel steht in der URL (`?key=${key}`) statt im Header und landet
  damit potenziell in Protokollen.

**Maßnahme:** Fremdinhalte im Prompt klar als Daten kennzeichnen und abgrenzen,
KI-Aufrufe protokollieren (Nutzer, Zeitpunkt, Umfang — nicht der Inhalt),
Schlüssel per Header senden, und vor Aktivierung AVV samt EU-Datenzusatz mit
Google abschließen.

### P2-17 200 MB Body-Limit für alle Server Actions

**Ort:** `portal/next.config.ts:47`

`bodySizeLimit: "200mb"` gilt global — auch für Anmelde-, Such- und
Einstellungs-Aktionen. Ein authentifizierter Nutzer kann damit gezielt Speicher-
und Kostenlast erzeugen. Nachvollziehbar motiviert (Handyfotos), aber zu breit.

**Maßnahme:** Standard klein halten, das hohe Limit auf die Upload-Routen
begrenzen; Uploads besser direkt zum Blob-Speicher signieren.

### P2-18 Löschkonzept nur teilweise umgesetzt

Es gibt eine Anonymisierung (`anonymizeUser`) und ein Aufräumen von IPs im
Audit-Log — aber keine dokumentierten Aufbewahrungsfristen für Dokumente,
Vorgänge, Nachrichten, Blobs oder für ganze Organisationen nach Kündigung.
Art. 17 DSGVO und die handelsrechtlichen Aufbewahrungspflichten müssen
gegeneinander abgewogen und **schriftlich** festgelegt sein — das ist die erste
Frage jedes Datenschutzbeauftragten auf Kundenseite.

**Maßnahme:** Löschkonzept je Datenart schreiben, technisch umsetzen und im
täglichen Cron-Lauf ausführen.

### P2-19 Mandantentrennung nur in der Anwendungsschicht

Jede Trennung zwischen Kunden hängt daran, dass in jeder einzelnen Abfrage der
Organisationsfilter mitgeschrieben wurde. Das ist im geprüften Code
bemerkenswert diszipliniert gemacht — aber es ist eine Disziplin, keine
Garantie. Bei über 550 Dateien und wachsendem Team ist ein vergessener Filter
eine Frage der Zeit, und die Folge ist der Datenabfluss zwischen zwei Kunden:
der Vorfall, den ein Anbieter in diesem Markt nicht überlebt.

**Maßnahme:** Zweite Schicht einziehen — PostgreSQL Row Level Security mit
gesetzter Session-Variable, oder mindestens eine Prisma-Erweiterung, die den
Org-Filter zentral erzwingt und bei Fehlen die Abfrage verweigert. Zusammen mit
den Tests aus P0-5 ergibt das eine belastbare Wand.

---

## P3 — Nachweise und Betrieb (parallel, Dauerthema)

Diese Punkte sind kein Code, sondern das, was der Vertrieb braucht. Ohne sie ist
das Produkt nicht verkaufbar an Kunden mit Beschaffungsprozess — unabhängig vom
technischen Zustand.

| # | Fehlt | Warum es den Marktstart blockiert |
|---|---|---|
| P3-20 | **Backup- und Wiederanlaufkonzept** mit RPO/RTO und *getesteter* Wiederherstellung | Kein Nachweis, dass Buchhaltungsdaten einer WEG nach einem Ausfall wiederkommen. Steht in keinem Dokument des Repos. |
| P3-21 | **Penetrationstest** durch Dritte, Schwachstellen-Managementprozess, `security.txt` / Meldeweg | Standardfrage in jeder Ausschreibung. Auch: Es gibt keinen Weg, auf dem ein Finder eine Lücke melden könnte. |
| P3-22 | **TOM nach Art. 32 DSGVO**, Verarbeitungsverzeichnis, Unterauftragnehmerliste | AVV- und Datenschutzseiten existieren als Portalseiten — die technischen Anlagen dazu fehlen. Ohne sie ist der AVV unvollständig. |
| P3-23 | **Verfügbarkeits- und Fehlermonitoring**, SLA, Statusseite | Heute merkt der Betreiber einen Ausfall, wenn ein Kunde anruft. |
| P3-24 | **Notfall- und Meldeprozess** (Art. 33/34 DSGVO, 72 Stunden) | Nicht definiert, nicht geübt. Siehe P1-11: ohne Monitoring auch nicht durchführbar. |
| P3-25 | **Lasttests / Skalierungsnachweis**; CI baut die Anwendung nicht | `next build` läuft nur bei Vercel; ein Build-Bruch fällt erst beim Deploy auf. Skalierungsverhalten ist völlig unbekannt. |
| P3-26 | **Dokumentiertes Schlüsselmanagement** | Siehe P2-15: `SESSION_SECRET` ist derzeit nicht rotierbar, ohne Daten zu verlieren — das muss man wissen, bevor man es versucht. |

---

## Anhang A — Was ausdrücklich gut gelöst ist

Damit der Bericht nicht schiefes Bild zeichnet:

- **Zugriffsprüfungen in `api/files/[kind]/[id]`** sind für alle zwölf
  Ressourcenarten einzeln, org-gesichert und mit erkennbarer Sorgfalt gebaut.
  Die IDOR-Kommentare zeigen, dass die Angriffsklasse verstanden wurde.
- **Keine rohen SQL-Abfragen, kein `dangerouslySetInnerHTML`, kein `eval`.**
- **Sicherheits-Header** sind bis auf `unsafe-inline` vollständig und richtig.
- **Passwort-Hashing** mit bcrypt, Kostenfaktor 12, konsistent an allen sieben
  Stellen.
- **Anmeldung ohne Nutzerauskunft:** deaktivierte Organisation und falsches
  Passwort führen zur identischen Meldung.
- **Rate-Limit-Design nach Kennung *und* IP** mit Zurücksetzen bei Erfolg — die
  Begründung im Code (selbstverwaltete WEG hinter einem Anschluss) ist genau die
  Art von Denken, die dieses Produkt braucht.
- **Der SSRF-Schutz in `readUpload`** ist richtig gedacht — er ist nur an einer
  zweiten Stelle nicht angewandt (P1-8).
- **Impersonation** ist so gebaut, dass die echte Betreiber-Session erhalten
  bleibt und die Rechte bei jedem Request neu geprüft werden. Die Idee ist gut;
  es fehlt nur die Token-Trennung (P0-3).
- **DSGVO-Export und Anonymisierung** existieren und sind zugriffsgeprüft.

Das Fundament ist also da. Es fehlen die Verstrebungen.

---

## Anhang B — Vorgeschlagene Reihenfolge

**Woche 1–2 (P0):** Plattform-Admin auf DB-Flag umstellen · Sitzungsversion und
„überall abmelden" · `typ`-Claim für Impersonation · `npm audit fix` + Next.js
aktualisieren + Audit-Schritt in der CI.

**Woche 3–6 (P0-5 und P1):** Integrationstests für Zugriffskontrolle und
Mandantentrennung aufbauen — das ist der größte Einzelposten und die
Voraussetzung dafür, dass alles Übrige hält. Parallel: Reset-Token hashen,
Passwort aus der URL nehmen, Host-Prüfung im Blob-Pfad, Rate-Limit atomar,
CSP mit Nonce.

**Woche 7–12 (Rest P1, Beginn P2):** MFA für privilegierte Rollen · Monitoring
und Alarmierung · Magic-Link-Ablauf · Audit-Log vervollständigen.

**Parallel ab Woche 1 (P3):** TOM, Backup-Konzept, Löschkonzept und
Incident-Response schreiben. Das kostet keine Entwicklerzeit, blockiert aber den
Vertrieb genauso hart wie jeder Codefehler — und ein externer Pentest sollte
gebucht werden, sobald P0 und P1 stehen.

---

*Erstellt im Auftrag von B&W Immobilien Management. Die Befunde beruhen auf einer
statischen Prüfung des Quellcodes im Stand `cb3d2c5`; ein dynamischer Test gegen
eine laufende Instanz hat nicht stattgefunden und kann weitere Befunde ergeben.*
