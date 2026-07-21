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

const FLOOR_H = 80; // px – Höhe eines Stockwerks
const BASE_H = 30; // px – Höhe des Fundaments
const WINDOWS = 8; // Fenster je Stockwerk (4 × 2)

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

// Aufsteigende Partikel im Hintergrund – deterministisch (kein Hydration-Mismatch).
const PARTICLES = [
  { left: 6, size: 7, delay: 0.0, dur: 9.5, op: 0.5, green: true },
  { left: 16, size: 4, delay: 2.4, dur: 11.5, op: 0.35, green: false },
  { left: 27, size: 5, delay: 4.8, dur: 10.5, op: 0.4, green: true },
  { left: 38, size: 3, delay: 1.2, dur: 12.5, op: 0.3, green: false },
  { left: 49, size: 6, delay: 6.0, dur: 9.0, op: 0.45, green: false },
  { left: 60, size: 4, delay: 3.3, dur: 11.0, op: 0.35, green: true },
  { left: 71, size: 7, delay: 5.1, dur: 10.0, op: 0.5, green: false },
  { left: 82, size: 3, delay: 0.7, dur: 13.0, op: 0.3, green: true },
  { left: 91, size: 5, delay: 7.2, dur: 9.8, op: 0.4, green: false },
  { left: 33, size: 4, delay: 8.4, dur: 12.0, op: 0.32, green: true },
  { left: 55, size: 3, delay: 9.6, dur: 10.8, op: 0.3, green: false },
  { left: 76, size: 5, delay: 4.0, dur: 11.8, op: 0.42, green: true },
];

// ── Ambiente Hintergrundebene der Szene (Licht, Raster, Partikel) ──────────
function SceneAmbience({ progress }: { progress: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Driftende Lichtflächen mit sanfter Parallaxe */}
      <div
        className="absolute -right-16 top-4 h-80 w-80 rounded-full bg-brand-orange/20 blur-3xl"
        style={{ animation: "mkDrift 16s ease-in-out infinite", transform: `translateY(${progress * 60}px)` }}
      />
      <div
        className="absolute -left-24 bottom-0 h-96 w-96 rounded-full bg-brand-green/10 blur-3xl"
        style={{ animation: "mkDrift 22s ease-in-out infinite", ["--mk-dx" as string]: "-24px", ["--mk-dy" as string]: "18px", transform: `translateY(${progress * -40}px)` }}
      />
      {/* Feines Punktraster */}
      <div className="mk-grid absolute inset-0" style={{ animation: "mkGridPan 6s linear infinite" }} />
      {/* Aufsteigende Partikel */}
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className={`absolute bottom-[8%] rounded-full ${p.green ? "bg-brand-green/50" : "bg-brand-orange/60"}`}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            ["--mk-op" as string]: p.op,
            animation: `mkRise ${p.dur}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// Ein Fenster-Raster, dessen Lichter mit dem Fortschritt einzeln angehen.
function Windows({ lit, twinkle }: { lit: number; twinkle: boolean }) {
  return (
    <div className="mt-2 grid grid-cols-4 gap-1">
      {Array.from({ length: WINDOWS }).map((_, w) => {
        const on = w < lit;
        return (
          <span
            key={w}
            className="h-2.5 rounded-[2px]"
            style={{
              backgroundColor: on ? "var(--color-brand-orange)" : "rgba(255,255,255,0.1)",
              boxShadow: on ? "0 0 6px rgba(246,144,24,0.75)" : "none",
              transition: "background-color 0.35s ease, box-shadow 0.35s ease",
              animation: twinkle && on ? "mkPulseSoft 3s ease-in-out infinite" : "none",
              animationDelay: `${w * 160}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

// ── Das sich aufbauende Gebäude ───────────────────────────────────────────
function Building({ stage, progress }: { stage: number; progress: number }) {
  const N = STAGES.length; // 6
  const roofBottom = BASE_H + FLOORS.length * FLOOR_H;
  // Energie-Leiste füllt sich, bis das Dach steht (Fortschritt 4/6).
  const beamFill = easeOut(progress / (ROOF_AT / N));
  // Dach: gleitet kontinuierlich herein.
  const subRoof = clamp01(progress * N - ROOF_AT);
  const roofAppear = stage > ROOF_AT ? 1 : stage === ROOF_AT ? easeOut(subRoof) : 0;
  // Fertigstellung
  const done = stage >= DONE_AT;
  const subDone = clamp01(progress * N - DONE_AT);

  return (
    <div className="relative mx-auto h-[430px] w-[280px]">
      {/* Glühen bei Fertigstellung */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-orange/30 blur-3xl transition-opacity duration-700"
        style={{ opacity: done ? 0.55 + 0.45 * subDone : 0 }}
      />

      {/* Bodenschatten (Ellipse) */}
      <div
        className="absolute bottom-3 left-1/2 h-4 w-[240px] -translate-x-1/2 rounded-[50%] bg-brand-green/15 blur-md transition-opacity duration-500"
        style={{ opacity: 0.4 + beamFill * 0.4 }}
      />

      {/* Energie-Leiste (Daten fließen nach oben) */}
      <div className="absolute" style={{ left: 8, bottom: BASE_H, width: 4, height: FLOORS.length * FLOOR_H }}>
        <div className="absolute inset-0 rounded-full bg-gray-200" />
        <div
          className="absolute bottom-0 left-0 w-full rounded-full"
          style={{
            height: `${beamFill * 100}%`,
            background: "linear-gradient(to top, var(--color-brand-orange-dark), var(--color-brand-orange))",
            boxShadow: "0 0 10px rgba(246,144,24,0.6)",
            animation: "mkBeam 2.6s ease-in-out infinite",
          }}
        />
        {/* leuchtender Kopf der Leiste */}
        <div
          className="absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-brand-orange"
          style={{
            bottom: `calc(${beamFill * 100}% - 5px)`,
            boxShadow: "0 0 12px 3px rgba(246,144,24,0.75)",
            opacity: beamFill > 0.02 && beamFill < 0.99 ? 1 : 0,
            transition: "opacity 0.3s",
          }}
        />
      </div>

      {/* Dach + Gemeinschaft */}
      <div
        className="absolute left-1/2 flex w-[236px] flex-col items-center"
        style={{
          bottom: roofBottom,
          transform: `translateX(-50%) translateY(${(1 - roofAppear) * 40}px) scale(${0.9 + roofAppear * 0.1})`,
          opacity: roofAppear,
        }}
      >
        {/* Fahne (Richtfest) – erscheint bei Fertigstellung */}
        <div
          className="mb-1 flex flex-col items-center transition-all duration-500"
          style={{ opacity: done ? 1 : 0, transform: `translateY(${done ? 0 : 6}px)` }}
        >
          <div
            className="h-4 w-5 rounded-sm bg-brand-orange"
            style={{ transformOrigin: "left center", animation: done ? "mkFlag 2.4s ease-in-out infinite" : "none" }}
          />
          <div className="h-4 w-px bg-brand-green" />
        </div>
        {/* Menschen-Avatare (weichen bei Fertigstellung der Fahne) */}
        <div
          className="mb-2 flex gap-1.5 transition-opacity duration-500"
          style={{ opacity: done ? 0 : 1 }}
        >
          {["E", "B", "M", "H"].map((c, i) => (
            <span
              key={c}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-brand-green text-[11px] font-bold text-white shadow-md"
              style={{ animation: stage >= ROOF_AT ? "mkPopIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both" : "none", animationDelay: `${i * 90}ms` }}
            >
              {c}
            </span>
          ))}
        </div>
        {/* Dachschräge mit Tiefe */}
        <div className="relative">
          <div
            className="h-0 w-0 border-l-[122px] border-r-[122px] border-b-[48px] border-l-transparent border-r-transparent"
            style={{ borderBottomColor: "var(--color-brand-orange)" }}
          />
          {/* rechte Schattenseite des Dachs */}
          <div
            className="absolute right-0 top-0 h-0 w-0 border-l-[24px] border-b-[48px] border-l-transparent"
            style={{ borderBottomColor: "var(--color-brand-orange-dark)" }}
          />
        </div>
      </div>

      {/* Stockwerke */}
      {FLOORS.map((floor, i) => {
        const s = floor.showAt;
        const sub = clamp01(progress * N - s);
        const appear = stage > s ? 1 : stage === s ? easeOut(sub) : 0;
        const litFrac = stage > s ? 1 : stage === s ? easeOut(sub) : 0;
        const lit = Math.round(litFrac * WINDOWS);
        const active = stage === s;
        const Icon = floor.icon;
        return (
          <div
            key={floor.label}
            className="absolute left-1/2 w-[236px]"
            style={{
              bottom: BASE_H + i * FLOOR_H,
              height: FLOOR_H - 6,
              transform: `translateX(-50%) translateY(${(1 - appear) * 44}px) scale(${0.94 + appear * 0.06})`,
              opacity: appear,
            }}
          >
            {/* Tiefenkörper (rechte Seite) */}
            <div className="absolute inset-0 translate-x-[7px] translate-y-[4px] rounded-lg bg-brand-green-dark" />
            {/* Vorderseite */}
            <div
              className={`relative h-full rounded-lg border bg-gradient-to-b from-brand-green-light to-brand-green px-3 py-2 transition-shadow duration-500 ${
                active
                  ? "border-brand-orange shadow-[0_0_38px_rgba(246,144,24,0.5)]"
                  : "border-white/10 shadow-lg shadow-black/25"
              }`}
            >
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-white">
                <Icon className="h-4 w-4 text-brand-orange" />
                {floor.label}
              </span>
              <Windows lit={lit} twinkle={stage > s} />
            </div>
          </div>
        );
      })}

      {/* Fundament: isometrischer Sockel */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 0 }}>
        <div className="absolute inset-0 translate-x-[7px] translate-y-[4px] rounded-md bg-brand-green-dark/40" />
        <div
          className="relative flex w-[264px] items-center justify-center gap-2 rounded-md border border-gray-200 bg-white text-[11px] font-medium text-gray-600 shadow-e2"
          style={{ height: BASE_H }}
        >
          <Users className="h-3.5 w-3.5 text-brand-orange-ink" />
          Einheiten · Miteigentumsanteile · Konten
        </div>
      </div>

      {/* Funkeln bei Fertigstellung */}
      {done
        ? [
            { top: "8%", left: "24%", d: 0 },
            { top: "16%", left: "78%", d: 0.4 },
            { top: "32%", left: "12%", d: 0.8 },
            { top: "6%", left: "60%", d: 1.2 },
            { top: "26%", left: "88%", d: 0.2 },
          ].map((sp, i) => (
            <span
              key={i}
              className="pointer-events-none absolute h-2 w-2 bg-brand-orange"
              style={{
                top: sp.top,
                left: sp.left,
                clipPath: "polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%)",
                animation: `mkSparkle 1.8s ease-out ${sp.d}s infinite`,
              }}
            />
          ))
        : null}

      {/* „Fertig"-Plakette */}
      <div
        className="absolute left-1/2 flex items-center gap-1.5 rounded-full bg-good px-3 py-1 text-xs font-semibold text-white shadow-lg transition-all duration-500"
        style={{
          bottom: roofBottom + 96,
          opacity: done ? 1 : 0,
          transform: `translateX(-50%) translateY(${done ? 0 : 8}px)`,
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
      // 120vh Scroll-Strecke je Stufe: ruhigeres Tempo, jede Stufe bekommt
      // genug Verweildauer für einen sauberen Durchlauf.
      style={{ height: `${STAGES.length * 120}vh` }}
      className="relative"
    >
      {/* h-svh statt h-screen (korrekt bei mobiler Browserleiste); das obere
          Padding hält den Inhalt unter der fixierten Kopfzeile frei. */}
      <div className="sticky top-0 flex h-svh items-center overflow-hidden pb-4 pt-32 lg:pt-16">
        <SceneAmbience progress={progress} />
        {/* feine Rahmenlinien: die Szene liest sich als eigene „Leinwand" */}
        <div className="absolute inset-x-0 top-0 h-px bg-gray-200/80" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gray-200/80" />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-2">
          {/* Linke Spalte: Fortschritt + wechselnder Text */}
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-orange-ink">
              So bauen Sie Ihre Selbstverwaltung auf
            </p>

            {/* Schritt-Ziffer + kontinuierlich mitlaufende Fortschrittsleiste */}
            <div className="mt-4 flex items-center gap-4">
              <span className="font-display text-2xl font-extrabold tabular-nums leading-none text-brand-green-dark">
                {String(stage + 1).padStart(2, "0")}
                <span className="ml-1 align-middle text-sm font-semibold text-gray-400">/ 06</span>
              </span>
              <div className="flex flex-1 gap-1.5">
                {STAGES.map((s, i) => {
                  // Füllt sich stufenlos mit dem Scroll-Fortschritt statt zu springen
                  const fill = clamp01(progress * STAGES.length - i);
                  return (
                    <div key={s.title} className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-brand-orange"
                        style={{ width: `${fill * 100}%` }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Textpanels – nur das aktive sichtbar (Cross-Fade) */}
            <div className="relative mt-6 min-h-[248px]">
              {STAGES.map((s, i) => (
                <div
                  key={s.title}
                  className="absolute inset-0 transition-all duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"
                  style={{
                    opacity: i === stage ? 1 : 0,
                    transform: i === stage ? "translateY(0)" : i < stage ? "translateY(-16px)" : "translateY(16px)",
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

          {/* Rechte Spalte: das sich aufbauende Gebäude. Auf kleinen Screens
              herunterskaliert (negative Margins gleichen die Layout-Höhe aus),
              damit die komplette Szene in einen Viewport passt – nichts wird
              abgeschnitten. */}
          <div
            className="flex items-center justify-center"
            style={{ transform: `translateY(${(0.5 - progress) * 24}px)` }}
          >
            <div className="-my-16 scale-[0.68] sm:-my-6 sm:scale-90 lg:my-0 lg:scale-100">
              <Building stage={stage} progress={progress} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
