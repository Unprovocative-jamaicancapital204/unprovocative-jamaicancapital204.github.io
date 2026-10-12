/* heylivo Service Worker: macht die App installierbar und zeigt die
   Push-Erinnerungen (Edge Function send-reminders). Bewusst ohne Offline-Cache,
   damit nach jedem Update sofort die neue Version läuft. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Jede Push-Nachricht wird angezeigt - Browser (vor allem Safari) entziehen
// sonst die Erlaubnis.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(data.title || 'heylivo', {
    body: data.body || '',
    icon: '../app-icon-192.png',
    badge: '../icon.png',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || self.registration.scope }
  }));
});

// Tippen öffnet die App (oder holt das offene Fenster nach vorn).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || self.registration.scope;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.find((client) => client.url.startsWith(self.registration.scope));
    return open ? open.focus() : self.clients.openWindow(target);
  })());
});
