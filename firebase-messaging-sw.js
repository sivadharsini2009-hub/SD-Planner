
importScripts(
  "https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js"
);
importScripts(
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
  const options = {
    body: payload.notification?.body || "You have a reminder.",
    icon: "./icon.svg",
    data: { url: "./index.html" }
  };

  self.registration.showNotification(title, options);
});
