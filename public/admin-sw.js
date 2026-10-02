// Service Worker der Admin-App „Hofkasse“: zeigt Push-Mitteilungen an. Kein Offline-Cache.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(
    self.registration.showNotification(d.title || "Hofkasse", {
      body: d.body || "",
      icon: "/icons/hofkasse-192.png",
      badge: "/icons/badge-96.png",
      tag: d.tag,
      renotify: Boolean(d.tag),
      data: { url: d.url || "/admin" },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/admin", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if (c.url.startsWith(self.location.origin + "/admin") && "focus" in c) { c.navigate(url); return c.focus(); }
      return self.clients.openWindow(url);
    }),
  );
});
