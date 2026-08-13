# Betriebsanleitung: Dateiablage (Vercel Blob)

**Zweck:** Uploads am Laufen halten. Alles, was im Portal hochgeladen oder
erzeugt wird — Belege, Fotos, Mietverträge, Freistellungsbescheinigungen,
Einzelwirtschaftspläne, Jahresabrechnungen, Versammlungsprotokolle,
Unterschriften, Logos — liegt in **einem** Speicher. Ist der falsch
eingerichtet, schlägt nicht ein Upload fehl, sondern jeder.

**Anlass:** Genau das war der Zustand in Produktion. Sichtbar war nur ein Satz
(„Die Dateiablage ist nicht verfügbar"), und die Spur endete dort. Die beiden
möglichen Ursachen sehen von außen gleich aus und verlangen gegensätzliche
Handgriffe.

---

## 1. Was die Ablage braucht

| Variable | Wer sie setzt | Ohne sie |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | Vercel, automatisch beim Verbinden eines Blob-Stores mit dem Projekt | **Produktion:** jeder Upload bricht ab (`src/lib/storage.ts`, `assertDataUrlFallbackAllowed`). **Preview/lokal:** Dateien landen als Base64-Data-URL in der Datenbank, höchstens 5 MB. |
| `VERCEL_ENV` | Vercel, automatisch (`production` / `preview` / `development`) | Das Portal hielte Produktion für eine Preview-Umgebung und schriebe Kundendateien als Base64 in die Datenbank. |

Von Hand zu setzen ist **keine** von beiden. Wer `BLOB_READ_WRITE_TOKEN`
selbst einträgt, hat den Store vermutlich nicht mit dem Projekt verbunden — und
dann fehlt er in den anderen Umgebungen wieder.

Ein zweiter Punkt steht in keiner Variablen und ist trotzdem entscheidend:

> **Der Store muss PRIVAT angelegt sein.**

Das Portal schreibt mit `access: "private"` (`putPrivate` in
`src/lib/storage.ts`). Ein öffentlich angelegter Store weist das ab — Token
gesetzt, alles sieht eingerichtet aus, und trotzdem geht kein Upload durch.

Der umgekehrte Weg wäre schlimmer: Ein öffentlicher Store, in dem die Dateien
liegen, gibt jede Kundendatei an jeden heraus, der ihre URL kennt. Diese URLs
stehen in der Datenbank und in jedem weitergeleiteten Link. Belege, Mietverträge
und Bescheinigungen sind personenbezogene Daten mehrerer Mandanten — das ist
kein Schönheitsfehler, sondern ein meldepflichtiger Vorfall.

---

## 2. Einen privaten Blob-Store anlegen

Im Dashboard:

1. Vercel → Projekt → **Storage** → **Create** → **Blob**
2. Bei **Access** ausdrücklich **Private** wählen (die Voreinstellung ist nicht
   verlässlich, und nachträglich lässt sich die Einstellung nicht ändern —
   ein öffentlicher Store muss ersetzt werden).
3. Store **mit dem Projekt verbinden** („Connect Project"), für **alle**
   Umgebungen, in denen echte Kundendaten entstehen (mindestens Production).
   Vercel legt dabei `BLOB_READ_WRITE_TOKEN` selbst an.
4. **Neu deployen.** Umgebungsvariablen wirken erst mit der nächsten
   Bereitstellung.

Auf der Kommandozeile:

```bash
vercel blob create-store --access private
vercel env pull            # nur zur Kontrolle: ist das Token da?
```

Wenn bereits ein **öffentlicher** Store im Einsatz war: neuen privaten Store
anlegen, Projekt darauf umstellen, vorhandene Dateien übertragen und den
öffentlichen Store danach löschen. Nicht vorher — die `storedName`-Spalten in
der Datenbank zeigen auf die alten URLs, und ein gelöschter Store macht jeden
bereits abgelegten Beleg unabrufbar.

---

## 3. Woran man die Fehlkonfiguration erkennt

### Der schnelle Weg: Selbstprüfung im Portal

**Einstellungen → Dateiablage** (`/verwaltung/ablage`), sichtbar für
Betreiber-Konten (`isPlatformAdminUser`). Sie legt eine Testdatei ab, liest sie
zurück, versucht sie ohne Zugangsdaten abzurufen und löscht sie wieder. Vier
Befunde, jeder mit Behebungsschritt:

| Punkt | Was er misst |
|---|---|
| Zugangs-Token der Ablage | Ist `BLOB_READ_WRITE_TOKEN` gesetzt? Nur „gesetzt/nicht gesetzt" — der Wert wird nirgends angezeigt. |
| Testupload | Nimmt der Store `access: "private"` an? |
| Rücklesen der Testdatei | Kommt zurück, was abgelegt wurde? |
| Store ist privat | Ist die Testdatei **ohne** Zugangsdaten abrufbar? Dann ist der Store öffentlich. |

Was nicht geprüft werden konnte, steht dort als **„nicht geprüft"** — nie als
„in Ordnung". Ein grünes Häkchen für etwas Ungemessenes wäre schlimmer als gar
keine Prüfung.

### Beim Serverstart

`src/instrumentation.ts` schreibt beim Start eine Warnung ins Log, wenn
`VERCEL_ENV === "production"` ist und `BLOB_READ_WRITE_TOKEN` fehlt:

```
[Ablage] BLOB_READ_WRITE_TOKEN ist in Produktion NICHT gesetzt. …
```

Zu finden in Vercel unter **Deployments → (Bereitstellung) → Runtime Logs**,
direkt nach dem Start. Eine Fehlkonfiguration, die erst beim ersten Upload eines
Kunden auffällt, fällt zu spät auf.

### An den Meldungen im Portal

Jede Ablagestelle nennt seit dieser Änderung ihren Grund
(`ablageFehlerText`, `src/lib/weg/ablage-fehler.ts`). Die Formulierung sagt,
wer den Fehler beheben kann:

| Meldung enthält | Ursache | Wer behebt |
|---|---|---|
| „liegt am System, nicht an Ihrer Datei" | Token fehlt oder Store ist öffentlich | Betrieb (dieses Dokument) |
| „Bitte wählen Sie eine andere Datei" | Dateityp, Größe, leere Datei | die verwaltende Person |
| „Bitte erneut versuchen" | Zeitüberschreitung, Netz | oft von selbst |

Meldet ein Kunde die erste Zeile, ist die Selbstprüfung der nächste Schritt —
nicht die Suche in seinen Daten.

---

## 4. Was passiert, wenn die Ablage ausfällt

Der fachliche Vorgang bleibt bestehen; nur die Datei fehlt. Für die Vorgänge,
bei denen das Nachtragen sonst unmöglich wäre, gibt es einen Wiederholen-Weg:

| Vorgang | Nachtragen |
|---|---|
| Wirtschaftsplan beschlossen, Einzelpläne nicht abgelegt | Knopf „Ablage erneut versuchen" auf der Planseite (`wiederholeAblage`) |
| Jahresabrechnung fertiggestellt, Einzelabrechnungen nicht abgelegt | derselbe Knopf auf der Abrechnungsseite |
| Versammlungsprotokoll | „Protokoll erstellen" erneut auslösen — die Versammlung gilt erst nach erfolgreicher Ablage als durchgeführt |
| Bescheinigung im Vorgang | Knopf erneut betätigen; erzeugt wird aus den Stammdaten |
| Dokument-Upload | Das Formular kommt mit den eingetragenen Werten zurück; neu zu wählen ist nur die Datei |
| Titelbild eines Objekts, Mietvertrag | Objekt bzw. Mietverhältnis erneut bearbeiten (das Übrige ist gespeichert) |

Wiederholte Ablagen sind gefahrlos: Die erzeugten Eigentümer-Dokumente hängen an
einem `refPrefix` und werden ersetzt, nicht verdoppelt
(`src/lib/weg/owner-documents.ts`).

---

## 5. Kurzprüfung nach jeder Änderung an der Ablage

1. **Einstellungen → Dateiablage → Prüfung starten** — alle vier Punkte grün?
2. Ein Dokument unter **Dokumente → Hochladen** ablegen und wieder öffnen.
3. Runtime-Log der Bereitstellung auf `[Ablage]`-Warnungen ansehen.
4. Beim Wechsel des Stores zusätzlich: Ein **altes** Dokument öffnen — es liegt
   noch im vorherigen Store.

Verwandt: `docs/RUNBOOK-Backup-Wiederherstellung.md` (der Blob-Store gehört mit
in die Sicherung — er enthält die Nachweise zur Buchhaltung).
