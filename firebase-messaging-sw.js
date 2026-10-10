
importScripts(
  "https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyDluixmi062HB7SrUlj_NanuhgHbp9fon4",
  authDomain: "my-planner-7dfe9.firebaseapp.com",
  projectId: "my-planner-7dfe9",
  storageBucket: "my-planner-7dfe9.firebasestorage.app",
  messagingSenderId: "304198967880",
  appId: "1:304198967880:web:02bf38a32b1c398ac12e7d"
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
