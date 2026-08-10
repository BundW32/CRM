"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { MessageSquareText, Send, Sparkles, User, X } from "lucide-react";
import { ask } from "@/app/(portal)/assistent/actions";

type Source = { type: string; title: string; href: string };
type Msg = { role: "user" | "assistant"; text: string; sources?: Source[] };

// Die Beispiele sind die einzige Stelle, an der jemand erfährt, was der
// Assistent überhaupt kann. Sie decken deshalb bewusst die drei Wissensquellen
// ab und nicht dreimal dieselbe: Geld, Fachbegriff, Unterlagen.
const EXAMPLES = [
  "Wie viel Geld hat die Gemeinschaft auf dem Konto?",
  "Was ist eine Abrechnungsspitze?",
  "Welche Beschlüsse wurden zuletzt gefasst?",
];

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending, open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function submit(raw: string) {
    const question = raw.trim();
    if (!question || pending) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setValue("");
    const fd = new FormData();
    fd.set("question", question);
    start(async () => {
      const res = await ask(null, fd);
      setMessages((m) => [...m, { role: "assistant", text: res.answer, sources: res.sources }]);
    });
  }

  return (
    <>
      {/* Schwebender Auslöser unten rechts */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Assistent schließen" : "Assistent öffnen"}
        aria-expanded={open}
        data-tour="assistent"
        className="fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-orange text-brand-green-dark shadow-xl shadow-black/25 transition-all hover:bg-brand-orange-dark hover:shadow-2xl active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange"
      >
        {open ? <X className="h-6 w-6" /> : <MessageSquareText className="h-6 w-6" />}
      </button>

      {/* Chat-Panel */}
      {open ? (
        <div
          role="dialog"
          aria-label="Assistent"
          className="fixed inset-x-3 bottom-24 top-16 z-40 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl shadow-black/30 motion-safe:animate-slide-down sm:inset-x-auto sm:top-auto sm:right-4 sm:h-[min(560px,calc(100vh-7rem))] sm:w-[380px]"
        >
          {/* Kopf */}
          <div className="flex items-center gap-2.5 border-b border-gray-100 bg-brand-green px-4 py-3 text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
              <Sparkles className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">Assistent</p>
              <p className="truncate text-[11px] text-white/70">Antworten aus Ihren Unterlagen</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Schließen"
              className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Verlauf */}
          <div className="flex-1 space-y-3.5 overflow-y-auto bg-gray-50/60 p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-2 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-orange-light text-brand-orange-dark">
                  <Sparkles className="h-5 w-5" />
                </span>
                <p className="text-sm text-gray-500">
                  Fragen Sie Ihre Unterlagen — Antworten stammen ausschließlich aus Dokumenten,
                  Beschlüssen und Aushängen, die Sie sehen dürfen, mit Quellenangabe.
                </p>
                <div className="flex flex-col gap-2">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => submit(ex)}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-brand-orange/40 hover:text-brand-green"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => <Bubble key={i} msg={m} onNavigate={() => setOpen(false)} />)
            )}
            {pending ? (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Sparkles className="h-4 w-4 animate-pulse text-brand-orange" />
                Assistent denkt nach …
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          {/* Eingabe */}
          <form
            className="flex items-end gap-2 border-t border-gray-100 bg-white p-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit(value);
            }}
          >
            <textarea
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(value);
                }
              }}
              rows={1}
              placeholder="Frage stellen …"
              aria-label="Frage an den Assistenten"
              className="max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
            />
            <button
              type="submit"
              disabled={pending || !value.trim()}
              aria-label="Senden"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange text-brand-green-dark shadow-e1 transition-all hover:bg-brand-orange-dark active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          {/* Fest verdrahtet, nicht generiert (Art. 50 KI-VO + Konzept 3.5):
              Die Kennzeichnung als KI und der Rechtsberatungs-Hinweis dürfen
              nicht davon abhängen, ob das Modell daran denkt. */}
          <p className="border-t border-gray-100 bg-white px-3 pb-2 pt-1.5 text-center text-[11px] leading-snug text-gray-400">
            Antworten werden automatisiert mit KI erstellt, können Fehler enthalten und sind
            keine Rechtsberatung.
          </p>
        </div>
      ) : null}
    </>
  );
}

function Bubble({ msg, onNavigate }: { msg: Msg; onNavigate: () => void }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-brand-green text-white" : "bg-brand-orange-light text-brand-orange-dark"
        }`}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
      </span>
      <div className={`min-w-0 max-w-[85%] ${isUser ? "text-right" : ""}`}>
        <div
          className={`inline-block whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
            isUser ? "bg-brand-green text-white" : "border border-gray-200 bg-white text-gray-800"
          }`}
        >
          {msg.text}
        </div>
        {msg.sources && msg.sources.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {msg.sources.map((s, i) => (
              <Link
                key={i}
                href={s.href}
                onClick={onNavigate}
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-gray-600 transition hover:border-brand-orange/50 hover:text-brand-green"
              >
                <span className="font-medium text-brand-orange-ink">{s.type}</span>
                <span className="max-w-[12rem] truncate">{s.title}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
