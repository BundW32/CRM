// Fachbegriff mit Erklärung an Ort und Stelle.
//
// Kein Popup-Framework, kein Client-JS: Die Erklärung steht im Dokument und
// wird per CSS bei Mauszeiger oder Tastaturfokus eingeblendet. Das hat drei
// Gründe — sie funktioniert ohne JavaScript, sie kostet nichts, und
// Screenreader lesen sie ohnehin vor, ganz gleich ob sie gerade sichtbar ist.
//
// **Tastaturfokus ist Absicht, obwohl er Tab-Stopps kostet.** Ein Begriff, den
// nur die Maus erreicht, ist für Tastaturnutzer nicht vorhanden. Auf der
// längsten Seite kommen dadurch etwa ein Dutzend Stopps dazu; das ist der Preis
// dafür, dass die Erklärung wirklich allen zur Verfügung steht.
//
// Sind die Hinweise abgeschaltet (`User.showHints`), bleibt der Begriff als
// gewöhnlicher Text stehen — ohne Unterstreichung, ohne Fokus, ohne Zusatz.
import type { ReactNode } from "react";
import { GLOSSAR, type Begriffsname, type Glossareintrag } from "@/lib/glossar";
import { hinweiseAn } from "@/components/tipp";

export async function Begriff({
  name,
  children,
}: {
  name: Begriffsname;
  /** Der Begriff, wie er im Satz steht (gebeugt, im Plural, …). */
  children: ReactNode;
}) {
  if (!(await hinweiseAn())) return <>{children}</>;

  // `as Glossareintrag`: Manche Einträge haben keinen Paragraphen, und der
  // `as const`-Verbund macht daraus eine Vereinigung ohne gemeinsames Feld.
  const eintrag: Glossareintrag = GLOSSAR[name];
  const text = eintrag.paragraph
    ? `${eintrag.erklaerung} (${eintrag.paragraph})`
    : eintrag.erklaerung;

  return (
    <span className="begriff" tabIndex={0}>
      {children}
      <span className="begriff-erklaerung">{text}</span>
    </span>
  );
}
