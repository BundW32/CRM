// Zerlegt den Anzeigenamen einer Person in Vor- und Nachname.
//
// Gegenstück zum Zusammensetzen beim Anlegen (`${firstName} ${lastName}`):
// Der letzte Bestandteil gilt als Nachname, alles davor als Vorname. Damit
// bleiben mehrteilige Vornamen („Anna Maria Schmidt") beisammen.
//
// Namenszusätze wie „von" oder „van der" landen dabei im Vornamen – bewusst in
// Kauf genommen: Die Zerlegung dient nur der Anzeige im Formular, gespeichert
// wird die bereits vorhandene Person unverändert.
export function splitName(name: string): { firstName: string; lastName: string } {
  const teile = name.trim().split(/\s+/).filter(Boolean);
  if (teile.length === 0) return { firstName: "", lastName: "" };
  if (teile.length === 1) return { firstName: "", lastName: teile[0] };
  return { firstName: teile.slice(0, -1).join(" "), lastName: teile[teile.length - 1] };
}
