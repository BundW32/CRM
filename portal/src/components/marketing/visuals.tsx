// Bewegte Illustrationen der Marketing-Seiten: animierte UI-Mockups in reinem
// CSS (Keyframes aus globals.css). Einblend-Sequenzen tragen `mk-anim` und
// laufen erst an, wenn der umgebende Reveal-Abschnitt sichtbar wird; ruhige
// Endlos-Animationen (Schweben, Kreisen, Pendeln) laufen frei.
import {
  Building2,
  CalendarCheck,
  CheckCircle2,
  FileCheck,
  HandCoins,
  Home,
  Image as ImageIcon,
  PiggyBank,
  Landmark,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";

// Gemeinsame Karten-Optik der Mockups
function MockCard({ title, chip, children }: { title: string; chip?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-e2 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        {chip ? (
          <span className="rounded-full bg-wp-accent-light px-2 py-0.5 text-[11px] font-semibold text-wp-accent-ink">
            {chip}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function seq(i: number, step = 160, base = 200) {
  return { animationDelay: `${base + i * step}ms` } as const;
}

/* ── Startseite: Haus mit kreisenden Aufgaben-Icons ── */
export function OrbitVisual() {
  const orbiting = [
    { icon: HandCoins, pos: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2" },
    { icon: FileCheck, pos: "bottom-[14%] left-0 -translate-x-1/2" },
    { icon: Users, pos: "bottom-[14%] right-0 translate-x-1/2" },
  ];
  return (
    <div className="relative mx-auto flex h-72 w-72 items-center justify-center sm:h-80 sm:w-80">
      <div className="absolute inset-6 rounded-full border border-dashed border-wp-primary/25" />
      {/* Zentrum: die WEG */}
      <div style={{ animation: "mkFloat 6s ease-in-out infinite" }}>
        <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-e3">
          <Building2 className="h-12 w-12 text-wp-primary" />
        </div>
      </div>
      {/* Kreisende Aufgaben – innerer Ring dreht, Icons drehen gegenläufig */}
      <div className="absolute inset-6" style={{ animation: "mkOrbit 28s linear infinite" }}>
        {orbiting.map(({ icon: Icon, pos }) => (
          <div key={pos} className={`absolute ${pos}`}>
            <div style={{ animation: "mkOrbitCounter 28s linear infinite" }}>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-wp-accent shadow-lg shadow-black/20">
                <Icon className="h-6 w-6 text-wp-ink" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Finanzen: Wirtschaftsplan als wachsendes Balkendiagramm ── */
export function PlanChartVisual() {
  const bars = [46, 72, 58, 90, 66, 80];
  return (
    <MockCard title="Wirtschaftsplan 2027" chip="Entwurf → Beschluss">
      <div className="flex h-28 items-end gap-2.5">
        {bars.map((h, i) => (
          <div
            key={i}
            className="mk-anim flex-1 origin-bottom rounded-t-md bg-wp-primary"
            style={{ height: `${h}%`, animation: "mkGrowY 0.7s cubic-bezier(0.16,1,0.3,1) both", ...seq(i, 110) }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex gap-2.5 text-[10px] text-gray-400">
        {["Vers.", "Heizung", "Wasser", "Erhaltung", "Pflege", "Rückl."].map((l) => (
          <span key={l} className="flex-1 text-center">{l}</span>
        ))}
      </div>
      <div
        className="mk-anim mt-3 inline-flex items-center gap-1.5 rounded-lg bg-good-light px-2.5 py-1.5 text-xs font-medium text-good"
        style={{ animation: "mkPopIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both", animationDelay: "1100ms" }}
      >
        <CalendarCheck className="h-3.5 w-3.5" />
        Beschlossen – 12 Sollstellungen je Einheit angelegt
      </div>
    </MockCard>
  );
}

/* ── Finanzen: Einzelwirtschaftsplan – Hausgeld je Einheit ── */
export function UnitPlanVisual() {
  const units = [
    { unit: "WE 1 · EG links", mea: "MEA 210", amount: "276,50 €" },
    { unit: "WE 2 · EG rechts", mea: "MEA 186", amount: "245,00 €" },
    { unit: "WE 3 · 1. OG links", mea: "MEA 172", amount: "226,55 €" },
    { unit: "WE 4 · 1. OG rechts", mea: "MEA 162", amount: "213,40 €" },
  ];
  return (
    <MockCard title="Einzelwirtschaftspläne 2027" chip="je Einheit">
      <div className="space-y-2">
        {units.map((row, i) => (
          <div
            key={row.unit}
            className="mk-anim flex items-center gap-2 rounded-lg border border-gray-100 px-2.5 py-2 text-xs"
            style={{ animation: "mkRowIn 0.5s ease-out both", ...seq(i, 170) }}
          >
            <span className="min-w-0 flex-1 truncate font-medium text-gray-700">{row.unit}</span>
            <span className="text-gray-400">{row.mea}</span>
            <span className="font-semibold text-gray-900">{row.amount}</span>
            <span className="text-[10px] text-gray-400">/ Monat</span>
          </div>
        ))}
      </div>
      <p
        className="mk-anim mt-3 text-xs text-gray-500"
        style={{ animation: "mkRowIn 0.5s ease-out both", animationDelay: "950ms" }}
      >
        Verteilt nach Umlageschlüssel · MEA-Summe geprüft (1000/1000)
      </p>
    </MockCard>
  );
}

/* ── Finanzen: CSV-Bankimport mit Zuordnung & Duplikaterkennung ── */
export function BankImportVisual() {
  const rows = [
    { date: "01.07.", text: "HAUSGELD WE 2 MUELLER", amount: "+245,00", badge: "Einheit 2", tone: "good" },
    { date: "01.07.", text: "HAUSGELD KELLER WE 5", amount: "+198,50", badge: "Einheit 5", tone: "good" },
    { date: "02.07.", text: "STADTWERKE ABSCHLAG", amount: "−413,00", badge: "Heizung", tone: "neutral" },
    { date: "01.07.", text: "HAUSGELD WE 2 MUELLER", amount: "+245,00", badge: "Duplikat", tone: "warn" },
  ] as const;
  const badgeTone = {
    good: "bg-good-light text-good",
    warn: "bg-warn-light text-warn",
    neutral: "bg-gray-100 text-gray-600",
  };
  return (
    <MockCard title="kontoumsaetze_juli.csv" chip="Bankimport">
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div
            key={i}
            className="mk-anim flex items-center gap-2 rounded-lg border border-gray-100 px-2.5 py-2 text-xs"
            style={{ animation: "mkRowIn 0.5s ease-out both", ...seq(i, 200) }}
          >
            <span className="text-gray-400">{row.date}</span>
            <span className="min-w-0 flex-1 truncate font-medium text-gray-700">{row.text}</span>
            <span className={row.amount.startsWith("+") ? "font-semibold text-good" : "font-semibold text-gray-800"}>
              {row.amount}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeTone[row.tone]}`}>
              {row.badge}
            </span>
          </div>
        ))}
      </div>
      <p
        className="mk-anim mt-3 text-xs text-gray-500"
        style={{ animation: "mkRowIn 0.5s ease-out both", animationDelay: "1100ms" }}
      >
        3 Buchungen übernommen · 1 Duplikat automatisch übersprungen
      </p>
    </MockCard>
  );
}

/* ── Finanzen: getrennte Konten mit pendelnder Umbuchung ── */
export function ReserveVisual() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-e2 sm:p-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
            <Landmark className="h-3.5 w-3.5" /> Girokonto
          </p>
          <p className="mt-1.5 text-lg font-bold text-gray-900">12.480,50&nbsp;€</p>
          <p className="text-[11px] text-gray-400">laufende Kosten</p>
        </div>
        <div className="rounded-lg border-2 border-wp-primary/30 bg-wp-primary/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-wp-primary">
            <PiggyBank className="h-3.5 w-3.5" /> Erhaltungsrücklage
          </p>
          <p className="mt-1.5 text-lg font-bold text-wp-primary">28.900,00&nbsp;€</p>
          <p className="text-[11px] text-gray-400">strikt getrennt</p>
        </div>
      </div>
      {/* Pendelnder Umbuchungs-Punkt zwischen den Konten */}
      <div className="relative mx-auto mt-4 h-5 w-48">
        <div className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-gray-200" />
        <div
          className="absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-wp-accent shadow"
          style={{ animation: "mkShuttle 3.2s ease-in-out infinite", ["--mk-shuttle-x" as string]: "10.8rem" }}
        />
      </div>
      <p className="mt-1 text-center text-xs text-gray-500">
        Monatliche Zuführung: 500,00&nbsp;€ – jede Umbuchung dokumentiert
      </p>
    </div>
  );
}

/* ── Finanzen: Jahresabrechnung mit Prüfschritten und Festschreibung ── */
export function StatementVisual() {
  const checks = [
    "Kontenprüfung: Endbestand stimmt mit Kontoauszug überein",
    "Einzelabrechnungen für 6 Einheiten nach Umlageschlüsseln",
    "§ 35a-Ausweis (haushaltsnahe Leistungen) je Einheit",
    "Vermögensbericht nach § 28 Abs. 4 WEG",
  ];
  return (
    <MockCard title="Jahresabrechnung 2026" chip="6 Einheiten">
      <ul className="space-y-2.5">
        {checks.map((check, i) => (
          <li
            key={check}
            className="mk-anim flex items-start gap-2 text-xs text-gray-700"
            style={{ animation: "mkRowIn 0.5s ease-out both", ...seq(i, 220) }}
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" />
            {check}
          </li>
        ))}
      </ul>
      <div
        className="mk-anim mt-4 inline-block -rotate-3 rounded-md border-2 border-good px-3 py-1 text-xs font-bold uppercase tracking-widest text-good"
        style={{ animation: "mkPopIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both", animationDelay: "1300ms" }}
      >
        Festgeschrieben
      </div>
    </MockCard>
  );
}

/* ── Hausgeld: Rückstandsliste mit erkanntem Zahlungseingang ── */
export function ArrearsVisual() {
  const rows = [
    { unit: "WE 1 · Albers", soll: "3.320,00", ist: "3.320,00", saldo: "0,00", tone: "good" },
    { unit: "WE 2 · Müller", soll: "1.470,00", ist: "1.225,00", saldo: "−245,00", tone: "critical" },
    { unit: "WE 3 · Yilmaz", soll: "1.890,00", ist: "1.890,00", saldo: "0,00", tone: "good" },
    { unit: "WE 4 · Krohn", soll: "2.140,00", ist: "1.712,00", saldo: "−428,00", tone: "critical" },
  ] as const;
  return (
    <MockCard title="Offene Posten · Stand Juli" chip="Soll / Ist / Saldo">
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div
            key={row.unit}
            className="mk-anim flex items-center gap-2 rounded-lg border border-gray-100 px-2.5 py-2 text-xs"
            style={{ animation: "mkRowIn 0.5s ease-out both", ...seq(i, 170) }}
          >
            <span className="min-w-0 flex-1 truncate font-medium text-gray-700">{row.unit}</span>
            <span className="hidden text-gray-400 sm:inline">{row.soll}</span>
            <span className="hidden text-gray-400 sm:inline">{row.ist}</span>
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                row.tone === "good" ? "bg-good-light text-good" : "bg-critical-light text-critical"
              }`}
            >
              {row.saldo}
            </span>
          </div>
        ))}
      </div>
      <div
        className="mk-anim mt-3 flex items-center gap-2 rounded-lg bg-wp-accent-light px-2.5 py-2 text-xs font-medium text-wp-accent-ink"
        style={{ animation: "mkPopIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both", animationDelay: "1000ms" }}
      >
        <HandCoins className="h-4 w-4 shrink-0" />
        Zahlungseingang „+245,00 · HAUSGELD WE 2“ → Vorschlag: Einheit 2
      </div>
    </MockCard>
  );
}

/* ── Hausgeld: Mahnbrief fährt aus dem Umschlag ── */
export function DunningVisual() {
  return (
    <div className="mx-auto flex h-72 max-w-xs items-end justify-center pb-2">
      <div className="relative w-56">
        {/* Brief – schiebt sich aus der Umschlagtasche */}
        <div
          className="relative z-0 mx-auto w-44 rounded-t-md bg-white p-3 shadow-e2"
          style={{ animation: "mkLetterOut 4.5s ease-in-out infinite alternate" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-critical">1. Mahnung</p>
          <div className="mt-2 space-y-1">
            <div className="h-1.5 w-24 rounded bg-gray-200" />
            <div className="h-1.5 w-20 rounded bg-gray-200" />
          </div>
          <div className="mt-3 space-y-1">
            <div className="h-1.5 w-full rounded bg-gray-100" />
            <div className="h-1.5 w-full rounded bg-gray-100" />
            <div className="h-1.5 w-3/4 rounded bg-gray-100" />
          </div>
          <p className="mt-3 rounded bg-gray-50 px-1.5 py-1 text-[10px] font-medium text-gray-600">
            Rückstand: 245,00 € · zahlbar binnen 14 Tagen
          </p>
          <div className="mt-2 h-1.5 w-16 rounded bg-gray-200" />
        </div>
        {/* Umschlagtasche mit Sichtfenster (DIN lang) */}
        <div className="relative z-10 -mt-10 h-24 rounded-lg bg-wp-primary shadow-e2">
          <div className="absolute left-4 top-5 h-8 w-24 rounded-sm bg-white/15" />
          <p className="absolute bottom-2.5 left-4 text-[10px] text-white/60">
            Fensterumschlag DIN lang
          </p>
          <ShieldCheck className="absolute right-3 top-3 h-5 w-5 text-wp-accent-bright" />
        </div>
      </div>
    </div>
  );
}

/* ── Versammlung: Abstimmung nach Miteigentumsanteilen ── */
export function VoteVisual() {
  const votes = [
    { label: "Ja", mea: "618 / 1000 MEA", width: "62%", tone: "bg-good" },
    { label: "Nein", mea: "214 / 1000 MEA", width: "21%", tone: "bg-critical" },
    { label: "Enthaltung", mea: "168 / 1000 MEA", width: "17%", tone: "bg-gray-300" },
  ];
  return (
    <MockCard title="TOP 3 · Dachsanierung beauftragen" chip="Abstimmung nach MEA">
      <div className="space-y-3">
        {votes.map((vote, i) => (
          <div key={vote.label}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-medium text-gray-700">{vote.label}</span>
              <span className="text-gray-400">{vote.mea}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`mk-anim h-full origin-left rounded-full ${vote.tone}`}
                style={{ width: vote.width, animation: "mkGrowX 0.8s cubic-bezier(0.16,1,0.3,1) both", ...seq(i, 250) }}
              />
            </div>
          </div>
        ))}
      </div>
      <div
        className="mk-anim mt-4 inline-flex items-center gap-1.5 rounded-lg bg-good-light px-2.5 py-1.5 text-xs font-medium text-good"
        style={{ animation: "mkPopIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both", animationDelay: "1200ms" }}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Angenommen – automatisch in die Beschluss-Sammlung übernommen
      </div>
    </MockCard>
  );
}

/* ── Versammlung: Anwesenheit & Beschlussfähigkeit ── */
export function MeetingVisual() {
  const attendees = ["JA", "SM", "AY", "TK", "LB", "RW"];
  return (
    <MockCard title="Eigentümerversammlung · 12.03." chip="Anwesenheit">
      <div className="flex flex-wrap gap-2.5">
        {attendees.map((initials, i) => (
          <div
            key={initials}
            className="mk-anim relative"
            style={{ animation: "mkPopIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both", ...seq(i, 140) }}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-wp-primary text-xs font-bold text-white">
              {initials}
            </span>
            {i < 5 ? (
              <CheckCircle2 className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-white text-good" />
            ) : null}
          </div>
        ))}
      </div>
      <div
        className="mk-anim mt-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700"
        style={{ animation: "mkRowIn 0.5s ease-out both", animationDelay: "1100ms" }}
      >
        Anwesend: <span className="font-semibold">612 von 1000 MEA</span> – die
        Versammlung ist beschlussfähig
      </div>
    </MockCard>
  );
}

/* ── Kommunikation: Schadenmeldung mit Fotos und Status-Wechsel ── */
export function TicketVisual() {
  const statusChips = [
    { label: "Offen", tone: "bg-warn-light text-warn", delay: "0s" },
    { label: "In Bearbeitung", tone: "bg-wp-accent-light text-wp-accent-ink", delay: "2s" },
    { label: "Erledigt", tone: "bg-good-light text-good", delay: "4s" },
  ];
  return (
    <MockCard title="Schaden · Wasserfleck im Treppenhaus" chip="WE 3">
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="mk-anim flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-gray-200 to-gray-300"
            style={{ animation: "mkPopIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both", ...seq(i, 150) }}
          >
            <ImageIcon className="h-5 w-5 text-gray-400" />
          </div>
        ))}
        {/* Status wechselt in Endlosschleife: Offen → In Bearbeitung → Erledigt */}
        <div className="relative ml-auto h-6 w-28">
          {statusChips.map((chip) => (
            <span
              key={chip.label}
              className={`absolute inset-y-0 right-0 inline-flex items-center rounded-full px-2.5 text-[11px] font-semibold ${chip.tone}`}
              style={{ animation: "mkCycle3 6s infinite", animationDelay: chip.delay, opacity: 0 }}
            >
              {chip.label}
            </span>
          ))}
        </div>
      </div>
      <div
        className="mk-anim mt-3 rounded-lg border border-gray-100 px-2.5 py-2 text-xs text-gray-600"
        style={{ animation: "mkRowIn 0.5s ease-out both", animationDelay: "800ms" }}
      >
        <span className="font-semibold text-gray-800">Handwerker Timm:</span>{" "}
        „Termin bestätigt – Dienstag 9:00 Uhr, Ausführung wird mit Fotos dokumentiert.“
      </div>
    </MockCard>
  );
}

/* ── Kommunikation: Rollen mit eigenem Zugang ── */
export function RolesVisual() {
  const roles = [
    { icon: Users, name: "Eigentümer", text: "Abrechnungen, Beschlüsse, Statistiken" },
    { icon: ShieldCheck, name: "Beirat", text: "prüft Abrechnung & Belege" },
    { icon: Home, name: "Mieter", text: "meldet Schäden, liest Aushänge" },
    { icon: Wrench, name: "Handwerker", text: "sieht nur eigene Aufträge" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {roles.map(({ icon: Icon, name, text }, i) => (
        <div
          key={name}
          className="mk-anim rounded-xl border border-gray-200 bg-white p-4 shadow-e2"
          style={{ animation: "mkPopIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both", ...seq(i, 150) }}
        >
          <Icon className="h-6 w-6 text-wp-accent-ink" />
          <p className="mt-2 text-sm font-semibold text-gray-800">{name}</p>
          <p className="mt-0.5 text-xs text-gray-500">{text}</p>
        </div>
      ))}
    </div>
  );
}

/* ── So funktioniert’s: Einrichtungs-Fortschritt ── */
export function OnboardingVisual() {
  const steps = [
    { label: "Konto als selbstverwaltende WEG angelegt", done: true },
    { label: "6 Einheiten mit MEA erfasst (Summe 1000/1000 ✓)", done: true },
    { label: "Konten & Anfangsbestände eingetragen", done: true },
    { label: "Wirtschaftsplan 2027 beschlossen", done: false },
    { label: "Eigentümer eingeladen", done: false },
  ];
  return (
    <MockCard title="Einrichtung Ihrer WEG" chip="3 von 5 Schritten">
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="mk-anim h-full w-[60%] origin-left rounded-full bg-wp-accent"
          style={{ animation: "mkGrowX 1s cubic-bezier(0.16,1,0.3,1) both", animationDelay: "300ms" }}
        />
      </div>
      <ul className="space-y-2.5">
        {steps.map((step, i) => (
          <li
            key={step.label}
            className="mk-anim flex items-start gap-2 text-xs"
            style={{ animation: "mkRowIn 0.5s ease-out both", ...seq(i, 180) }}
          >
            {step.done ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" />
            ) : (
              <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-gray-300" />
            )}
            <span className={step.done ? "text-gray-700" : "text-gray-400"}>{step.label}</span>
          </li>
        ))}
      </ul>
    </MockCard>
  );
}
