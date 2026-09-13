// Stimmverbot bei Interessenkonflikt (§ 25 Abs. 4 WEG).
//
// ── Was das Gesetz sagt ──────────────────────────────────────────────────────
//
// § 25 Abs. 4 WEG: Ein Wohnungseigentümer ist nicht stimmberechtigt, wenn die
// Beschlussfassung die Vornahme eines Rechtsgeschäfts **mit ihm** oder die
// Einleitung oder Erledigung eines Rechtsstreits der übrigen Wohnungseigentümer
// **gegen ihn** betrifft (oder er nach § 17 WEG rechtskräftig zur Veräußerung
// verurteilt ist).
//
// Die **Entlastung** fällt darunter: Sie ist nach gefestigter Auffassung ein
// negatives Schuldanerkenntnis im Sinne von § 397 Abs. 2 BGB — die Gemeinschaft
// erklärt, keine Ansprüche mehr geltend zu machen. Das ist ein Rechtsgeschäft
// mit dem Entlasteten. Der Verwalter darf deshalb über seine eigene Entlastung
// nicht mitstimmen, auch wenn er Wohnungseigentümer ist; dasselbe gilt für ein
// Beiratsmitglied bei der Entlastung des Beirats.
//
// ── Warum das eine Sperre ist und keine Warnung ──────────────────────────────
//
// Eine verbotene Stimme ist nicht bloß unschön, sie ist **nicht mitzuzählen**.
// Wird sie mitgezählt und war sie entscheidungserheblich, ist der Beschluss
// nach § 44 WEG anfechtbar — und zwar der ganze. Für ein Produkt, das
// Selbstverwaltern Rechtssicherheit verspricht, wäre eine Warnung, die man
// wegklickt, die falsche Antwort. Im Prüflauf nahm das System die Stimme des
// Verwalters für seine eigene Entlastung kommentarlos an.
//
// ── Was hier bewusst NICHT gesperrt wird ─────────────────────────────────────
//
// Die **Verwalterbestellung**. Ob das Stimmverbot dort greift, ist umstritten:
// Die Bestellung ist ein organisationsrechtlicher Akt, erst der Abschluss des
// Verwaltervertrags ein Rechtsgeschäft mit dem Bestellten. Eine Sperre würde
// hier einen zulässigen Fall unmöglich machen. Deshalb nur ein Hinweis — die
// Gemeinschaft entscheidet, das Programm sagt ihr, worauf sie achten muss.
//
// ── Reines Modul ─────────────────────────────────────────────────────────────
//
// Ohne Datenbank und ohne Prisma, damit die Regel prüfbar bleibt. Wer die
// Beteiligten lädt, steht in `stimmverbot-service.ts`.

/** Worum es bei diesem Beschluss geht, soweit das Portal es weiß. */
export type BeschlussThema =
  | "ENTLASTUNG_VERWALTUNG"
  | "ENTLASTUNG_BEIRAT"
  | "VERWALTERBESTELLUNG"
  | null;

/**
 * Erkennt das Thema eines Beschlusses.
 *
 * Zuerst am `templateKey` des Tagesordnungspunkts — das ist die verlässliche
 * Quelle, weil sie beim Anlegen aus dem Vorlagenkatalog stammt und nicht am
 * Titel hängt, den jemand nachträglich ändert.
 *
 * Der Titelabgleich ist der Rückfall für zwei Fälle: von Hand angelegte TOPs
 * (die Vorlage ist ein Angebot, keine Pflicht) und den Bestand aus der Zeit vor
 * dem Feld. Er ist bewusst eng: Ein verpasster Treffer kostet die Sperre, ein
 * falscher nimmt jemandem sein Stimmrecht. Im Zweifel also lieber nicht sperren
 * — deshalb muss „entlastung" wirklich dastehen, nicht bloß „verwaltung".
 */
export function erkenneThema(top: {
  templateKey?: string | null;
  title?: string | null;
}): BeschlussThema {
  const key = top.templateKey;
  if (key === "ENTLASTUNG_VERWALTUNG") return "ENTLASTUNG_VERWALTUNG";
  if (key === "ENTLASTUNG_BEIRAT") return "ENTLASTUNG_BEIRAT";
  if (key === "VERWALTERBESTELLUNG") return "VERWALTERBESTELLUNG";
  // Der alte, gemeinsame Schlüssel aus der Zeit vor der Aufteilung: Er betraf
  // Verwaltung UND Beirat, also beide Personenkreise.
  if (key === "ENTLASTUNG") return "ENTLASTUNG_VERWALTUNG";

  const t = (top.title ?? "").toLowerCase();
  if (t.includes("entlastung")) {
    // Der Beirat wird ZUERST geprüft, und das ist kein Stilfrage: „Verwaltungs-
    // beirat" enthält „verwaltung". Andersherum geordnet läse die Regel jede
    // Beirats-Entlastung als Verwalter-Entlastung — und sperrte damit die
    // falsche Person, während die richtige mitstimmen dürfte. Genau so war es
    // zuerst geschrieben; der Test hat es gefunden.
    //
    // „Entlastung der Verwaltung / des Verwaltungsbeirats" (der gemeinsame
    // Titel im Bestand) enthält beides. Er wird als Beirats-Fall gelesen —
    // hier bewusst die engere Sperre, denn der gemeinsame TOP ist ohnehin die
    // Konstruktion, die aufgeteilt gehört, und lieber sperrt das Programm zu
    // wenig als den Falschen.
    if (t.includes("beirat")) return "ENTLASTUNG_BEIRAT";
    if (t.includes("verwaltung") || t.includes("verwalter")) return "ENTLASTUNG_VERWALTUNG";
    return "ENTLASTUNG_VERWALTUNG";
  }
  if (
    t.includes("verwalt") &&
    (t.includes("bestell") || t.includes("wahl") || t.includes("wiederbestell"))
  ) {
    return "VERWALTERBESTELLUNG";
  }
  return null;
}

/** Die Beteiligten eines Objekts, soweit sie für das Stimmverbot zählen. */
export type Beteiligte = {
  /**
   * Nutzer, die als Verwaltung dieses Objekts auftreten UND zugleich Eigentümer
   * sind. Nur dieser Schnitt ist gemeint: Ein externer Verwalter ohne Eigentum
   * hat ohnehin kein Stimmrecht, das man ihm nehmen könnte.
   */
  verwalterIds: string[];
  /** Eigentümer mit `Ownership.isBoardMember` (§ 29 WEG). */
  beiratsIds: string[];
};

export type StimmverbotBefund = {
  /** true = die Stimme darf nicht gezählt werden. */
  gesperrt: boolean;
  /** Für den Hinweis in der Oberfläche und die Fehlermeldung. */
  grund: string;
  /** Kurzform für den Fehler-Parameter in der URL. */
  code: "entlastung-verwaltung" | "entlastung-beirat" | "bestellung-hinweis";
};

/**
 * Darf diese Person über diesen Beschluss abstimmen?
 *
 * `null` heißt: kein Befund, ganz normale Stimmabgabe.
 */
export function pruefeStimmverbot(
  thema: BeschlussThema,
  userId: string,
  beteiligte: Beteiligte,
): StimmverbotBefund | null {
  if (!thema) return null;

  if (thema === "ENTLASTUNG_VERWALTUNG" && beteiligte.verwalterIds.includes(userId)) {
    return {
      gesperrt: true,
      code: "entlastung-verwaltung",
      grund:
        "Über die eigene Entlastung darf die Verwaltung nicht mitstimmen (§ 25 Abs. 4 WEG). " +
        "Die Entlastung ist ein Rechtsgeschäft mit ihr — eine trotzdem gezählte Stimme macht " +
        "den Beschluss anfechtbar, wenn sie den Ausschlag gab.",
    };
  }

  if (thema === "ENTLASTUNG_BEIRAT" && beteiligte.beiratsIds.includes(userId)) {
    return {
      gesperrt: true,
      code: "entlastung-beirat",
      grund:
        "Über die eigene Entlastung darf ein Mitglied des Verwaltungsbeirats nicht mitstimmen " +
        "(§ 25 Abs. 4 WEG). Die Entlastung ist ein Rechtsgeschäft mit ihm — eine trotzdem " +
        "gezählte Stimme macht den Beschluss anfechtbar, wenn sie den Ausschlag gab.",
    };
  }

  // Bestellung: Hinweis, keine Sperre — siehe Kopf der Datei.
  if (thema === "VERWALTERBESTELLUNG" && beteiligte.verwalterIds.includes(userId)) {
    return {
      gesperrt: false,
      code: "bestellung-hinweis",
      grund:
        "Diese Stimme betrifft die Bestellung der Person, die sie abgibt. Ob das Stimmverbot " +
        "des § 25 Abs. 4 WEG hier greift, ist umstritten: Die Bestellung selbst ist ein " +
        "organisationsrechtlicher Akt, erst der Verwaltervertrag ein Rechtsgeschäft mit ihr. " +
        "Die Stimme wird gezählt — im Streitfall sollte die Frage geprüft sein.",
    };
  }

  return null;
}

/**
 * Alle Personen, deren Stimme bei diesem Thema gesperrt ist.
 *
 * Für die Oberfläche: Sie soll die betroffenen Eigentümer gar nicht erst zur
 * Auswahl stellen, statt die Stimme hinterher abzulehnen.
 */
export function gesperrtePersonen(thema: BeschlussThema, beteiligte: Beteiligte): string[] {
  if (thema === "ENTLASTUNG_VERWALTUNG") return [...beteiligte.verwalterIds];
  if (thema === "ENTLASTUNG_BEIRAT") return [...beteiligte.beiratsIds];
  return [];
}
