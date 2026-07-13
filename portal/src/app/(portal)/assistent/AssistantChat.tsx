"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Send, Sparkles, User } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { ask } from "./actions";

type Source = { type: string; title: string; href: string };
type Msg = { role: "user" | "assistant"; text: string; sources?: Source[] };

const EXAMPLES = [
  "Welche Beschlüsse wurden zuletzt gefasst?",
  "Wann ist die nächste Eigentümerversammlung?",
  "Gibt es aktuelle Aushänge?",
];

export function AssistantChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

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
    <div className="mx-auto flex h-[calc(100vh-13rem)] max-w-3xl flex-col">
      {/* Verlauf */}
      <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-white/10 bg-white/95 p-4 shadow-xl shadow-black/10 backdrop-blur sm:p-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-orange-light text-brand-orange-dark">
              <Sparkles className="h-6 w-6" />
            </span>
            <div>
              <p className="font-semibold text-gray-900">Fragen Sie Ihre Unterlagen</p>
              <p className="mt-1 max-w-sm text-sm text-gray-500">
                Antworten stammen ausschließlich aus den Dokumenten, Beschlüssen und Aushängen,
                die Sie sehen dürfen – mit Quellenangabe.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
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
          messages.map((m, i) => <Bubble key={i} msg={m} />)
        )}
        {pending ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Sparkles className="h-4 w-4 animate-pulse text-brand-orange" />
            Assistent denkt nach …
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      {/* Eingabe */}
      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
      >
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(value);
            }
          }}
          rows={1}
          placeholder="Frage stellen … (Enter zum Senden)"
          aria-label="Frage an den Assistenten"
          className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
        />
        <button
          type="submit"
          disabled={pending || !value.trim()}
          aria-label="Senden"
          className={`${buttonClass} h-11 px-4`}
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
      <p className="mt-2 text-center text-xs text-gray-400">
        KI-Antworten können Fehler enthalten. Maßgeblich sind die verlinkten Originalquellen.
      </p>
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-brand-green text-white" : "bg-brand-orange-light text-brand-orange-dark"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </span>
      <div className={`min-w-0 max-w-[85%] ${isUser ? "text-right" : ""}`}>
        <div
          className={`inline-block whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
            isUser
              ? "bg-brand-green text-white"
              : "border border-gray-200 bg-gray-50 text-gray-800"
          }`}
        >
          {msg.text}
        </div>
        {msg.sources && msg.sources.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {msg.sources.map((s, i) => (
              <Link
                key={i}
                href={s.href}
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 transition hover:border-brand-orange/50 hover:text-brand-green"
              >
                <span className="font-medium text-brand-orange-dark">{s.type}</span>
                <span className="max-w-[16rem] truncate">{s.title}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
