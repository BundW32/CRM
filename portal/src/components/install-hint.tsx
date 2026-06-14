"use client";

import { useEffect, useState } from "react";

type OS = "ios" | "android" | "other";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

const DISMISS_KEY = "bw-install-dismissed";

function ShareIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 3v11M12 3L8.5 6.5M12 3l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 10H5.5A1.5 1.5 0 004 11.5v7A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5v-7A1.5 1.5 0 0018.5 10H18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-orange text-xs font-bold text-brand-green-dark">
        {n}
      </span>
      <span className="text-sm text-gray-700">{children}</span>
    </li>
  );
}

export function InstallHint() {
  const [os, setOs] = useState<OS>("other");
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    let active = true;
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    (async () => {
      await Promise.resolve();
      if (!active) return;
      const ua = navigator.userAgent || "";
      const isIOS = /iphone|ipad|ipod/i.test(ua);
      const isAndroid = /android/i.test(ua);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true;
      const dismissed = localStorage.getItem(DISMISS_KEY) === "1";
      setOs(isIOS ? "ios" : isAndroid ? "android" : "other");
      if (!standalone && !dismissed && (isIOS || isAndroid)) setShow(true);
    })();

    return () => {
      active = false;
      window.removeEventListener("beforeinstallprompt", onBip);
    };
  }, []);

  function dismiss() {
    setShow(false);
    setOpen(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignorieren */
    }
  }

  async function androidInstall() {
    if (!deferred) {
      setOpen(true);
      return;
    }
    await deferred.prompt();
    await deferred.userChoice.catch(() => null);
    setDeferred(null);
    dismiss();
  }

  if (!show) return null;

  return (
    <>
      {/* Hinweis-Leiste */}
      <div className="fixed inset-x-3 bottom-3 z-40 sm:left-auto sm:right-4 sm:w-80">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white p-3 shadow-xl shadow-black/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className="h-10 w-10 rounded-lg" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">Als App installieren</p>
            <p className="truncate text-xs text-gray-500">
              Schneller Zugriff direkt vom Startbildschirm
            </p>
          </div>
          <button
            type="button"
            onClick={() => (os === "android" ? androidInstall() : setOpen(true))}
            className="shrink-0 rounded-lg bg-brand-orange px-3 py-1.5 text-xs font-semibold text-brand-green-dark hover:bg-brand-orange-dark"
          >
            Anzeigen
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Hinweis schließen"
            className="shrink-0 rounded-md px-1 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Anleitung */}
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">
                {os === "ios" ? "Auf dem iPhone installieren" : "Auf Android installieren"}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Schließen"
                className="rounded-md px-1 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {os === "ios" ? (
              <>
                {/* Illustration: Safari-Leiste mit hervorgehobenem Teilen-Symbol */}
                <div className="relative mb-5 rounded-xl bg-gray-100 p-3">
                  <div className="flex items-center justify-around rounded-lg bg-white py-2 shadow-sm">
                    <span className="text-gray-300">‹</span>
                    <span className="text-gray-300">›</span>
                    <span className="relative">
                      <span className="absolute -inset-1.5 animate-pulse rounded-lg ring-2 ring-brand-orange" />
                      <ShareIcon className="h-6 w-6 text-brand-green" />
                    </span>
                    <span className="text-gray-300">▢</span>
                    <span className="text-gray-300">⤢</span>
                  </div>
                  <div className="mt-1 flex justify-center">
                    <span className="text-2xl leading-none text-brand-orange">↑</span>
                  </div>
                  <p className="text-center text-xs font-medium text-brand-orange">
                    Hier tippen
                  </p>
                </div>
                <ol className="space-y-3">
                  <Step n={1}>
                    Tippen Sie unten in Safari auf das <strong>Teilen-Symbol</strong> (Quadrat mit
                    Pfeil nach oben).
                  </Step>
                  <Step n={2}>
                    Scrollen Sie und wählen Sie <strong>„Zum Home-Bildschirm“</strong>.
                  </Step>
                  <Step n={3}>
                    Tippen Sie oben rechts auf <strong>„Hinzufügen“</strong> — fertig!
                  </Step>
                </ol>
                <p className="mt-4 rounded-lg bg-brand-orange-light px-3 py-2 text-xs text-brand-green-dark">
                  Wichtig: Das funktioniert nur in <strong>Safari</strong>, nicht in Chrome auf dem
                  iPhone.
                </p>
              </>
            ) : (
              <>
                {/* Illustration: Menü oben rechts */}
                <div className="relative mb-5 rounded-xl bg-gray-100 p-3">
                  <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm">
                    <span className="truncate text-xs text-gray-400">portal.bundwimmobilien.de</span>
                    <span className="relative">
                      <span className="absolute -inset-1.5 animate-pulse rounded-lg ring-2 ring-brand-orange" />
                      <span className="text-lg leading-none text-brand-green">⋮</span>
                    </span>
                  </div>
                  <div className="mt-1 flex justify-end pr-3">
                    <span className="text-2xl leading-none text-brand-orange">↑</span>
                  </div>
                  <p className="pr-1 text-right text-xs font-medium text-brand-orange">Menü</p>
                </div>
                {deferred ? (
                  <button
                    type="button"
                    onClick={androidInstall}
                    className="mb-4 w-full rounded-lg bg-brand-orange px-4 py-2.5 text-sm font-semibold text-brand-green-dark hover:bg-brand-orange-dark"
                  >
                    Jetzt installieren
                  </button>
                ) : null}
                <ol className="space-y-3">
                  <Step n={1}>
                    Tippen Sie oben rechts auf das <strong>Menü (⋮)</strong>.
                  </Step>
                  <Step n={2}>
                    Wählen Sie <strong>„App installieren“</strong> bzw. „Zum Startbildschirm
                    hinzufügen“.
                  </Step>
                  <Step n={3}>
                    Bestätigen Sie mit <strong>„Installieren“</strong> — fertig!
                  </Step>
                </ol>
              </>
            )}

            <button
              type="button"
              onClick={dismiss}
              className="mt-5 w-full text-center text-xs text-gray-400 hover:text-gray-600"
            >
              Nicht mehr anzeigen
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
