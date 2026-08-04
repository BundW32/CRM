// Service Worker für das B&W Kundenportal (PWA + Push)
const CACHE = "bw-portal-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL])).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Seiten-Navigationen: Netzwerk zuerst, bei Offline die Offline-Seite zeigen.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
});

// Push-Benachrichtigung anzeigen
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "", body: event.data ? event.data.text() : "" };
  }
  // Kein fester Produktname und kein festes Icon: Diese Datei ist statisch und
  // kennt `APP_MODE` nicht. Der Titel kommt aus der Nachricht, das Icon über
  // eine Weiche in next.config.ts — sonst trüge jede Push-Meldung auf
  // wegportal24 das B&W-Signet.
  const title = data.title || "Neue Nachricht";
  const options = {
    body: data.body || "",
    icon: "/app-icon-192.png",
    badge: "/app-icon-192.png",
    data: { url: data.url || "/dashboard" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Klick auf die Benachrichtigung: vorhandenes Fenster fokussieren oder neu öffnen
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
