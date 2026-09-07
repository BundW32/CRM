// „Sonstiges" mit Freitext — die Serverseite des Bausteins
// `components/select-sonstiges.tsx`.
//
// Zwei Aufgaben, die sonst in jeder Aktion und auf jeder Listenseite einzeln
// entstünden — und dabei auseinanderliefen:
//
// 1. **Annehmen.** Der Freitext gilt nur, wenn auch „Sonstiges" gewählt wurde.
//    Das Eingabefeld bleibt im Formular stehen, wenn man zurückschaltet (damit
//    sich die Feldreihenfolge nicht verschiebt), und sendet dann seinen alten
//    Inhalt weiter mit. Ohne diese Prüfung stünde an einem Zähler „Strom" und
//    daneben, unsichtbar, noch „Zisterne".
// 2. **Anzeigen.** Eine Liste, in der zehnmal „Sonstiges" steht, ist keine
//    Liste. Wo ein Freitext hinterlegt ist, gehört er in die Zeile.

/**
 * Freitext einer „Sonstiges"-Auswahl aus dem Formular lesen.
 *
 * Liefert `null`, sobald ein anderer Wert gewählt wurde oder das Feld leer
 * blieb — genau das, was in eine `String?`-Spalte gehört.
 */
export function sonstigesFreitext(
  gewaehlterWert: string | null | undefined,
  freitext: FormDataEntryValue | string | null | undefined,
  sonstigesWert = "SONSTIGES",
  maxLaenge = 120,
): string | null {
  if (gewaehlterWert !== sonstigesWert) return null;
  const text = String(freitext ?? "").trim().slice(0, maxLaenge);
  return text || null;
}

/**
 * Beschriftung für Listen und Karten: der Freitext gewinnt, die Kategorie
 * bleibt als Einordnung dahinter stehen.
 *
 * „Zisterne (Sonstiges)" sagt beides — was es ist und wo es einsortiert wurde.
 * Ohne Freitext bleibt es bei der Kategorie.
 */
export function mitFreitext(kategorieLabel: string, freitext: string | null | undefined): string {
  const text = freitext?.trim();
  return text ? `${text} (${kategorieLabel})` : kategorieLabel;
}
