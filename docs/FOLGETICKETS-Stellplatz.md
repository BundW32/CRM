# Folgetickets zur Stellplatz-Logik (Stand 07.08.2026)

Die Stellplatz-Logik (1 € je Stellplatz/Monat, Einheiten vom Typ STELLPLATZ
als eigene Abo-Position) ist umgesetzt. Drei Punkte wurden bewusst NICHT in
diesem Zug erledigt und gehören auf die Liste:

## 1. Eigener Umlageschlüssel „je Stellplatz"

Stellplätze nehmen als Einheiten bereits heute an allen Umlageschlüsseln
teil (MEA, Einheiten, Fläche …) — Wirtschaftsplan, Hausgeld und
Jahresabrechnung funktionieren also ohne Sonderbehandlung. Was fehlt, ist
ein Schlüssel, der Kosten **nur** auf Stellplätze verteilt (z. B. Wartung
Garagentor, Tiefgaragen-Reinigung): ein neuer `DistributionKey`
`JE_STELLPLATZ`, der ausschließlich Einheiten vom Typ STELLPLATZ zählt.
Betroffen: `economic-plan.ts`, `annual-statement`-Rechnung, Kostenarten-UI,
Labels. Bis dahin deckt `INDIVIDUELL` (Betrag je Einheit von Hand) den Fall
ab.

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
