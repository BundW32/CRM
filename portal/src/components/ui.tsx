import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, Info, XCircle } from "lucide-react";
import type { TicketStatus } from "@/generated/prisma/client";
import { ticketStatusLabels, ticketStatusStyles } from "@/lib/labels";

// Gemeinsamer, gut sichtbarer Fokus-Ring (Tastaturbedienung) – markenfarben.
const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange";

// Basis aller Buttons: dezenter Press (0.98 statt 0.95), cursor-pointer (Tailwind v4
// setzt Buttons sonst auf default), einheitliche Radien und Fokus-Ringe.
const buttonBase =
  `inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none ${focusRing}`;

export const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition duration-150 focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/30";

// Primäraktion: Orange mit dunkler Schrift – wie die CTAs auf der Website (gut lesbar)
export const buttonClass =
  `${buttonBase} bg-brand-orange font-semibold text-brand-green-dark shadow-e1 hover:bg-brand-orange-dark hover:shadow-e2 active:shadow-none`;

// Alias – bleibt aus Kompatibilitätsgründen erhalten
export const buttonOrangeClass = buttonClass;

// Sekundär (auf hellen Flächen)
export const buttonSecondaryClass =
  `${buttonBase} border border-gray-300 bg-white font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 active:shadow-none`;

// Outline-Variante für dunkle Flächen (oranger Rand, wie „Potenzial Analyse")
export const buttonOutlineClass =
  `${buttonBase} border border-brand-orange/60 bg-transparent font-semibold text-brand-orange hover:bg-brand-orange/10 active:shadow-none`;

// Destruktiv (Löschen, Ablehnen, …) – roter Rahmen auf hellem Grund, klar von der
// Primäraktion getrennt. Ersetzt die zuvor mehrfach kopierten Inline-Rot-Buttons.
export const buttonDangerClass =
  `${buttonBase} border border-red-200 bg-white font-medium text-red-600 hover:border-red-300 hover:bg-red-50 active:shadow-none`;

// Ghost – flächenlos, wird erst bei Hover sichtbar. Für tertiäre/kompakte Aktionen
// in Listenzeilen und Toolbars (statt roher Textlinks).
export const buttonGhostClass =
  `${buttonBase} bg-transparent font-medium text-gray-600 hover:bg-gray-100 hover:text-brand-green active:shadow-none`;

// Icon-Button (quadratisch, flächenlos) – für Aktions-Icons in dichten Listen.
// Als Klassen-String, damit er auf <button> UND <a>/<Link> passt. Wird mit einem
// Lucide-Icon befüllt; bei Icon-only immer aria-label/title setzen.
const iconButtonBase =
  `inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-all active:scale-[0.94] disabled:opacity-50 disabled:pointer-events-none ${focusRing}`;
export const iconButtonClass =
  `${iconButtonBase} text-gray-500 hover:bg-gray-100 hover:text-brand-green`;
export const iconButtonDangerClass =
  `${iconButtonBase} text-gray-400 hover:bg-red-50 hover:text-red-600`;

// Einheitlicher Zurück-Link – ersetzt die ~50 rohen „← Text"-Textlinks. Chevron
// aus derselben Icon-Familie, dezent, mit sichtbarem Fokus-Ring. Auf dunklem
// Shell (Standard) hell, per `tone="onLight"` für helle Flächen (z. B. Plattform).
export function BackLink({
  href,
  children,
  tone = "onDark",
}: {
  href: ComponentProps<typeof Link>["href"];
  children: ReactNode;
  tone?: "onDark" | "onLight";
}) {
  const color =
    tone === "onDark"
      ? "text-gray-300 hover:text-brand-orange"
      : "text-gray-500 hover:text-brand-green";
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-lg py-1 text-sm font-medium transition ${color} ${focusRing}`}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" />
      {children}
    </Link>
  );
}

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
        {children}
      </h1>
      {action}
    </div>
  );
}

export function Card({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      {title ? (
        <h2 className="mb-4 text-base font-semibold text-gray-900">{title}</h2>
      ) : null}
      {children}
    </div>
  );
}

// Dunkle Karte – für Akzent-/Hero-Bereiche auf hellem Grund (Website-Wechselspiel)
export function DarkCard({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-shell-2 p-5 shadow-lg">
      {title ? (
        <h2 className="mb-4 text-base font-semibold text-white">{title}</h2>
      ) : null}
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${ticketStatusStyles[status]}`}
    >
      {status === "NEU" && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {ticketStatusLabels[status]}
    </span>
  );
}

export function EmptyState({
  children,
  icon,
  action,
}: {
  children: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center">
      {icon ? (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-400 shadow-e1">
          {icon}
        </span>
      ) : null}
      <p className="text-sm text-gray-500">{children}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

// Semantische Hinweisleiste – ersetzt die zuvor mehrfach duplizierten
// amber/green/red-Banner. Optionaler Titel, Icon (Standard je Variante) und
// eine Aktion (z. B. Button) rechts.
type AlertVariant = "info" | "success" | "warning" | "error";

const alertStyles: Record<AlertVariant, { box: string; icon: string; node: ReactNode }> = {
  info: {
    box: "border-brand-orange/30 bg-brand-orange-light text-brand-green",
    icon: "text-brand-orange-dark",
    node: <Info className="h-5 w-5" />,
  },
  success: {
    box: "border-green-200 bg-green-50 text-green-900",
    icon: "text-green-600",
    node: <CheckCircle2 className="h-5 w-5" />,
  },
  warning: {
    box: "border-amber-300 bg-amber-50 text-amber-900",
    icon: "text-amber-600",
    node: <AlertTriangle className="h-5 w-5" />,
  },
  error: {
    box: "border-red-200 bg-red-50 text-red-800",
    icon: "text-red-600",
    node: <XCircle className="h-5 w-5" />,
  },
};

export function Alert({
  variant = "info",
  title,
  children,
  action,
  className = "",
}: {
  variant?: AlertVariant;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  /** Zusätzliche Klassen, z. B. Außenabstände (mb-4). */
  className?: string;
}) {
  const s = alertStyles[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm ${s.box} ${className}`}
    >
      <span className={`shrink-0 ${s.icon}`}>{s.node}</span>
      <div className="min-w-0 flex-1">
        {title ? <span className="font-semibold">{title} </span> : null}
        {children}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
