"use client";

// Handwerker-Auswahl an der Buchung — samt Warnung zur Bauabzugsteuer
// (§ 48 EStG), **bevor** gebucht wird.
//
// **Warum der Hinweis hier steht und nicht nach dem Speichern.** Einbehalten
// werden kann nur von einer Zahlung, die noch nicht raus ist. Ist überwiesen,
// hilft keine Meldung mehr — dann bleibt nur die Haftung für den nicht
// abgeführten Betrag (§ 48a Abs. 3 EStG). Eine Warnung im Nachhinein wäre also
// nicht bloß spät, sondern nutzlos.
//
// **Warum ohne Serveranfrage.** Alles, was die Rechnung braucht, steht schon
// auf der Seite: die Jahressummen je Handwerker und das Bauleistungs-Kennzeichen
// je Kostenart. Ein Nachladen bei jedem Tastendruck im Betragsfeld wäre spürbar
// und brächte nichts.
//
// **Warum es nicht sperrt.** Ob der Einbehalt tatsächlich vorgenommen wurde,
// weiß nur der Mensch davor — vielleicht ist die Bescheinigung unterwegs,
// vielleicht wurde bereits gekürzt überwiesen. Das Programm blockiert deshalb
// nicht, sondern verlangt eine bewusste Bestätigung. Die dieselbe Prüfung
// serverseitig noch einmal macht (`buchhaltung/actions.ts`): Ein Häkchen im
// Browser ist keine Zusicherung.

import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui";
import { formatCents, parseEuroToCents } from "@/lib/money";
import { EINBEHALT_PROZENT, pruefeEinbehalt, type Pruefung } from "@/lib/weg/bauabzugsteuer";

export type HandwerkerWahl = {
  id: string;
  name: string;
  /** In diesem Kalenderjahr bereits für Bauleistungen gezahlt. */
  bisherCents: number;
  exemptionNumber: string | null;
  /** ISO-Datum; `null` = keine Bescheinigung hinterlegt. */
  exemptionValidUntil: string | null;
};

export function BauabzugHinweis({
  handwerker,
  bauleistungKostenarten,
  inputClass,
}: {
  handwerker: HandwerkerWahl[];
  /** IDs der Kostenarten, die als Bauleistung gelten. */
  bauleistungKostenarten: string[];
  inputClass: string;
}) {
  const [gewaehlt, setGewaehlt] = useState("");
  const [pruefung, setPruefung] = useState<Pruefung | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);

  // Betrag und Kostenart stehen in denselben Formular, gehören aber nicht
  // dieser Komponente. Statt die halbe Seite zur Client-Komponente zu machen,
  // wird das Formular beobachtet — es ist genau ein Zuhörer, nicht drei.
  useEffect(() => {
    const form = wrapper.current?.closest("form");
    if (!form) return;

    const rechnen = () => {
      const daten = new FormData(form);
      const handwerkerId = String(daten.get("craftsmanId") ?? "");
      const costTypeId = String(daten.get("costTypeId") ?? "");
      const betragCents = parseEuroToCents(String(daten.get("amount") ?? ""));
      const kind = String(daten.get("kind") ?? "");

      const h = handwerker.find((x) => x.id === handwerkerId);
      // Eine Einnahme ist keine Gegenleistung für eine Bauleistung. Ohne diese
      // Prüfung warnte das Programm auch bei einer Gutschrift des Handwerkers.
      if (!h || kind !== "AUSGABE" || !betragCents || betragCents <= 0) return setPruefung(null);

      setPruefung(
        pruefeEinbehalt({
          bauleistung: bauleistungKostenarten.includes(costTypeId),
          freistellung: {
            nummer: h.exemptionNumber,
            gueltigBis: h.exemptionValidUntil ? new Date(h.exemptionValidUntil) : null,
          },
          bisherCents: h.bisherCents,
          betragCents,
          // Maßgeblich ist der Tag der Zahlung. Das Buchungsdatum steht im
          // Formular, ist aber zum Zeitpunkt der Eingabe oft noch leer —
          // deshalb heute als Näherung, der Server rechnet mit dem echten Wert.
          stichtag: new Date(),
        }),
      );
    };

    rechnen();
    form.addEventListener("input", rechnen);
    form.addEventListener("change", rechnen);
    return () => {
      form.removeEventListener("input", rechnen);
      form.removeEventListener("change", rechnen);
    };
  }, [handwerker, bauleistungKostenarten]);

  const warnt = pruefung?.pflicht === true;

  return (
    <div ref={wrapper} className="contents">
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
        Handwerker (optional)
        <select
          name="craftsmanId"
          className={`${inputClass} w-full`}
          value={gewaehlt}
          onChange={(e) => setGewaehlt(e.target.value)}
        >
          <option value="">— keiner —</option>
          {handwerker.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </label>

      {/* Im Raster des Formulars belegt der Hinweis eine ganze Zeile. Vorher
          war es `w-full` in einer `flex-wrap`-Reihe: Beim Ein- und Ausblenden
          brach die gesamte Feldfolge neu um und alles darunter sprang. */}
      {warnt && pruefung.pflicht ? (
        <div className="col-span-full">
          <Alert variant="warning" title={`Bauabzugsteuer: ${formatCents(pruefung.einbehaltCents)} einbehalten`}>
            <p>
              {pruefung.grund === "FREISTELLUNG_ABGELAUFEN"
                ? "Die Freistellungsbescheinigung dieses Handwerkers ist abgelaufen."
                : "Für diesen Handwerker liegt keine gültige Freistellungsbescheinigung vor."}{" "}
              Mit dieser Zahlung übersteigt die Gemeinschaft in diesem Kalenderjahr{" "}
              {formatCents(pruefung.gesamtCents)} an Bauleistungen an ihn. Ab 5.000 € müssen
              Sie {EINBEHALT_PROZENT} % einbehalten und ans Finanzamt abführen — sonst haftet
              die Gemeinschaft dafür (§§ 48, 48a Abs. 3 EStG).
            </p>
            <p className="mt-1">
              <strong>Der einfachste Weg:</strong> Fordern Sie die Freistellungsbescheinigung
              an (die meisten Betriebe haben eine) und tragen Sie sie beim Handwerker ein.
              Dann entfällt der Einbehalt.
            </p>
            {/*
              Zwei Wege, und beide müssen benennbar sein. Ein einzelnes Häkchen
              („zur Kenntnis genommen") hielt nur fest, dass gewarnt wurde — nicht,
              was daraufhin geschah. Genau das ist aber die Frage, wenn das
              Finanzamt später nachfragt: einbehalten oder nicht?
              Wer einbehält, hat danach eine Frist (§ 48a Abs. 1 EStG); nur wenn
              das Programm den Einbehalt kennt, kann es daran erinnern.
            */}
            <fieldset className="mt-3 space-y-1.5">
              <legend className="font-medium">Wie wurde gezahlt?</legend>
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="bauabzugBestaetigt"
                  value="einbehalten"
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  Ich habe <strong>{formatCents(pruefung.einbehaltCents)} einbehalten</strong> und
                  melde sie beim Finanzamt an
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="bauabzugBestaetigt"
                  value="ungekuerzt"
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  Ich habe <strong>ungekürzt gezahlt</strong> — die Gemeinschaft haftet dafür
                  (§ 48a Abs. 3 EStG)
                </span>
              </label>
            </fieldset>
          </Alert>
        </div>
      ) : null}
    </div>
  );
}
