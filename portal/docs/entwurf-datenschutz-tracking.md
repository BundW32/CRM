# ENTWURF — juristisch zu prüfen, nicht einbauen ohne Freigabe

Textentwürfe für die Datenschutzerklärung (`/datenschutz`, beide Fassungen —
WEG und B&W — sowie sinngemäß `/datenschutz-saas`) zu den drei
Tracking-Bausteinen. Erst nach anwaltlicher Prüfung in die Seiten übernehmen;
dabei das Stand-Datum hochsetzen und **beide** `isWegSaas()`-Zweige nachziehen.

**Achtung, bestehender Text wird falsch:** Der heutige Cookie-Abschnitt sagt
„keine Analyse- oder Werbe-Cookies". Sobald GA4/Ads live gehen (Google-IDs
gesetzt), stimmt das nicht mehr — der Abschnitt unten unter (3) ersetzt ihn.

---

## (1) Reichweitenmessung ohne Cookies (läuft bereits, einwilligungsfrei)

> **Reichweitenmessung ohne Cookies.** Zur Verbesserung unseres Angebots
> messen wir Seitenaufrufe mit einem selbst betriebenen Verfahren, das ohne
> Cookies und ohne Speicherung im Browser auskommt. Ihre IP-Adresse wird
> dabei nicht gespeichert; sie fließt lediglich in ein tagesgebundenes
> Pseudonym ein (SHA-256-Prüfsumme aus IP-Adresse, Browser-Kennung und einem
> täglich neu erzeugten Serverschlüssel) und dient der Ableitung des
> ungefähren Landes. Der Serverschlüssel des Vortags wird täglich gelöscht;
> eine Wiedererkennung über den einzelnen Tag hinaus ist damit technisch
> ausgeschlossen. Die pseudonymen Roh-Daten werden nach 90 Tagen gelöscht,
> danach verbleiben ausschließlich statistische Tageswerte ohne
> Personenbezug. Rechtsgrundlage ist unser berechtigtes Interesse an der
> Reichweitenmessung und Verbesserung des Angebots (Art. 6 Abs. 1 lit. f
> DSGVO). Ein Zugriff auf Ihr Endgerät im Sinne von § 25 TDDDG findet nicht
> statt. Eine Weitergabe an Dritte erfolgt nicht.

Technische Belege: `src/lib/analytics/tracking-server.ts` (Salt-Rotation,
Hashing), `src/lib/retention.ts` (90-Tage-Löschung, Salt-Löschung),
`src/app/api/t/route.ts` (keine IP-Speicherung).

## (2) Google Analytics 4 (nur mit Einwilligung „Statistik")

> **Google Analytics 4.** Sofern Sie über unser Cookie-Banner in die
> Kategorie „Statistik" einwilligen, setzen wir Google Analytics 4 ein, einen
> Webanalysedienst der Google Ireland Limited, Gordon House, Barrow Street,
> Dublin 4, Irland („Google"). Google Analytics verwendet Cookies und
> vergleichbare Technologien, die eine Analyse Ihrer Nutzung der Website
> ermöglichen. Die dabei erzeugten Informationen werden in der Regel an
> Server von Google übertragen; dabei kann es zu einer Übermittlung in die
> USA kommen. Google stützt diese Übermittlung auf das EU-U.S. Data Privacy
> Framework sowie Standardvertragsklauseln. Wir haben mit Google einen
> Auftragsverarbeitungsvertrag geschlossen. Die von Google Analytics
> verarbeitete IP-Adresse wird nicht mit anderen Daten von Google
> zusammengeführt; Google Analytics 4 protokolliert oder speichert keine
> vollständigen IP-Adressen. Die von uns eingestellte Aufbewahrungsdauer der
> Ereignisdaten beträgt 14 Monate. Rechtsgrundlage ist Ihre Einwilligung
> (Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG). Sie können Ihre
> Einwilligung jederzeit mit Wirkung für die Zukunft über den Link
> „Cookie-Einstellungen" am Seitenende widerrufen.

Hinweis an die Prüfung: 14 Monate ist die in GA4 zu WÄHLENDE Einstellung
(Verwaltung → Dateneinstellungen → Datenaufbewahrung) — bitte beim Anlegen
der Property so setzen, sonst stimmt der Text nicht.

## (3) Google Ads Conversion-Tracking (nur mit Einwilligung „Marketing")

> **Google Ads Conversion-Tracking.** Sofern Sie über unser Cookie-Banner in
> die Kategorie „Marketing" einwilligen, nutzen wir das Conversion-Tracking
> von Google Ads (Google Ireland Limited, Gordon House, Barrow Street,
> Dublin 4, Irland). Gelangen Sie über eine Google-Anzeige auf unsere Seite,
> wird ein Cookie gesetzt, mit dem Google und wir erkennen können, ob nach
> dem Klick auf die Anzeige eine bestimmte Handlung (etwa eine Registrierung)
> erfolgt ist. Wir erfahren dabei die Gesamtzahl der Conversions, erhalten
> aber keine Informationen, mit denen wir Sie persönlich identifizieren
> können. Es kann zu einer Übermittlung in die USA kommen; Google stützt
> diese auf das EU-U.S. Data Privacy Framework sowie
> Standardvertragsklauseln. Rechtsgrundlage ist Ihre Einwilligung (Art. 6
> Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG); ohne Einwilligung findet kein
> Conversion-Tracking statt (Google Consent Mode v2, Grundeinstellung
> „abgelehnt"). Widerruf jederzeit über „Cookie-Einstellungen" am Seitenende.

**Ersatz für den bestehenden Cookie-Absatz:**

> **Cookies und Einwilligung.** Technisch erforderliche Cookies (Anmeldung,
> Sicherheit, das Merken Ihrer Cookie-Auswahl) setzen wir auf Grundlage von
> § 25 Abs. 2 Nr. 2 TDDDG ein. Statistik- und Marketing-Cookies (Google
> Analytics 4, Google Ads) setzen wir ausschließlich nach Ihrer aktiven
> Einwilligung über das Cookie-Banner; Ihre Auswahl können Sie jederzeit über
> „Cookie-Einstellungen" am Seitenende ändern oder widerrufen.

## Offene Punkte für die Prüfung

- Empfängerliste in `/datenschutz` Ziffer „Empfänger und Auftragsverarbeiter"
  um **Google Ireland Ltd. (Analytics/Ads)** ergänzen; dort fehlt laut
  Bestandsaufnahme außerdem **Stripe** — im selben Durchgang ergänzen.
- `/avv` Subprozessorenliste: Google Analytics/Ads betreffen die
  **Marketing-Ebene der Anbieterin**, nicht die Auftragsverarbeitung der
  WEG-Daten — nach unserer Einschätzung KEIN neuer Subprozessor (die
  öffentlichen Seiten verarbeiten keine WEG-Inhaltsdaten). Bitte bestätigen.
- Gemessen wird nur der öffentliche Bereich; der eingeloggte Portalbereich
  sendet keine Seitenaufrufe an Google (`istOeffentlicherPfad`,
  `src/lib/analytics/gtag.ts`). Diese Zusicherung kann in den Text
  aufgenommen werden, wenn die Prüfung sie für sinnvoll hält.
