"use client";

// Scroll-gesteuerter Aufbau („Scrollytelling") im Stil aufwändiger
// Kampagnen-Seiten: Eine gepinnte Szene in der Mitte baut sich beim Scrollen
// Stockwerk für Stockwerk auf – Fundament (Einheiten & MEA) → Finanzen →
// Hausgeld → Versammlung → Gemeinschaft (Dach) → fertig. Links wechselt
// synchron der Erklärtext. Umgesetzt in reinem React + CSS (kein Video):
// ein hoher „Track" gibt die Scroll-Länge vor, ein `position: sticky`-Container
// hält die Szene im Blick, der Scroll-Fortschritt steuert die aktive Stufe.
// prefers-reduced-motion → statische, gestapelte Darstellung.

import { useEffect, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Users } from "lucide-react";
import { wpButtonClass } from "./brand";

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
    title: "Hausgeld & Zahlungseingang",
    text:
      "Sollstellungen entstehen automatisch aus dem Plan. Rückstände je Einheit " +
      "im Blick, Mahnungen als fertiger DIN-A4-Brief.",
    badge: "Soll / Ist / Saldo je Einheit",
  },
  {
    step: "Schritt 4 · Versammlung",
    title: "Beschlüsse mit Bestand",
    text:
      "Versammlung vorbereiten, Anwesenheit erfassen, abstimmen nach dem " +
      "Stimmprinzip Ihrer Gemeinschaft – Kopf, MEA oder Objekt – und Beschlüsse " +
      "dauerhaft in der Beschluss-Sammlung dokumentieren.",
    badge: "Stimmprinzip: Kopf · MEA · Objekt",
  },
  {
    step: "Schritt 5 · Gemeinschaft",
    title: "Alle unter einem Dach",
    text:
      "Eigentümer, Beirat und Mieter – jeder mit eigenem Zugang und genau den " +
      "Rechten, die er braucht, auch am Handy. Schäden werden mit Foto im " +
      "Portal gemeldet und bis zur Erledigung nachverfolgt.",
    badge: "Ein Portal für alle im Haus",
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

// Bauphasen des Hauses: 0 Grundstück, 1 EG, 2 OG1, 3 OG2, 4 Dach, 5 fertig.
const ROOF_AT = 4;
const DONE_AT = 5;

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
        className="absolute -right-16 top-4 h-80 w-80 rounded-full bg-wp-accent/20 blur-3xl"
        style={{ animation: "mkDrift 16s ease-in-out infinite", transform: `translateY(${progress * 60}px)` }}
      />
      <div
        className="absolute -left-24 bottom-0 h-96 w-96 rounded-full bg-wp-primary/10 blur-3xl"
        style={{ animation: "mkDrift 22s ease-in-out infinite", ["--mk-dx" as string]: "-24px", ["--mk-dy" as string]: "18px", transform: `translateY(${progress * -40}px)` }}
      />
      {/* Feines Punktraster */}
      <div className="mk-grid absolute inset-0" style={{ animation: "mkGridPan 6s linear infinite" }} />
      {/* Aufsteigende Partikel */}
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className={`absolute bottom-[8%] rounded-full ${p.green ? "bg-wp-primary/50" : "bg-wp-accent/60"}`}
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

// ── Das Comic-Haus: baut sich Stockwerk für Stockwerk auf ─────────────────
// Handgezeichnete SVG-Illustration im flachen Comic-Stil (dicke dunkelgrüne
// Umrisse, Creme-Fassade, oranges Satteldach). Jede Bauphase gleitet stufenlos
// mit dem Scroll-Fortschritt an ihren Platz; die Fenster gehen einzeln an.
// Während des Baus steht ein Kran daneben, bei Fertigstellung: Fahne, Rauch,
// Katze im Fenster und zwei Bewohner vor der Tür.
//
// Die vier Grundtöne stehen hier als feste Werte und nicht als CSS-Variablen:
// Sie werden für Verläufe und Filter im SVG auch rechnerisch abgewandelt.
// Wer die Marke umfärbt, ändert sie hier mit.
const OUTLINE = "#00241f"; /* wp-ink */
const FACADE = "#fbf3e0";
const GLASS_OFF = "#cfe0dd";
const GLASS_ON = "#ffd489";
const TRIM = "var(--color-wp-primary)"; /* Kran, Tür, Blumenkasten */

// Comic-Fenster mit Kreuzsprosse; `on` schaltet warmes Licht + Glühen.
function Win({ x, y, on, w = 30, h = 42, floor, idx, cnt }: { x: number; y: number; on: boolean; w?: number; h?: number; floor: number; idx: number; cnt: number }) {
  return (
    <g
      data-win
      data-wfloor={floor}
      data-widx={idx}
      data-wcnt={cnt}
      style={{ filter: on ? "drop-shadow(0 0 5px rgba(246,144,24,0.85))" : "none" }}
    >
      <rect x={x} y={y} width={w} height={h} rx={4} fill={OUTLINE} />
      <rect
        x={x + 3.5}
        y={y + 3.5}
        width={w - 7}
        height={h - 7}
        rx={2}
        data-glass
        fill={on ? GLASS_ON : GLASS_OFF}
        style={{ transition: "fill 0.4s" }}
      />
      <line x1={x + w / 2} y1={y + 3} x2={x + w / 2} y2={y + h - 3} stroke={OUTLINE} strokeWidth={2.5} />
      <line x1={x + 3} y1={y + h / 2} x2={x + w - 3} y2={y + h / 2} stroke={OUTLINE} strokeWidth={2.5} />
    </g>
  );
}

// Blumenkasten unter einem Fenster
function FlowerBox({ x, y, w = 34 }: { x: number; y: number; w?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={7} rx={2.5} fill={TRIM} stroke={OUTLINE} strokeWidth={2} />
      {[0.2, 0.5, 0.8].map((f) => (
        <circle key={f} cx={x + w * f} cy={y - 2} r={3.2} fill="var(--color-wp-accent)" />
      ))}
    </g>
  );
}

// `className` bestimmt die Größe des Hauses — die Zeichnung selbst ist ein
// SVG mit `inset-0` und skaliert mit. Die kleinen Ausgaben in der gestapelten
// Liste (Mobil, reduzierte Bewegung) sind Deko neben dem Schritt-Text und
// bekommen deshalb `dekorativ`, damit Screenreader die Bauphase nicht
// sechsmal vorlesen.
function Building({
  stage,
  progress,
  className = "h-[430px] w-[300px]",
  dekorativ = false,
  lottieRef,
  lottieBereit = false,
}: {
  stage: number;
  progress: number;
  className?: string;
  dekorativ?: boolean;
  /** Behälter für die Lottie-Zeichnung – nur die gepinnte Szene setzt ihn. */
  lottieRef?: RefObject<HTMLDivElement | null>;
  /** Sobald Lottie steht, weicht die SVG-Fassung; sonst bleibt sie stehen. */
  lottieBereit?: boolean;
}) {
  const N = STAGES.length; // 6
  const done = stage >= DONE_AT;
  const subDone = clamp01(progress * N - DONE_AT);

  // Auftauchen eines Bauteils: stufenlos an den Scroll gekoppelt
  const appear = (s: number) => (stage > s ? 1 : stage === s ? easeOut(clamp01(progress * N - s)) : 0);
  const rise = (s: number) =>
    ({
      transform: `translateY(${(1 - appear(s)) * 46}px)`,
      opacity: appear(s),
    }) as const;
  // Fenster eines Stockwerks gehen während seiner Stufe einzeln an
  const lit = (s: number, count: number, index: number) => Math.round(appear(s) * count) > index;

  return (
    <div className={`relative mx-auto ${className}`}>
      {/* Glühen bei Fertigstellung — in Prozent, damit es jede Größe mitgeht. */}
      <div
        data-glow
        className="pointer-events-none absolute left-1/2 top-1/2 h-[74%] w-[107%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-wp-accent/30 blur-3xl transition-opacity duration-700"
        style={{ opacity: done ? 0.55 + 0.45 * subDone : 0 }}
      />

      {/* Behälter der Lottie-Zeichnung. Er steht schon im servergerenderten
          Markup (leer), damit der Browser nichts umbrechen muss, wenn die
          Animation nachträglich hereinkommt. */}
      {lottieRef ? (
        <div
          ref={lottieRef}
          className="absolute inset-0"
          {...(lottieBereit
            ? { role: "img", "aria-label": "Ein Haus baut sich Stockwerk für Stockwerk auf" }
            : { "aria-hidden": true as const })}
        />
      ) : null}

      {/* Die SVG-Fassung ist die Grundlage, nicht der Notnagel: Sie kommt vom
          Server, trägt die `data-`-Attribute für den Vorschau-Treiber
          (`video/chat-vorschau-treiber.js`) und bleibt stehen, wenn Lottie
          nicht lädt. Erst wenn die Animation wirklich steht, weicht sie. */}
      {lottieBereit ? null : (
      <svg
        viewBox="0 0 320 470"
        className="absolute inset-0 h-full w-full"
        {...(dekorativ
          ? { "aria-hidden": true as const }
          : { role: "img", "aria-label": "Ein Haus baut sich Stockwerk für Stockwerk auf" })}
      >
        {/* ── Baukran (hinter dem Haus, verschwindet bei Fertigstellung) ── */}
        <g data-crane style={{ ...rise(0), opacity: done ? 0 : appear(0), transition: "opacity 0.7s" }}>
          <rect x={297} y={104} width={8} height={330} fill={TRIM} />
          <line x1={297} y1={150} x2={305} y2={180} stroke="#f5f1e6" strokeWidth={2} />
          <line x1={305} y1={150} x2={297} y2={180} stroke="#f5f1e6" strokeWidth={2} />
          <line x1={297} y1={230} x2={305} y2={260} stroke="#f5f1e6" strokeWidth={2} />
          <line x1={305} y1={230} x2={297} y2={260} stroke="#f5f1e6" strokeWidth={2} />
          <line x1={297} y1={320} x2={305} y2={350} stroke="#f5f1e6" strokeWidth={2} />
          <line x1={305} y1={320} x2={297} y2={350} stroke="#f5f1e6" strokeWidth={2} />
          {/* Ausleger + Gegengewicht */}
          <rect x={190} y={98} width={128} height={7} fill={TRIM} />
          <rect x={306} y={105} width={12} height={14} fill="var(--color-wp-accent)" stroke={OUTLINE} strokeWidth={2} />
          <line x1={301} y1={98} x2={252} y2={80} stroke={TRIM} strokeWidth={3} />
          <line x1={252} y1={80} x2={196} y2={98} stroke={TRIM} strokeWidth={3} />
          {/* Seil + Haken (pendelt sanft) */}
          <g style={{ animation: "mkFloat 4.5s ease-in-out infinite" }}>
            <line x1={210} y1={105} x2={210} y2={148} stroke={OUTLINE} strokeWidth={2} />
            <path d="M204,148 h12 l-2,10 h-8 z" fill="var(--color-wp-accent)" stroke={OUTLINE} strokeWidth={2} />
          </g>
        </g>

        {/* ── Grundstück: Boden, Büsche, Baum, Fundament (Phase 0) ── */}
        <g data-part="0" style={rise(0)}>
          <ellipse cx={160} cy={448} rx={150} ry={11} fill="rgba(0,54,48,0.10)" />
          <line x1={14} y1={444} x2={306} y2={444} stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" />
          {/* Busch links */}
          <circle cx={40} cy={430} r={15} fill="#3c9a6e" stroke={OUTLINE} strokeWidth={2.5} />
          <circle cx={26} cy={437} r={10} fill="#2e7d5b" stroke={OUTLINE} strokeWidth={2.5} />
          {/* Baum rechts */}
          <rect x={272} y={408} width={8} height={36} fill="#8a5a33" stroke={OUTLINE} strokeWidth={2} />
          <circle cx={276} cy={396} r={19} fill="#3c9a6e" stroke={OUTLINE} strokeWidth={2.5} />
          <circle cx={262} cy={388} r={12} fill="#2e7d5b" stroke={OUTLINE} strokeWidth={2.5} />
          <circle cx={290} cy={386} r={11} fill="#2e7d5b" stroke={OUTLINE} strokeWidth={2.5} />
          {/* Fundament */}
          <rect x={56} y={412} width={208} height={30} rx={4} fill="#e5dcc8" stroke={OUTLINE} strokeWidth={3} />
          <rect x={78} y={422} width={16} height={8} rx={2} fill="#b7ad97" />
          <rect x={226} y={422} width={16} height={8} rx={2} fill="#b7ad97" />
        </g>

        {/* ── Erdgeschoss mit Tür und Hausnummer (Phase 1) ── */}
        <g data-part="1" style={rise(1)}>
          <rect x={60} y={322} width={200} height={94} rx={6} fill={FACADE} stroke={OUTLINE} strokeWidth={3} />
          {/* Tür mit Rundbogen */}
          <path d="M144,414 v-48 a16,16 0 0 1 32,0 v48 z" fill={TRIM} stroke={OUTLINE} strokeWidth={3} />
          <circle cx={170} cy={386} r={2.8} fill="var(--color-wp-accent)" />
          {/* Hausnummer 12 – Gruß an die WEG Musterstraße 12 */}
          <rect x={184} y={352} width={20} height={15} rx={3} fill="#fff" stroke={OUTLINE} strokeWidth={2} />
          <text x={194} y={363.5} textAnchor="middle" fontSize={10} fontWeight={700} fill={OUTLINE}>12</text>
          {/* Trittstein */}
          <ellipse cx={160} cy={419} rx={24} ry={4} fill="#d8cfba" stroke={OUTLINE} strokeWidth={2} />
          <Win x={78} y={344} w={34} h={46} on={lit(1, 2, 0)} floor={1} idx={0} cnt={2} />
          <Win x={208} y={344} w={34} h={46} on={lit(1, 2, 1)} floor={1} idx={1} cnt={2} />
        </g>

        {/* ── 1. Obergeschoss mit Blumenkasten (Phase 2) ── */}
        <g data-part="2" style={rise(2)}>
          <rect x={60} y={234} width={200} height={92} rx={6} fill={FACADE} stroke={OUTLINE} strokeWidth={3} />
          <Win x={78} y={256} on={lit(2, 3, 0)} floor={2} idx={0} cnt={3} />
          <Win x={145} y={256} on={lit(2, 3, 1)} floor={2} idx={1} cnt={3} />
          <Win x={212} y={256} on={lit(2, 3, 2)} floor={2} idx={2} cnt={3} />
          <FlowerBox x={143} y={299} />
        </g>

        {/* ── 2. Obergeschoss (Phase 3) ── */}
        <g data-part="3" style={rise(3)}>
          <rect x={60} y={146} width={200} height={92} rx={6} fill={FACADE} stroke={OUTLINE} strokeWidth={3} />
          <Win x={78} y={168} on={lit(3, 3, 0)} floor={3} idx={0} cnt={3} />
          <Win x={145} y={168} on={lit(3, 3, 1)} floor={3} idx={1} cnt={3} />
          <Win x={212} y={168} on={lit(3, 3, 2)} floor={3} idx={2} cnt={3} />
          <FlowerBox x={76} y={211} />
          <FlowerBox x={210} y={211} />
          {/* Katze im Mittelfenster – erst bei Fertigstellung */}
          <g data-cat style={{ opacity: done ? 1 : 0, transition: "opacity 0.6s" }}>
            <path d="M153,206 l3.5,-7 l3.5,7 z" fill="#143b34" />
            <path d="M162,206 l3.5,-7 l3.5,7 z" fill="#143b34" />
            <circle cx={161} cy={209} r={5.5} fill="#143b34" />
            <path d="M167,208 q6,-2 6,-8" stroke="#143b34" strokeWidth={2.5} fill="none" strokeLinecap="round" />
          </g>
        </g>

        {/* ── Dach, Schornstein, Dachfenster + Bewohner (Phase 4) ── */}
        <g data-part="4" style={rise(4)}>
          {/* Schornstein */}
          <rect x={216} y={74} width={26} height={52} fill="#b34a19" stroke={OUTLINE} strokeWidth={3} />
          <rect x={211} y={66} width={36} height={11} rx={3} fill="#8a3a14" stroke={OUTLINE} strokeWidth={3} />
          {/* Dach */}
          <path d="M44,150 L160,62 L276,150 Z" fill="var(--color-wp-accent)" stroke={OUTLINE} strokeWidth={3.5} strokeLinejoin="round" />
          <rect x={48} y={144} width={224} height={11} rx={4} fill="var(--color-wp-accent-dark)" stroke={OUTLINE} strokeWidth={3} />
          {/* rundes Dachfenster */}
          <g data-atticg style={{ filter: done ? "drop-shadow(0 0 5px rgba(246,144,24,0.85))" : "none" }}>
            <circle cx={160} cy={116} r={14} fill={OUTLINE} />
            <circle data-glass cx={160} cy={116} r={10} fill={done ? GLASS_ON : GLASS_OFF} style={{ transition: "fill 0.4s" }} />
            <line x1={160} y1={107} x2={160} y2={125} stroke={OUTLINE} strokeWidth={2.5} />
            <line x1={151} y1={116} x2={169} y2={116} stroke={OUTLINE} strokeWidth={2.5} />
          </g>
          {/* Zwei Bewohner vor der Tür (die Gemeinschaft zieht ein) */}
          <g data-figs style={{ opacity: stage >= ROOF_AT ? 1 : 0, transition: "opacity 0.5s", animation: stage >= ROOF_AT ? "mkPopIn 0.5s var(--ease-mk-out) both" : "none", animationDelay: "250ms" }}>
            <rect x={104} y={390} width={15} height={24} rx={7} fill={TRIM} stroke={OUTLINE} strokeWidth={2} />
            <circle cx={111.5} cy={383} r={7} fill="#f2c9a0" stroke={OUTLINE} strokeWidth={2} />
            <rect x={124} y={396} width={13} height={18} rx={6} fill="var(--color-wp-accent)" stroke={OUTLINE} strokeWidth={2} />
            <circle cx={130.5} cy={390} r={5.5} fill="#f2c9a0" stroke={OUTLINE} strokeWidth={2} />
          </g>
        </g>

        {/* ── Fertigstellung: Fahne + Rauch ── */}
        <g data-doneextra style={{ opacity: done ? 1 : 0, transition: "opacity 0.6s" }}>
          <line x1={160} y1={62} x2={160} y2={30} stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" />
          <path d="M160,32 L188,40 L160,48 Z" fill="var(--color-wp-accent)" stroke={OUTLINE} strokeWidth={2.5} style={{ transformOrigin: "160px 40px", animation: done ? "mkFlag 2.4s ease-in-out infinite" : "none" }} />
          {[
            { cy: 54, r: 5, d: "0s", dur: "4s" },
            { cy: 42, r: 7, d: "1.2s", dur: "5s" },
            { cy: 28, r: 9, d: "2.4s", dur: "6s" },
          ].map((s, i) => (
                <circle
                  key={i}
                  cx={229}
                  cy={s.cy}
                  r={s.r}
                  fill="rgba(148,163,175,0.55)"
                  style={{ ["--mk-op" as string]: 0.55, animation: `mkRise ${s.dur} linear ${s.d} infinite` }}
                />
              ))}
        </g>
      </svg>
      )}

      {/* Info-Chip am Fundament. In der kleinen Ausgabe entfällt er: Seine
          Breite hängt am Text, nicht an der Zeichnung – neben einer 88 px
          breiten Karte ragte er aus dem Bildschirm heraus. */}
      {dekorativ ? null : (
        <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-600 shadow-e2">
          <Users className="h-3.5 w-3.5 text-wp-accent-ink" />
          Einheiten · Miteigentumsanteile · Konten
        </div>
      )}

      {/* Funkeln bei Fertigstellung */}
      <div data-sparkles className="pointer-events-none absolute inset-0 transition-opacity duration-500" style={{ opacity: done ? 1 : 0 }}>
        {[
            { top: "6%", left: "18%", d: 0 },
            { top: "14%", left: "80%", d: 0.4 },
            { top: "30%", left: "8%", d: 0.8 },
            { top: "4%", left: "58%", d: 1.2 },
            { top: "24%", left: "90%", d: 0.2 },
          ].map((sp, i) => (
            <span
              key={i}
              className="pointer-events-none absolute h-2 w-2 bg-wp-accent"
              style={{
                top: sp.top,
                left: sp.left,
                clipPath: "polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%)",
                animation: `mkSparkle 1.8s ease-out ${sp.d}s infinite`,
              }}
            />
          ))}
      </div>

      {/* „Fertig"-Plakette über dem First */}
      <div
        data-done
        className="absolute -top-2 left-1/2 flex items-center gap-1.5 whitespace-nowrap rounded-full bg-good px-3 py-1 text-xs font-semibold text-white shadow-lg transition-all duration-500"
        style={{
          opacity: done ? 1 : 0,
          transform: `translateX(-50%) translateY(${done ? 0 : 8}px)`,
        }}
      >
        <CheckCircle2 className="h-4 w-4" /> Selbstverwaltung steht
      </div>
    </div>
  );
}

// ── Dasselbe Haus als Lottie ──────────────────────────────────────────────
//
// Die gepinnte Szene am Schreibtisch zeigt das Haus als Lottie-Animation
// (`public/lottie/haus-aufbau.json`, erzeugt von `scripts/build-haus-lottie.mjs`).
// Der Gewinn liegt nicht in der Zeichnung — die ist dieselbe —, sondern in der
// Bewegung: Lottie interpoliert JEDEN Zwischenwert einer durchgehenden
// Zeitachse, statt sechs Gruppen einzeln über Transform und Deckkraft zu
// schieben. Fenster gehen weich an, die Fahne weht, der Rauch steigt.
//
// Drei Dinge sind Absicht:
//  • `autoplay: false`. Das Bild kommt aus dem Scroll-Fortschritt, nicht aus
//    einer Uhr — die Bewegung gehört dem Leser.
//  • Nachgeladen, nicht gebündelt. Player und Zeichnung holt der Browser erst,
//    wenn die Szene gebraucht wird; die Startseite bleibt sonst ohne Ballast.
//  • `lottie_light`. Die schlanke Fassung kennt keine Ausdrücke und damit kein
//    `eval` — die CSP dieser Seite (`next.config.ts`) erlaubt das nicht.
//
// Fällt eines davon aus (kein JS, Datei fehlt, Netz weg), bleibt die
// servergerenderte SVG-Fassung stehen und alles funktioniert wie zuvor.
function HausAufbau({ stage, progress }: { stage: number; progress: number }) {
  const behaelter = useRef<HTMLDivElement>(null);
  const animation = useRef<{ goToAndStop: (w: number, istBild?: boolean) => void; totalFrames: number; destroy: () => void } | null>(null);
  const [bereit, setBereit] = useState(false);

  useEffect(() => {
    // Geladen wird NUR, wo die Animation auch zu sehen ist. Zwei Fälle sonst
    // holten die Datei umsonst:
    //  • Unter `lg` trägt jede Stufenkarte ihr eigenes kleines Haus, die
    //    gepinnte Szene steckt hinter `hidden lg:flex` — sie ist im Dokument,
    //    aber unsichtbar. Auf dem Handy wäre das reines Datenvolumen.
    //  • Bei reduzierter Bewegung wirft `ScrollyBuild` die ganze Szene weg.
    //    Weil es das erst nach dem ersten Bild tut, ist diese Komponente da
    //    schon einmal montiert — die Abfrage hier kommt dem zuvor.
    const gross = window.matchMedia("(min-width: 1024px)"); // Tailwind `lg`
    const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)");
    let abgebrochen = false;
    let angefangen = false;

    const laden = async () => {
      if (angefangen || abgebrochen || !gross.matches || ruhig.matches) return;
      angefangen = true;
      try {
        const [{ default: lottie }, antwort] = await Promise.all([
          import("lottie-web/build/player/lottie_light"),
          fetch("/lottie/haus-aufbau.json"),
        ]);
        if (abgebrochen || !antwort.ok || !behaelter.current) return;
        const daten: unknown = await antwort.json();
        if (abgebrochen || !behaelter.current) return;
        const anim = lottie.loadAnimation({
          container: behaelter.current,
          renderer: "svg",
          loop: false,
          autoplay: false,
          animationData: daten,
          rendererSettings: { preserveAspectRatio: "xMidYMid meet", progressiveLoad: false },
        });
        animation.current = anim;
        // `bereit` schaltet die SVG-Fassung ab UND löst den Effekt darunter
        // aus – der setzt das erste Bild auf den Scroll-Stand von jetzt, nicht
        // auf den vom Beginn des Ladevorgangs.
        anim.addEventListener("DOMLoaded", () => {
          if (!abgebrochen) setBereit(true);
        });
      } catch {
        // Kein Grund einzugreifen: Die SVG-Fassung steht bereits da.
      }
    };

    // Wer das Fenster nachträglich auf Schreibtischbreite zieht, bekommt die
    // Animation dann – ein zweites Mal geladen wird sie nicht (`angefangen`).
    const beiWechsel = () => void laden();
    gross.addEventListener("change", beiWechsel);
    void laden();

    return () => {
      abgebrochen = true;
      gross.removeEventListener("change", beiWechsel);
      animation.current?.destroy();
      animation.current = null;
    };
  }, []);

  useEffect(() => {
    const anim = animation.current;
    if (!anim || !bereit) return;
    anim.goToAndStop(clamp01(progress) * (anim.totalFrames - 1), true);
  }, [progress, bereit]);

  return (
    <Building
      stage={stage}
      progress={progress}
      lottieRef={behaelter}
      lottieBereit={bereit}
    />
  );
}

// ── Die sechs Stufen als EINE Liste ───────────────────────────────────────
//
// Vorher stand jede Stufe zweimal im Dokument: einmal gestapelt für < lg und
// noch einmal als Textpanel der gepinnten Szene. Beide Fassungen lagen immer
// im HTML — sechs Überschriften und sechs Absätze also doppelt. Suchmaschinen
// lesen das als Text-Duplikate und als wiederholte Überschriftentexte.
//
// Jetzt trägt eine Liste beide Auftritte: unter lg Karten untereinander, ab lg
// absolut übereinandergelegt und über den Scroll-Fortschritt eingeblendet. Was
// nur zu einem Auftritt gehört (Ziffer und kleines Haus mobil, Merkmal-Chip und
// Abschluss-CTA am Schreibtisch), blendet CSS aus — nicht ein zweites Markup.
function Stufen({
  stage,
  statisch,
  registrierenHref,
}: {
  stage: number;
  statisch: boolean;
  /** Ziel des Abschluss-CTA – mit Aktionscode, solange die Aktion läuft. */
  registrierenHref: string;
}) {
  const N = STAGES.length;
  const ueberlagert = !statisch;
  return (
    <ol className={ueberlagert ? "space-y-4 lg:relative lg:min-h-[268px] lg:space-y-0" : "space-y-4"}>
      {STAGES.map((s, i) => (
        <li
          key={s.title}
          style={
            ueberlagert
              ? {
                  ["--mk-panel-op" as string]: i === stage ? 1 : 0,
                  ["--mk-panel-pe" as string]: i === stage ? "auto" : "none",
                }
              : undefined
          }
          className={
            "flex flex-wrap items-start gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-e1" +
            (ueberlagert
              ? " lg:absolute lg:inset-0 lg:block lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none" +
                " lg:opacity-[var(--mk-panel-op)] lg:[pointer-events:var(--mk-panel-pe)]" +
                " lg:transition-opacity lg:duration-500 lg:[transition-timing-function:var(--ease-mk-out)]"
              : "")
          }
        >
          {/* Schritt-Ziffer: mobil der Anker in der Liste, am Schreibtisch
              übernimmt das die Fortschrittsleiste. */}
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-wp-accent font-display text-base font-bold text-wp-on-accent lg:hidden">
            {i + 1}
          </span>
          {/* `basis` hält den Text mobil mindestens 12 rem breit – darunter
              umbricht die Zeile lieber, als den Satz in Zwei-Wort-Zeilen zu
              pressen. Genau dann rutscht das Haus in die nächste Reihe. */}
          <div className="min-w-0 flex-1 basis-48 lg:basis-auto">
            <p className="text-xs font-semibold uppercase tracking-wider text-wp-accent-ink lg:text-sm lg:normal-case lg:tracking-normal">
              {s.step}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-gray-900 lg:mt-2 lg:text-4xl lg:font-extrabold lg:leading-tight lg:text-wp-ink">
              {s.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600 lg:mt-4 lg:max-w-md lg:text-base">
              {s.text}
            </p>
            <p className="mt-3 hidden items-center gap-2 rounded-full border border-wp-accent-ink/40 bg-wp-accent-light px-3 py-1.5 text-xs font-semibold text-wp-accent-ink lg:mt-5 lg:inline-flex">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {s.badge}
            </p>
            {i === N - 1 ? (
              <div className="mt-6 hidden lg:block">
                <Link href={registrierenHref} className={`${wpButtonClass} px-6 py-3 text-base`}>
                  Selbstverwaltung einrichten
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : null}
          </div>
          {/* Mobil trägt jede Stufe ihr eigenes Haus in genau dem Bauzustand,
              den sie beschreibt — ohne Pinning wächst es so beim Scrollen durch
              die Karten, ganz ohne Skript. `progress` so gewählt, dass die
              Bauteile dieser Stufe voll dastehen: appear(i) = 1 bei p·N − i ≥ 1. */}
          <Building
            stage={i}
            progress={(i + 1) / N}
            className="mx-auto h-[168px] w-[118px] shrink-0 lg:hidden"
            dekorativ
          />
        </li>
      ))}
    </ol>
  );
}

// `registrierenHref` kommt von der Seite (Server): Während der
// Willkommensaktion trägt der Knopf am Ende der Bau-Szene den Aktionscode mit —
// eine Client-Komponente kann ihn nicht selbst ermitteln (siehe
// `lib/aktion-server.ts`).
export function ScrollyBuild({
  registrierenHref = "/registrieren",
}: {
  registrierenHref?: string;
}) {
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

  // Bei reduzierter Bewegung: statische, gestapelte Liste auf jeder Breite.
  if (reduced) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-bold text-wp-ink sm:text-3xl">
          So bauen Sie Ihre Selbstverwaltung auf
        </h2>
        <div className="mt-8">
          <Stufen stage={0} statisch registrierenHref={registrierenHref} />
        </div>
      </section>
    );
  }

  const isLast = stage === STAGES.length - 1;

  return (
    // Höhe der Scroll-Strecke: 120vh je Stufe (STAGES.length = 6 → 720vh) —
    // ruhiges Tempo, jede Stufe bekommt genug Verweildauer. Unter lg gibt es
    // kein Pinning: Auf iOS kollidierte es mit dem Momentum-Scrolling („die
    // Seite hängt"), und ohne festen Halt kann die Szene nicht stehen bleiben,
    // während der Text daran vorbeizieht.
    <section
      ref={trackRef}
      className="relative mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:h-[720vh] lg:max-w-none lg:px-0 lg:py-0"
    >
      <div className="relative mt-0 lg:sticky lg:top-0 lg:flex lg:h-svh lg:items-center lg:overflow-hidden lg:pb-4 lg:pt-16">
        {/* Ambiente und Rahmenlinien gehören zur gepinnten Szene. */}
        <div className="pointer-events-none absolute inset-0 hidden lg:block">
          <SceneAmbience progress={progress} />
        </div>
        <div className="absolute inset-x-0 top-0 hidden h-px bg-gray-200/80 lg:block" />
        <div className="absolute inset-x-0 bottom-0 hidden h-px bg-gray-200/80 lg:block" />

        <div className="relative mx-auto w-full items-center gap-8 lg:grid lg:max-w-6xl lg:grid-cols-2 lg:px-6">
          {/* Linke Spalte: Überschrift, Fortschritt und die sechs Stufen */}
          <div className="relative">
            <h2 className="text-2xl font-bold text-wp-ink sm:text-3xl lg:text-xs lg:font-semibold lg:uppercase lg:tracking-[0.2em] lg:text-wp-accent-ink">
              So bauen Sie Ihre Selbstverwaltung auf
            </h2>

            {/* Schritt-Ziffer + kontinuierlich mitlaufende Fortschrittsleiste */}
            <div className="mt-4 hidden items-center gap-4 lg:flex">
              <span className="font-display text-2xl font-extrabold tabular-nums leading-none text-wp-ink">
                <span data-stepnum>{String(stage + 1).padStart(2, "0")}</span>
                <span className="ml-1 align-middle text-sm font-semibold text-gray-400">/ 06</span>
              </span>
              <div className="flex flex-1 gap-1.5">
                {STAGES.map((s, i) => {
                  // Füllt sich stufenlos mit dem Scroll-Fortschritt statt zu springen
                  const fill = clamp01(progress * STAGES.length - i);
                  return (
                    <div key={s.title} className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                      <div
                        data-seg
                        className="h-full rounded-full bg-wp-accent"
                        style={{ width: `${fill * 100}%` }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 lg:mt-6">
              <Stufen stage={stage} statisch={false} registrierenHref={registrierenHref} />
            </div>

            {/* Scroll-Hinweis (verblasst nach Beginn) */}
            <p
              data-hint
              className="mt-2 hidden text-xs text-gray-500 transition-opacity duration-500 lg:block"
              style={{ opacity: isLast ? 0 : 0.9 }}
            >
              ↓ Scrollen, um Ihre WEG aufzubauen
            </p>
          </div>

          {/* Rechte Spalte: das sich aufbauende Gebäude. Mobil trägt jede Karte
              ihr eigenes kleines Haus, hier steht das große in der Szene. */}
          <div
            data-buildingwrap
            className="hidden items-center justify-center lg:flex"
            style={{ transform: `translateY(${(0.5 - progress) * 24}px)` }}
          >
            <HausAufbau stage={stage} progress={progress} />
          </div>
        </div>
      </div>
    </section>
  );
}
