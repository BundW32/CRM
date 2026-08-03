// Vanilla-Treiber der Chat-Vorschau.
//
// Das eingebettete Markup ist servergerendert, also der Zustand VOR der
// Hydratation: Die Bau-Szene steht auf Stufe 1, und alle `.mk-reveal`-Blöcke
// sind noch unsichtbar. Dieser Treiber übernimmt beides — er rechnet dieselben
// Formeln wie `scrolly-build.tsx` und schreibt in dieselben `data-`-Attribute.
//
// Bewusst gespiegelt statt neu erfunden: Weicht eine der Formeln ab, läuft die
// Vorschau sichtbar anders als die Seite, für die sie wirbt.
(() => {
  "use strict";

  const STUFEN = 6; // STAGES.length
  const DACH_AB = 4; // ROOF_AT
  const FERTIG_AB = 5; // DONE_AT

  const klemm = (t) => Math.max(0, Math.min(1, t));
  const easeOut = (t) => 1 - Math.pow(1 - klemm(t), 3);
  const reduziert = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── Abschnitte einblenden ────────────────────────────────────────────────
  // In der App macht das `Reveal` per IntersectionObserver.
  const reveals = document.querySelectorAll(".mk-reveal");
  if (reduziert) {
    reveals.forEach((el) => el.classList.add("is-visible"));
  } else {
    const io = new IntersectionObserver(
      (eintraege) => {
        for (const e of eintraege) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    reveals.forEach((el) => io.observe(el));
  }

  // ── Bau-Szene ────────────────────────────────────────────────────────────
  const track = document.querySelector('[aria-label="So bauen Sie Ihre Selbstverwaltung auf"]');
  if (!track || reduziert) return;

  const stepnum = track.querySelector("[data-stepnum]");
  const segmente = track.querySelectorAll("[data-seg]");
  const panels = track.querySelectorAll("[data-panel]");
  const hinweis = track.querySelector("[data-hint]");
  const hausWrap = track.querySelector("[data-buildingwrap]");
  const glow = track.querySelector("[data-glow]");
  const kran = track.querySelector("[data-crane]");
  const teile = track.querySelectorAll("[data-part]");
  const fenster = track.querySelectorAll("[data-win]");
  const katze = track.querySelector("[data-cat]");
  const dachglow = track.querySelector("[data-atticg]");
  const figuren = track.querySelector("[data-figs]");
  const extras = track.querySelector("[data-doneextra]");
  const funkeln = track.querySelector("[data-sparkles]");

  // Glasfarben aus dem gerenderten Markup lesen, statt sie hier zu wiederholen.
  const GLAS_AN = "#ffd489";
  const GLAS_AUS = "#cfe0dd";

  let letzteStufe = -1;

  const zeichne = () => {
    const gesamt = track.offsetHeight - window.innerHeight;
    const gescrollt = Math.min(Math.max(-track.getBoundingClientRect().top, 0), Math.max(gesamt, 1));
    const p = gesamt > 0 ? gescrollt / gesamt : 0;
    const stufe = Math.min(STUFEN - 1, Math.floor(p * STUFEN * 1.001));
    const fertig = stufe >= FERTIG_AB;
    const teilFertig = klemm(p * STUFEN - FERTIG_AB);

    const auftauchen = (s) => (stufe > s ? 1 : stufe === s ? easeOut(klemm(p * STUFEN - s)) : 0);

    // Fortschrittsleiste läuft stufenlos mit, die Ziffer springt.
    segmente.forEach((seg, i) => {
      seg.style.width = `${klemm(p * STUFEN - i) * 100}%`;
    });
    if (stufe !== letzteStufe) {
      if (stepnum) stepnum.textContent = String(stufe + 1).padStart(2, "0");
      panels.forEach((panel, i) => {
        panel.style.opacity = i === stufe ? "1" : "0";
        panel.style.transform =
          i === stufe ? "translateY(0)" : i < stufe ? "translateY(-16px)" : "translateY(16px)";
        panel.style.pointerEvents = i === stufe ? "auto" : "none";
        panel.setAttribute("aria-hidden", i === stufe ? "false" : "true");
      });
      letzteStufe = stufe;
    }
    if (hinweis) hinweis.style.opacity = stufe === STUFEN - 1 ? "0" : "0.9";
    if (hausWrap) hausWrap.style.transform = `translateY(${(0.5 - p) * 24}px)`;
    if (glow) glow.style.opacity = fertig ? String(0.55 + 0.45 * teilFertig) : "0";

    // Bauteile steigen an ihren Platz.
    teile.forEach((g) => {
      const s = Number(g.dataset.part);
      const a = auftauchen(s);
      g.style.transform = `translateY(${(1 - a) * 46}px)`;
      g.style.opacity = String(a);
    });
    if (kran) {
      const a = auftauchen(0);
      kran.style.transform = `translateY(${(1 - a) * 46}px)`;
      kran.style.opacity = fertig ? "0" : String(a);
    }

    // Fenster eines Stockwerks gehen während seiner Stufe einzeln an.
    fenster.forEach((g) => {
      const etage = Number(g.dataset.wfloor);
      const idx = Number(g.dataset.widx);
      const cnt = Number(g.dataset.wcnt);
      const an = Math.round(auftauchen(etage) * cnt) > idx;
      g.style.filter = an ? "drop-shadow(0 0 5px rgba(246,144,24,0.85))" : "none";
      const glas = g.querySelector("[data-glass]");
      if (glas) glas.setAttribute("fill", an ? GLAS_AN : GLAS_AUS);
    });

    if (katze) katze.style.opacity = fertig ? "1" : "0";
    if (extras) extras.style.opacity = fertig ? "1" : "0";
    if (funkeln) funkeln.style.opacity = fertig ? "1" : "0";
    if (figuren) figuren.style.opacity = stufe >= DACH_AB ? "1" : "0";
    if (dachglow) {
      dachglow.style.filter = fertig ? "drop-shadow(0 0 5px rgba(246,144,24,0.85))" : "none";
      const glas = dachglow.querySelector("[data-glass]");
      if (glas) glas.setAttribute("fill", fertig ? GLAS_AN : GLAS_AUS);
    }
  };

  zeichne();
  window.addEventListener("scroll", zeichne, { passive: true });
  window.addEventListener("resize", zeichne);
})();
