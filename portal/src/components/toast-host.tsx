"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { FLASH_PARAM, resolveFlash, type FlashTone } from "@/lib/flash";
import { Badge } from "@/components/data-display";

// Zeigt die Rückmeldung einer Server-Action als kurz eingeblendete Karte oben
// rechts. Hängt einmal in der Portal-Shell und gilt damit für jede Seite: Eine
// Aktion muss nur `?flash=<code>` an ihren Rücksprung hängen (siehe `lib/flash.ts`).
//
// Der Parameter wird sofort nach dem Einblenden aus der URL geräumt – sonst
// erschiene dieselbe Meldung bei jedem Neuladen und beim Zurück-Button erneut.
// `router.replace` statt `push`, damit die Bereinigung keinen History-Eintrag
// erzeugt, und `scroll: false`, damit die Seite nicht nach oben springt.

const SICHTDAUER_MS = 5000;

// Höchstens drei gleichzeitig. Darüber stapeln sich Karten in den Bildschirm
// hinein und man liest ohnehin nur die obersten. Gleiche Meldungen werden
// vorher zusammengefasst (siehe unten), diese Grenze greift also erst, wenn
// wirklich VERSCHIEDENE Dinge kurz hintereinander passieren.
const MAX_SICHTBAR = 3;

type Toast = {
  id: number;
  text: string;
  tone: FlashTone;
  /** Wie oft dieselbe Meldung zusammengefasst wurde (1 = einmalig). */
  anzahl: number;
};

// Markenfarben statt der üblichen Ampel: Erfolg trägt das Orange, das im
// Portal ohnehin jede Primäraktion markiert – ein grüner Toast stünde allein
// auf weiter Flur. Für die Schrift dient `brand-orange-ink`, weil das helle
// Orange auf Weiß zu schwach läge; der Balken darf das volle Orange zeigen.
// Fehler bleiben rot: Das ist keine Markenfrage, sondern eine Warnung.
const toneStyles: Record<FlashTone, { box: string; icon: string; bar: string; node: React.ReactNode }> = {
  success: {
    box: "border-brand-orange/30 bg-white",
    icon: "text-brand-orange-ink",
    bar: "bg-brand-orange",
    node: <CheckCircle2 className="h-5 w-5" />,
  },
  error: {
    box: "border-red-200 bg-white",
    icon: "text-red-600",
    bar: "bg-red-500",
    node: <XCircle className="h-5 w-5" />,
  },
  info: {
    box: "border-gray-200 bg-white",
    icon: "text-gray-500",
    bar: "bg-gray-400",
    node: <Info className="h-5 w-5" />,
  },
};

/**
 * Reiht eine neue Meldung in die sichtbaren Karten ein.
 *
 * Zwei Regeln, beide aus der Praxis:
 *
 * **Gleiches zusammenfassen.** Wer auf einer dichten Seite fünf Blöcke
 * nacheinander speichert, will nicht fünf Mal „Gespeichert." lesen – ein Zähler
 * sagt dasselbe in einer Zeile. Die Karte bekommt dabei eine neue `id`, damit
 * React sie neu aufbaut und Ablaufbalken wie Zeitgeber von vorn beginnen; sonst
 * verschwände sie mitten in der Serie.
 *
 * **Bei Überlauf weicht der ÄLTESTE.** Die neueste Meldung gehört zu der
 * Aktion, die gerade ausgelöst wurde. Die neue zu verwerfen hieße, ausgerechnet
 * die Rückmeldung zu verschlucken, auf die man wartet.
 *
 * Als reine Funktion herausgezogen, weil sich Verhalten prüfen lässt, das nicht
 * in einem Effekt eingeschlossen ist.
 */
export function naechsteToasts(
  vorher: Toast[],
  meldung: { text: string; tone: FlashTone },
  neueId: number,
): Toast[] {
  const letzter = vorher[vorher.length - 1];
  if (letzter && letzter.text === meldung.text && letzter.tone === meldung.tone) {
    return [...vorher.slice(0, -1), { ...letzter, anzahl: letzter.anzahl + 1, id: neueId }];
  }
  return [...vorher, { id: neueId, text: meldung.text, tone: meldung.tone, anzahl: 1 }].slice(
    -MAX_SICHTBAR,
  );
}

export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nextId = useRef(0);
  // Verhindert, dass derselbe Parameter zweimal ausgelöst wird, während das
  // `router.replace` noch läuft (React rendert zwischenzeitlich neu).
  const verarbeitet = useRef<string | null>(null);

  const entfernen = useCallback((id: number) => {
    setToasts((vorher) => vorher.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const code = searchParams.get(FLASH_PARAM);
    if (!code) {
      verarbeitet.current = null;
      return;
    }
    const schluessel = `${pathname}?${searchParams.toString()}`;
    if (verarbeitet.current === schluessel) return;
    verarbeitet.current = schluessel;

    const meldung = resolveFlash(code);

    // Parameter in jedem Fall entfernen – auch bei unbekanntem Code, damit
    // kein Rest in der Adresszeile stehen bleibt.
    const rest = new URLSearchParams(searchParams.toString());
    rest.delete(FLASH_PARAM);
    const qs = rest.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });

    if (!meldung) return;
    setToasts((vorher) => naechsteToasts(vorher, meldung, nextId.current++));
  }, [pathname, router, searchParams]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <ToastKarte key={t.id} toast={t} onClose={() => entfernen(t.id)} />
      ))}
    </div>
  );
}

function ToastKarte({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const s = toneStyles[toast.tone];
  // Beim Überfahren mit der Maus pausiert der Ablauf – wer gerade liest, soll
  // die Meldung nicht unter dem Cursor verlieren.
  const [pausiert, setPausiert] = useState(false);

  useEffect(() => {
    if (pausiert) return;
    const timer = setTimeout(onClose, SICHTDAUER_MS);
    return () => clearTimeout(timer);
  }, [pausiert, onClose]);

  return (
    <div
      role="status"
      onMouseEnter={() => setPausiert(true)}
      onMouseLeave={() => setPausiert(false)}
      className={`toast-einblenden pointer-events-auto overflow-hidden rounded-xl border shadow-e2 ${s.box}`}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span className={`mt-0.5 shrink-0 ${s.icon}`}>{s.node}</span>
        <p className="min-w-0 flex-1 text-sm text-gray-800">
          {toast.text}
          {toast.anzahl > 1 ? (
            <Badge tone="neutral" className="ml-1.5">
              ×{toast.anzahl}
            </Badge>
          ) : null}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Meldung schließen"
          className="-mr-1 -mt-1 shrink-0 cursor-pointer rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {/* Ablaufbalken: zeigt, wann die Meldung verschwindet. */}
      <div className="h-0.5 w-full bg-gray-100">
        <div
          className={`h-full ${s.bar} toast-ablauf`}
          style={{
            animationDuration: `${SICHTDAUER_MS}ms`,
            animationPlayState: pausiert ? "paused" : "running",
          }}
        />
      </div>
    </div>
  );
}
