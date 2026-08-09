# Folgetickets zur Stellplatz-Logik (Stand 09.08.2026)

Die Stellplatz-Logik (1 € je Stellplatz/Monat, Einheiten vom Typ STELLPLATZ
als eigene Abo-Position) ist umgesetzt. Verbleibende Punkte:

## 1. ✅ Erledigt (09.08.2026): Umlageschlüssel „je Stellplatz" — jetzt wirklich überall wählbar

`DistributionKey.JE_STELLPLATZ` verteilt gleichmäßig und ausschließlich auf
Einheiten vom Typ STELLPLATZ — in Wirtschaftsplan, Jahresabrechnung und
Sonderumlagen wählbar. **Korrektur zum Stand 07.08.:** Im Sonderumlage-Formular
war der Schlüssel entgegen der damaligen Erledigt-Meldung NICHT wählbar (die
Seite führte eine eigene Schlüsselliste ohne JE_STELLPLATZ — Doppellisten-
Fehler). Formular und Action lesen seit dem 09.08. dieselbe Konstante
(`sonderumlagen/keys.ts`), ein Test hält den Inhalt fest. Ohne
Stellplatz-Einheit meldet die Verteilung verständlich, was fehlt; bei
Sonderumlagen entstehen keine 0-€-Sollstellungen für Wohneinheiten.

Am 09.08.2026 außerdem umgesetzt (Details in DECISIONS.md Nr. 297–307):
Stellplätze zählen beim Schlüssel „je Einheit" nicht mit, blockieren die
Jahresabrechnung nicht mehr bei Fläche/Personen, sind im Einheiten-Editor
anleg- und änderbar, werden in Kennzahlen/Verwaltervertrag getrennt gezählt,
und der Abo-Mengenabgleich läuft täglich im Cron sowie nach jedem Checkout.

## 2. AGB / Preisverzeichnis (Betreiber-Aufgabe, kein Code)

Die AGB (Ziffer 6, Preise) nennen das Preismodell nur allgemein. Der
Stellplatzpreis (1,00 € brutto je Stellplatz/Monat in den Bezahltarifen,
im Start-Tarif kostenlos) sollte ins Preisverzeichnis bzw. in die bei der
Buchung ausgewiesenen Preise aufgenommen werden. Juristische Formulierung
bitte durch die Betreiberin — nicht aus dem Code heraus formulieren.

## 3. Stripe-Konfiguration (Betreiber-Aufgabe, Dashboard)

- Optional `STRIPE_PRICE_STELLPLATZ` anlegen (wiederkehrend, 1,00 €/Monat,
  Steuerverhalten „inklusive"), sonst erzeugt der Checkout den Preis inline
  aus `preise-daten.ts` — funktioniert ohne weitere Konfiguration.
- Wer Stripe Tax nutzt: `tax_behavior: inclusive` gilt dann für ALLE
  Positionen (auch die Tarif-Preise) — einheitlich im Dashboard bzw. an den
  Env-Preisen pflegen, nicht nur an der Stellplatz-Position.
- Wird die Env-Variable nachträglich geändert, erkennt der Mengenabgleich den
  Tarif-Posten seit dem 09.08. bevorzugt über die Tarif-Preis-Ids
  (`STRIPE_PRICE_BASIC`/`_PLUS`) — diese sollten dann ebenfalls gepflegt sein.
