// Erklärende Hinweise für Laien — ein- und ausschaltbar.
//
// Das Programm richtet sich an Gemeinschaften, die sich selbst verwalten. Es
// muss also erklären, was eine Sollstellung ist und warum ein Verbrauchsanteil
// zwischen 50 und 70 Prozent liegen muss — ohne dass jemand, der das seit zehn
// Jahren macht, bei jedem Aufruf dieselben drei Sätze wegliest.
//
// Zwei Entscheidungen, die dahinterstehen:
//
// **Standardmäßig an.** Wer die Hinweise nicht braucht, schaltet sie unter
// „Konto" ab. Die umgekehrte Voreinstellung erreichte genau die nicht, für die
// sie gedacht sind — wer nicht weiß, was eine Sollstellung ist, sucht keinen
// Schalter für ihre Erklärung.
//
// **Serverseitig entschieden.** Der Hinweis wird gar nicht erst gerendert,
// wenn er aus ist. Die Alternative — rendern und per CSS verstecken — schickt
// den Text trotzdem über die Leitung und lässt ihn beim Laden kurz aufblitzen.
//
// **Was hier NICHT hineingehört:** Warnungen, Fehlermeldungen und Hinweise auf
// fehlende Daten. Ein abgeschalteter Tipp darf niemanden in einen Fehler
// laufen lassen, den er hätte vermeiden können. Dafür gibt es `<Alert>`.
import type { ReactNode } from "react";
import { getUser } from "@/lib/session";

/**
 * Erklärender Hinweis. Rendert nichts, wenn der angemeldete Nutzer die
 * Hinweise abgeschaltet hat.
 *
 * `getUser()` ist pro Request gecacht — beliebig viele `<Tipp>` auf einer Seite
 * kosten zusammen eine Abfrage, nicht eine je Hinweis.
 */
export async function Tipp({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const user = await getUser();
  if (!user?.showHints) return null;
  return <p className={`text-xs text-gray-500 ${className}`}>{children}</p>;
}

/**
 * Wie `Tipp`, aber ohne eigenen Absatz — für Hinweise mitten in einem Satz oder
 * in einer Tabellenzelle, wo ein `<p>` das Gefüge zerreißt.
 */
export async function TippInline({ children }: { children: ReactNode }) {
  const user = await getUser();
  if (!user?.showHints) return null;
  return <>{children}</>;
}

/**
 * Sind die Hinweise für den aktuellen Nutzer an?
 *
 * Für die Fälle, in denen nicht nur Text, sondern ein ganzer Block davon
 * abhängt (eine erklärende Karte, ein Beispiel). Bewusst eine eigene Funktion
 * statt `showHints` überall von Hand aus der Session zu ziehen: So gibt es eine
 * Stelle, an der die Regel steht.
 */
export async function hinweiseAn(): Promise<boolean> {
  const user = await getUser();
  return user?.showHints ?? true;
}
