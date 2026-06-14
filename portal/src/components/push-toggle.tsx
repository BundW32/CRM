"use client";

import { useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function PushToggle() {
  const [state, setState] = useState<
    "laden" | "nicht_unterstuetzt" | "nicht_konfiguriert" | "aus" | "an" | "blockiert"
  >("laden");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      await Promise.resolve();
      if (!active) return;
      if (!VAPID_PUBLIC_KEY) return setState("nicht_konfiguriert");
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        return setState("nicht_unterstuetzt");
      }
      if (Notification.permission === "denied") return setState("blockiert");
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (active) setState(sub ? "an" : "aus");
      } catch {
        if (active) setState("aus");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blockiert" : "aus");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      setState(res.ok ? "an" : "aus");
    } catch {
      setState("aus");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("aus");
    } catch {
      /* ignorieren */
    } finally {
      setBusy(false);
    }
  }

  if (state === "laden") return null;
  if (state === "nicht_konfiguriert")
    return (
      <p className="text-xs text-gray-400">
        Push-Benachrichtigungen sind noch nicht eingerichtet (VAPID-Schlüssel fehlt).
      </p>
    );
  if (state === "nicht_unterstuetzt")
    return (
      <p className="text-xs text-gray-400">
        Ihr Browser unterstützt keine Push-Benachrichtigungen. Tipp: Portal über „Zum
        Startbildschirm hinzufügen“ installieren.
      </p>
    );
  if (state === "blockiert")
    return (
      <p className="text-xs text-gray-400">
        Benachrichtigungen sind in den Browser-Einstellungen blockiert.
      </p>
    );

  return state === "an" ? (
    <button
      type="button"
      onClick={disable}
      disabled={busy}
      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      Benachrichtigungen deaktivieren
    </button>
  ) : (
    <button
      type="button"
      onClick={enable}
      disabled={busy}
      className="rounded-lg bg-brand-orange px-3 py-1.5 text-sm font-semibold text-brand-green-dark hover:bg-brand-orange-dark disabled:opacity-50"
    >
      Benachrichtigungen aktivieren
    </button>
  );
}
