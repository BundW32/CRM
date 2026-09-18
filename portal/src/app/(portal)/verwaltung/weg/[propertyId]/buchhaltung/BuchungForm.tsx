"use client";

// Das Formular „Buchung erfassen" — als Client-Komponente, weil die
// Belegerkennung die Felder **vorbefüllt** und weil eine offene Rechnung aus
// den Verbindlichkeiten hier als Zahlung ankommt („Als bezahlt buchen").
// Gespeichert wird weiterhin über die Server-Action `createBooking`; die
// prüft alles noch einmal, auch die Verknüpfung zur Verbindlichkeit.
//
// Der Beleg geht beim Absenden mit (Feld `beleg`) — anders als bei der
// Verbindlichkeit, wo nur gelesen wird: Die Buchung ist der Nachweis der
// Zahlung, und die Rechnung gehört zu ihr.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BauabzugHinweis, type HandwerkerWahl } from "@/components/bauabzug-hinweis";
import { BelegErkennungBlock } from "@/components/beleg-erkennung-block";
import { DateField } from "@/components/fields";
import { PendingButton } from "@/components/pending-button";
import { Alert, Field, buttonClass, inputClass } from "@/components/ui";
import { createBooking } from "./actions";

export type BuchungKonto = { id: string; name: string; artLabel: string };
export type BuchungKostenart = {
  id: string;
  name: string;
  constructionWork: boolean;
  /** „KEINE" = die Kostenart ist nicht als § 35a-Leistung gekennzeichnet. */
  laborShareType: "KEINE" | "HAUSHALTSNAHE_DIENSTLEISTUNG" | "HANDWERKERLEISTUNG";
};

/** Vorbelegung aus einer offenen Verbindlichkeit („Als bezahlt buchen"). */
export type ZahlungFuer = {
  id: string;
  title: string;
  creditor: string;
  /** Deutsche Schreibweise, z. B. „1.250,00". */
  amount: string;
};

type Werte = {
  kind: "EINNAHME" | "AUSGABE";
  amount: string;
  laborShare: string;
  text: string;
  counterparty: string;
  costTypeId: string;
};

export function BuchungForm({
  propertyId,
  konten,
  kostenarten,
  handwerker,
  kiErkennung,
  zahlungFuer,
}: {
  propertyId: string;
  konten: BuchungKonto[];
  kostenarten: BuchungKostenart[];
  handwerker: HandwerkerWahl[];
  kiErkennung: boolean;
  zahlungFuer: ZahlungFuer | null;
}) {
  const [w, setW] = useState<Werte>({
    kind: "AUSGABE",
    amount: zahlungFuer?.amount ?? "",
    laborShare: "",
    text: zahlungFuer?.title ?? "",
    counterparty: zahlungFuer?.creditor ?? "",
    costTypeId: "",
  });
  const setze = (feld: keyof Werte) => (wert: string) => setW((alt) => ({ ...alt, [feld]: wert }));

  // Ein Lohnanteil an einer Kostenart ohne § 35a-Kennzeichen kommt auf keiner
  // Steuerbescheinigung an — die Abrechnung überspringt die Kostenart. Das soll
  // hier stehen, wo der Betrag eingetippt wird, nicht erst in der Prüfliste
  // der Jahresabrechnung Monate später.
  const gewaehlteKostenart = kostenarten.find((c) => c.id === w.costTypeId);
  const lohnanteilOhneKennzeichen =
    w.laborShare.trim() !== "" &&
    w.kind === "AUSGABE" &&
    (gewaehlteKostenart == null || gewaehlteKostenart.laborShareType === "KEINE");

  // Der Bauabzug-Hinweis hört auf Eingaben im Formular. Werte, die der Code
  // setzt (Erkennung, Vorbelegung), lösen kein Eingabe-Ereignis aus — deshalb
  // eines nachschicken, sonst warnt der Hinweis erst beim nächsten Tastendruck.
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    formRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [w]);

  return (
    <form ref={formRef} action={createBooking} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* Festes Raster statt `flex-wrap`. Bei umbrechenden Zeilen
          verschiebt jeder eingeblendete Block (hier der Bauabzug-Hinweis)
          die gesamte Feldfolge — mitten in der Eingabe. So landete
          „15012026" im Lohnanteil § 35a statt im Buchungstag. Im Raster
          behält jedes Feld seinen Platz. */}
      <input type="hidden" name="propertyId" value={propertyId} />
      {zahlungFuer ? <input type="hidden" name="verbindlichkeitId" value={zahlungFuer.id} /> : null}

      {zahlungFuer ? (
        <div className="col-span-full">
          <Alert variant="info" title={`Zahlung für „${zahlungFuer.title}“`}>
            Betrag, Zahlungspartner und Buchungstext sind aus der offenen Rechnung übernommen.
            Tragen Sie den Tag der Überweisung ein — nach dem Buchen gilt die Rechnung in den
            Verbindlichkeiten als beglichen.{" "}
            <Link href={`/verwaltung/weg/${propertyId}/buchhaltung`} className="underline">
              Ohne Verknüpfung buchen
            </Link>
          </Alert>
        </div>
      ) : null}

      <div className="col-span-full">
        <BelegErkennungBlock
          propertyId={propertyId}
          kiErkennung={kiErkennung}
          name="beleg"
          titel="Rechnung wählen — Betrag, Zahlungspartner, Text und Lohnanteil füllen sich von selbst"
          hinweis="Gelesen wird direkt im Portal, nichts verlässt den Server. Die Datei wird als Beleg zur Buchung gespeichert. Prüfen Sie die Werte, bevor Sie buchen — vor allem den Buchungstag: Das ist der Tag der Zahlung, nicht das Rechnungsdatum."
          onErkannt={(d) =>
            // Nur übernehmen, was erkannt wurde — eine leere Antwort löscht keine Eingabe.
            setW((alt) => ({
              ...alt,
              kind: "AUSGABE",
              amount: d.amount || alt.amount,
              laborShare: d.labor || alt.laborShare,
              text: d.title || alt.text,
              counterparty: d.creditor || alt.counterparty,
            }))
          }
          fehlt={(d) =>
            [!d.amount && "Betrag", !d.title && "Buchungstext", !d.creditor && "Zahlungspartner"].filter(
              (x): x is string => Boolean(x),
            )
          }
        />
      </div>

      <Field label="Konto">
        <select name="accountId" className={`${inputClass} w-full`} required>
          {konten.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.artLabel})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Art">
        <select
          name="kind"
          className={`${inputClass} w-full`}
          value={w.kind}
          onChange={(e) => setze("kind")(e.target.value)}
        >
          <option value="EINNAHME">Einnahme</option>
          <option value="AUSGABE">Ausgabe</option>
        </select>
      </Field>
      <DateField label="Buchungstag" name="bookingDate" required className="w-auto" />
      <Field label="Betrag (€)">
        <input
          name="amount"
          inputMode="decimal"
          placeholder="0,00"
          className={`${inputClass} w-full`}
          required
          value={w.amount}
          onChange={(e) => setze("amount")(e.target.value)}
        />
      </Field>
      <Field label="Kostenart">
        <select
          name="costTypeId"
          className={`${inputClass} w-full`}
          value={w.costTypeId}
          onChange={(e) => setze("costTypeId")(e.target.value)}
        >
          <option value="">— keine —</option>
          {kostenarten.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      {/* §35a: nur der Lohn-, Fahrt- und Maschinenkostenanteil ist
          begünstigt. Er steht auf der Rechnung; leer lassen ist besser
          als raten — die Abrechnung weist die Lücke dann aus. */}
      <Field label="davon Lohnanteil § 35a (€, optional)">
        <input
          name="laborShare"
          inputMode="decimal"
          placeholder="0,00"
          className={`${inputClass} w-full`}
          value={w.laborShare}
          onChange={(e) => setze("laborShare")(e.target.value)}
          aria-describedby={lohnanteilOhneKennzeichen ? "lohnanteil-kennzeichen" : undefined}
        />
        {lohnanteilOhneKennzeichen ? (
          <p id="lohnanteil-kennzeichen" className="mt-1 text-xs text-amber-700">
            {gewaehlteKostenart ? (
              <>
                „{gewaehlteKostenart.name}“ ist nicht als § 35a-Leistung gekennzeichnet — der
                Lohnanteil erscheint dann auf keiner Steuerbescheinigung.{" "}
                <Link href={`/verwaltung/weg/${propertyId}/stammdaten#kostenarten`} className="underline">
                  Kennzeichen in den Stammdaten setzen
                </Link>
                .
              </>
            ) : (
              "Ohne Kostenart kommt der Lohnanteil auf keine Steuerbescheinigung — bitte eine § 35a-Kostenart wählen."
            )}
          </p>
        ) : null}
      </Field>
      <Field label="Buchungstext">
        <input
          name="text"
          className={`${inputClass} w-full`}
          placeholder="z. B. Rechnung Hausmeister März"
          required
          minLength={2}
          value={w.text}
          onChange={(e) => setze("text")(e.target.value)}
        />
      </Field>
      <Field label="Zahlungspartner (optional)">
        <input
          name="counterparty"
          className={`${inputClass} w-full`}
          value={w.counterparty}
          onChange={(e) => setze("counterparty")(e.target.value)}
        />
      </Field>
      {/* Der Handwerker als Verknüpfung — Grundlage der Prüfung nach
          § 48 EStG. Über den Freitext daneben ließe sich nicht
          summieren, und die 5.000-€-Grenze gilt je Leistendem. */}
      <BauabzugHinweis
        handwerker={handwerker}
        bauleistungKostenarten={kostenarten.filter((c) => c.constructionWork).map((c) => c.id)}
        inputClass={inputClass}
      />
      <PendingButton className={`${buttonClass} w-full sm:w-auto`}>
        {zahlungFuer ? "Als bezahlt buchen" : "Buchen"}
      </PendingButton>
    </form>
  );
}
