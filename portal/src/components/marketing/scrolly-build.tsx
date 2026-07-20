"use client";

// Scroll-gesteuerter Aufbau („Scrollytelling") im Stil aufwändiger
// Kampagnen-Seiten: Eine gepinnte Szene in der Mitte baut sich beim Scrollen
// Stockwerk für Stockwerk auf – Fundament (Einheiten & MEA) → Finanzen →
// Hausgeld → Versammlung → Gemeinschaft (Dach) → fertig. Links wechselt
// synchron der Erklärtext. Umgesetzt in reinem React + CSS (kein Video):
// ein hoher „Track" gibt die Scroll-Länge vor, ein `position: sticky`-Container
// hält die Szene im Blick, der Scroll-Fortschritt steuert die aktive Stufe.
// prefers-reduced-motion → statische, gestapelte Darstellung.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  HandCoins,
  Landmark,
  Users,
  Vote,
  type LucideIcon,
} from "lucide-react";
import { buttonClass } from "@/components/ui";

type Stage = {
  step: string;
  title: string;
  text: string;
  badge: string;
};

const STAGES: Stage[] = [
  {
    step: "Schritt 1 · Das Fundament",
    title: "Ihre WEG als Basis",
    text:
      "Einheiten mit Miteigentumsanteilen, Konten und Kostenarten anlegen. Das " +
      "Portal prüft die MEA-Summe automatisch – Tippfehler fallen sofort auf.",
    badge: "6 Einheiten · MEA 1000 / 1000 ✓",
  },
  {
    step: "Schritt 2 · Finanzen",
    title: "Wirtschaftsplan & Buchhaltung",
    text:
      "Kosten planen, per CSV-Bankimport buchen, Belege anhängen und die " +
      "Erhaltungsrücklage strikt getrennt führen – ganz ohne Buchhalter.",
    badge: "12 Sollstellungen je Einheit – centgenau",
  },
  {
    step: "Schritt 3 · Hausgeld",
    title: "Hausgeld & Mahnwesen",
    text:
      "Sollstellungen entstehen automatisch aus dem Plan. Rückstände je Einheit " +
      "im Blick, Mahnungen als fertiger DIN-A4-Brief.",
    badge: "Soll / Ist / Saldo je Einheit",
  },
  {
    step: "Schritt 4 · Versammlung",
    title: "Beschlüsse nach MEA",
    text:
      "Versammlung vorbereiten, Anwesenheit erfassen, nach Miteigentumsanteilen " +
      "abstimmen und Beschlüsse dauerhaft in der Beschluss-Sammlung dokumentieren.",
    badge: "Abstimmung nach Miteigentumsanteilen",
  },
  {
    step: "Schritt 5 · Gemeinschaft",
    title: "Alle unter einem Dach",
    text:
      "Eigentümer, Beirat, Mieter und Handwerker – jeder mit eigenem Zugang und " +
      "genau den Rechten, die er braucht. Auch bequem am Handy.",
    badge: "4 Rollen · 1 Portal",
  },
  {
    step: "Fertig",
    title: "Ihre WEG – komplett selbst verwaltet",
    text:
      "Von der ersten Buchung bis zur revisionssicheren Jahresabrechnung. Kein " +
      "Verwalter nötig, alles an einem Ort – und der Start ist kostenlos.",
    badge: "Ordnungsmäßige Verwaltung nach § 28 WEG",
  },
];

// Stockwerke des Gebäudes – erscheinen ab der jeweiligen Stufe.
const FLOORS: { icon: LucideIcon; label: string; showAt: number }[] = [
  { icon: Landmark, label: "Finanzen", showAt: 1 },
  { icon: HandCoins, label: "Hausgeld", showAt: 2 },
  { icon: Vote, label: "Versammlung", showAt: 3 },
];
const ROOF_AT = 4;
const DONE_AT = 5;

const FLOOR_H = 74; // px – Höhe eines Stockwerks
const BASE_H = 26; // px – Höhe des Fundaments

// ── Das sich aufbauende Gebäude ───────────────────────────────────────────
function Building({ stage }: { stage: number }) {
  const settled = "translateX(-50%) translateY(0) scale(1)";
  const hidden = "translateX(-50%) translateY(34px) scale(0.96)";
  const roofBottom = BASE_H + FLOORS.length * FLOOR_H;

  return (
    <div className="relative mx-auto h-[380px] w-[300px]">
      {/* Glühen bei Fertigstellung */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-orange/25 blur-3xl transition-opacity duration-700"
        style={{ opacity: stage >= DONE_AT ? 1 : 0 }}
      />

      {/* Bodenlinie */}
      <div className="absolute bottom-[18px] left-1/2 h-px w-[290px] -translate-x-1/2 bg-gray-300" />

      {/* Dach + Gemeinschaft */}
      <div
        className="absolute left-1/2 flex w-[236px] flex-col items-center transition-all duration-700 ease-out"
        style={{ bottom: roofBottom, transform: stage >= ROOF_AT ? settled : hidden, opacity: stage >= ROOF_AT ? 1 : 0 }}
      >
        {/* Menschen-Avatare (weichen bei Fertigstellung dem „Fertig"-Haken) */}
        <div
          className="mb-2 flex gap-1.5 transition-opacity duration-500"
          style={{ opacity: stage >= DONE_AT ? 0 : 1 }}
        >
          {["E", "B", "M", "H"].map((c, i) => (
            <span
              key={c}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-brand-green text-[11px] font-bold text-white"
              style={{ animation: stage >= ROOF_AT ? "mkPopIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both" : "none", animationDelay: `${i * 90}ms` }}
            >
              {c}
            </span>
          ))}
        </div>
        {/* Dachschräge */}
        <div
          className="h-0 w-0 border-l-[124px] border-r-[124px] border-b-[46px] border-l-transparent border-r-transparent"
          style={{ borderBottomColor: "var(--color-brand-orange)" }}
        />
      </div>

      {/* Stockwerke */}
      {FLOORS.map((floor, i) => {
        const visible = stage >= floor.showAt;
        const active = stage === floor.showAt;
        const Icon = floor.icon;
        return (
          <div
            key={floor.label}
            className={`absolute left-1/2 w-[236px] rounded-lg border bg-brand-green px-3 py-2 transition-all duration-700 ease-out ${
              active
                ? "border-brand-orange shadow-[0_0_34px_rgba(246,144,24,0.45)]"
                : "border-transparent shadow-lg shadow-black/20"
            }`}
            style={{
              bottom: BASE_H + i * FLOOR_H,
              height: FLOOR_H - 8,
              transform: visible ? settled : hidden,
              opacity: visible ? 1 : 0,
            }}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                <Icon className="h-4 w-4 text-brand-orange" />
                {floor.label}
              </span>
              {/* Fenster, die „angehen" */}
              <span className="flex gap-1">
                {[0, 1, 2].map((w) => (
                  <span
                    key={w}
                    className="h-3 w-3 rounded-[3px]"
                    style={{
                      backgroundColor: visible ? "var(--color-brand-orange)" : "rgba(255,255,255,0.12)",
                      opacity: visible ? undefined : 1,
                      animation: visible ? "mkPulseSoft 2.6s ease-in-out infinite" : "none",
                      animationDelay: `${w * 400}ms`,
                      transition: "background-color 0.5s",
                    }}
                  />
                ))}
              </span>
            </div>
          </div>
        );
      })}

      {/* Fundament: Einheiten & MEA */}
      <div
        className="absolute left-1/2 flex w-[264px] -translate-x-1/2 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white text-[11px] font-medium text-gray-600 shadow-e1"
        style={{ bottom: 0, height: BASE_H }}
      >
        <Users className="h-3.5 w-3.5 text-brand-orange-ink" />
        Einheiten · Miteigentumsanteile · Konten
      </div>

      {/* „Fertig"-Haken – nimmt bei Fertigstellung den Platz der Avatare ein */}
      <div
        className="absolute left-1/2 flex items-center gap-1.5 rounded-full bg-good px-3 py-1 text-xs font-semibold text-white shadow-lg transition-all duration-500"
        style={{
          bottom: roofBottom + 52,
          opacity: stage >= DONE_AT ? 1 : 0,
          transform: `translateX(-50%) translateY(${stage >= DONE_AT ? 0 : 8}px)`,
        }}
      >
        <CheckCircle2 className="h-4 w-4" /> Selbstverwaltung steht
      </div>
    </div>
  );
}

// ── Fallback ohne Animation (prefers-reduced-motion) ──────────────────────
function ReducedFallback() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <h2 className="text-2xl font-bold text-brand-green-dark sm:text-3xl">
        So bauen Sie Ihre Selbstverwaltung auf
      </h2>
      <ol className="mt-8 space-y-4">
        {STAGES.map((s, i) => (
          <li key={s.title} className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-e1">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-orange font-display text-base font-bold text-brand-green-dark">
              {i + 1}
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-orange-ink">{s.step}</p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ScrollyBuild() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    // Erste Auswertung asynchron, damit kein synchrones setState im Effect.
    const id = requestAnimationFrame(apply);
    mq.addEventListener?.("change", apply);
    return () => {
      cancelAnimationFrame(id);
      mq.removeEventListener?.("change", apply);
    };
  }, []);

  useEffect(() => {
    if (reduced) return;
    const track = trackRef.current;
    if (!track) return;
    // Direkt im Scroll-Handler rechnen (kein rAF): getBoundingClientRect für ein
    // einzelnes Element ist günstig, und so bleibt der Fortschritt auch dort
    // korrekt, wo rAF pausiert (z. B. Hintergrund-Tab / prerender).
    const update = () => {
      const total = track.offsetHeight - window.innerHeight;
      const scrolled = Math.min(Math.max(-track.getBoundingClientRect().top, 0), Math.max(total, 1));
      const p = total > 0 ? scrolled / total : 0;
      setProgress(p);
      // Etwas Vorlauf, damit die letzte Stufe sicher erreicht wird.
      setStage(Math.min(STAGES.length - 1, Math.floor(p * STAGES.length * 1.001)));
    };
    // Initiale Auswertung asynchron (kein synchrones setState im Effect-Body).
    const t = setTimeout(update, 0);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [reduced]);

  // Bei reduzierter Bewegung: statische, gestapelte Liste.
  if (reduced) return <ReducedFallback />;

  const isLast = stage === STAGES.length - 1;

  return (
    <section
      ref={trackRef}
      aria-label="So bauen Sie Ihre Selbstverwaltung auf"
      style={{ height: `${STAGES.length * 100}vh` }}
      className="relative"
    >
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-2">
          {/* Linke Spalte: Fortschritt + wechselnder Text */}
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-orange-ink">
              So bauen Sie Ihre Selbstverwaltung auf
            </p>

            {/* Fortschrittsleiste mit 6 Segmenten */}
            <div className="mt-4 flex gap-1.5">
              {STAGES.map((s, i) => (
                <div key={s.title} className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-brand-orange transition-all duration-500"
                    style={{ width: i < stage ? "100%" : i === stage ? "100%" : "0%", opacity: i <= stage ? 1 : 0.3 }}
                  />
                </div>
              ))}
            </div>

            {/* Textpanels – nur das aktive sichtbar (Cross-Fade) */}
            <div className="relative mt-6 min-h-[248px]">
              {STAGES.map((s, i) => (
                <div
                  key={s.title}
                  className="absolute inset-0 transition-all duration-500"
                  style={{
                    opacity: i === stage ? 1 : 0,
                    transform: i === stage ? "translateY(0)" : "translateY(12px)",
                    pointerEvents: i === stage ? "auto" : "none",
                  }}
                  aria-hidden={i !== stage}
                >
                  <p className="text-sm font-semibold text-brand-orange-ink">{s.step}</p>
                  <h2 className="mt-2 text-3xl font-extrabold leading-tight text-brand-green-dark sm:text-4xl">
                    {s.title}
                  </h2>
                  <p className="mt-4 max-w-md text-base leading-relaxed text-gray-600">{s.text}</p>
                  <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-brand-orange/50 bg-brand-orange-light px-3 py-1.5 text-xs font-semibold text-brand-orange-ink">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {s.badge}
                  </p>
                  {i === STAGES.length - 1 ? (
                    <div className="mt-6">
                      <Link href="/registrieren" className={`${buttonClass} px-6 py-3 text-base`}>
                        Jetzt kostenlos starten
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {/* Scroll-Hinweis (verblasst nach Beginn) */}
            <p
              className="mt-2 text-xs text-gray-500 transition-opacity duration-500"
              style={{ opacity: isLast ? 0 : 0.9 }}
            >
              ↓ Scrollen, um Ihre WEG aufzubauen
            </p>
          </div>

          {/* Rechte Spalte: das sich aufbauende Gebäude */}
          <div
            className="flex items-center justify-center"
            style={{ transform: `translateY(${(0.5 - progress) * 20}px)` }}
          >
            <Building stage={stage} />
          </div>
        </div>
      </div>
    </section>
  );
}
