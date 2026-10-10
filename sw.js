importScripts(
  "https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  authDomain: "my-planner-7dfe9.firebaseapp.com",
  projectId: "my-planner-7dfe9",
  storageBucket: "my-planner-7dfe9.firebasestorage.app",
  messagingSenderId: "304198967880",
  appId: "YOUR_APP_ID"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "My Little Planner";

  self.registration.showNotification(title, {
    body: payload.notification?.body || "You have a reminder.",
    icon: "./icon.svg",
    data: { url: "./index.html" }
  });
});
const CACHE_NAME = "little-planner-v1";
const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request).then(response => {
      if (response.ok && new URL(event.request.url).origin === location.origin) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache =>
          cache.put(event.request, copy)
        );
      }
      return response;
    }).catch(async () => {
      return await caches.match(event.request) ||
        (event.request.mode === "navigate"
          ? await caches.match("./index.html")
          : Response.error());
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(windows => {
        for (const client of windows) {
          if ("focus" in client) return client.focus();
        }
        return clients.openWindow("./index.html");
      })
  );
});
