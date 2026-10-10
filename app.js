

const $ = id => document.getElementById(id);

const STORAGE_KEY = "littlePlannerTasks";
const SETTINGS_KEY = "littlePlannerSettings";
const ALERTS_KEY = "littlePlannerAlerts";

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Could not save:", error);
  }
}

let tasks = load(STORAGE_KEY, []);

let settings = {
  bedtime: "21:45",
  ringtone: "classic",
  volume: 70,
  ringEnabled: true,
  ...load(SETTINGS_KEY, {})
};

let alerted = load(ALERTS_KEY, {});
let audioContext = null;
let installPrompt = null;

function makeId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function persist() {
  save(STORAGE_KEY, tasks);
  render();
}

function render() {
  const pending = tasks.filter(task => !task.completed);

  $("total").textContent = tasks.length;
  $("pending").textContent = pending.length;
  $("done").textContent = tasks.length - pending.length;

  const filter = $("filter").value;

  const shown = tasks.filter(task => {
    if (filter === "pending") return !task.completed;
    if (filter === "done") return task.completed;
    return true;
  });

  $("empty").hidden = shown.length > 0;

  $("taskList").innerHTML = shown.map(task => {
    const overdue = task.deadline &&
      new Date(task.deadline).getTime() < Date.now() &&
      !task.completed;

    const deadlineText = task.deadline
      ? new Date(task.deadline).toLocaleString()
      : "No deadline";

    return `
      <article class="task ${task.completed ? "completed" : ""} ${overdue ? "overdue" : ""}">
        <input type="checkbox"
          data-check="${task.id}"
          aria-label="Mark task completed"
          ${task.completed ? "checked" : ""}>

        <div class="task-content">
          <div class="task-title">${escapeHTML(task.title)}</div>
          <div class="task-meta">
            ${escapeHTML(task.category)} · ${escapeHTML(deadlineText)}
            ${overdue ? " · OVERDUE" : ""}
          </div>
        </div>

        <button class="delete"
          data-delete="${task.id}"
          aria-label="Delete task">✕</button>
      </article>`;
  }).join("");
}

// Add tasks
$("taskForm").addEventListener("submit", event => {
  event.preventDefault();

  const title = $("taskInput").value.trim();
  if (!title) return;

  const deadlineValue = $("deadline").value;

  tasks.unshift({
    id: makeId(),
    title,
    category: $("category").value,
    deadline: deadlineValue
      ? new Date(deadlineValue).toISOString()
      : "",
    completed: false,
    createdAt: new Date().toISOString()
  });

  persist();
  $("taskForm").reset();
  $("taskInput").focus();
});

// Complete tasks
$("taskList").addEventListener("change", event => {
  const id = event.target.dataset.check;
  if (!id) return;

  const task = tasks.find(item => item.id === id);

  if (task) {
    task.completed = event.target.checked;
    persist();
  }
});

// Delete tasks
$("taskList").addEventListener("click", event => {
  const id = event.target.dataset.delete;
  if (!id) return;

  tasks = tasks.filter(task => task.id !== id);
  persist();
});

$("filter").addEventListener("change", render);

// Date at the top
$("today").textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
});

// Save bedtime
$("bedtime").value = settings.bedtime;

$("saveBedtime").addEventListener("click", () => {
  settings.bedtime = $("bedtime").value || "21:45";
  save(SETTINGS_KEY, settings);
  $("ringStatus").textContent =
    "Bedtime saved: " + settings.bedtime;
});

// Firebase Messaging setup
const firebaseConfig = {
  apiKey: "AIzaSyDluixmi062HB7SrUlj_NanuhgHbp9fon4",
  authDomain: "my-planner-7dfe9.firebaseapp.com",
  projectId: "my-planner-7dfe9",
  storageBucket: "my-planner-7dfe9.firebasestorage.app",
  messagingSenderId: "304198967880",
  appId: "1:304198967880:web:02bf38a32b1c398ac12e7d"
};

const VAPID_PUBLIC_KEY = "BMpas-hI6GHy80DdmLdD75AgLjBRHOep-upmjFp2pObzHwNbQqIIvtGeC5OIQxOEe8nUg0itHcg7xL43UmU8hwk";

let firebaseMessaging = null;

try {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  firebaseMessaging = firebase.messaging();
} catch (error) {
  console.error("Firebase setup failed:", error);
}

// Enable browser notifications and register the existing service worker
async function enableNotifications() {
  if (!("Notification" in window) ||
      !("serviceWorker" in navigator)) {
    alert("This browser does not support web push notifications.");
    return;
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      alert("Please allow notifications in your browser settings.");
      return;
    }

    if (!firebaseMessaging) {
      throw new Error("Firebase Messaging did not initialize.");
    }

    const registration = await navigator.serviceWorker.register("./sw.js");
    await navigator.serviceWorker.ready;

    const token = await firebaseMessaging.getToken({
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration
    });

    if (!token) {
      throw new Error("No push token was returned.");
    }

    // Save this device's token locally for now.
    // Do not share it publicly.
    save("littlePlannerFcmToken", token);
    prompt("Copy your FCM token for testing. Keep it private:",token):

    $("ringStatus").textContent =
      "Push notifications enabled on this device.";

    alert("Notifications enabled! Your device is registered.");
    console.log("Firebase Messaging token obtained.");
  } catch (error) {
    console.error("Notification setup failed:", error);

    $("ringStatus").textContent =
      "Notification setup failed. Check the browser console.";

    alert(
      "Couldn't connect notifications. Check your internet connection " +
      "and Firebase settings, then try again."
    );
  }
}

$("enableAlerts").addEventListener("click", enableNotifications);
// Ringtone player
function playRingtone() {
  if (!settings.ringEnabled) return;

  const AudioClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioClass) {
    $("ringStatus").textContent = "Audio is not supported.";
    return;
  }

  try {
    audioContext ||= new AudioClass();

    const melodies = {
      classic: [880, 660, 880, 660],
      gentle: [523, 659, 784, 659],
      urgent: [880, 880, 660, 880, 880, 660]
    };

    const notes = melodies[settings.ringtone] || melodies.classic;
    const volume = Math.max(0, Math.min(1, settings.volume / 100));
    const startTime = audioContext.currentTime + 0.05;

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    notes.forEach((frequency, index) => {
      const start = startTime + index * 0.3;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(
        volume * 0.18, start + 0.04
      );
      gain.gain.setValueAtTime(volume * 0.18, start + 0.12);
      gain.gain.linearRampToValueAtTime(0.001, start + 0.25);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start(start);
      oscillator.stop(start + 0.27);
    });
  } catch (error) {
    console.error("Ringtone playback failed:", error);
    $("ringStatus").textContent =
      "Sound failed. Tap Test ringtone again.";
  }
}

// Load saved ringtone settings
function loadRingtoneControls() {
  $("ringtone").value = settings.ringtone;
  $("ringVolume").value = settings.volume;
  $("ringEnabled").checked = settings.ringEnabled;
}

// Test ringtone
$("testRingtone").addEventListener("click", async () => {
  settings.ringtone = $("ringtone").value;
  settings.volume = Number($("ringVolume").value);
  settings.ringEnabled = $("ringEnabled").checked;

  if (!settings.ringEnabled) {
    $("ringStatus").textContent =
      "Enable ringtone alerts before testing.";
    return;
  }

  try {
    const AudioClass = window.AudioContext || window.webkitAudioContext;

    if (AudioClass) {
      audioContext ||= new AudioClass();
      await audioContext.resume();
    }

    playRingtone();

    $("ringStatus").textContent =
      "Testing your selected ringtone.";
  } catch (error) {
    $("ringStatus").textContent =
      "Couldn't play sound. Check media volume.";
  }
});

// Save ringtone settings
$("saveRingtone").addEventListener("click", () => {
  settings.ringtone = $("ringtone").value;
  settings.volume = Number($("ringVolume").value);
  settings.ringEnabled = $("ringEnabled").checked;

  save(SETTINGS_KEY, settings);

  $("ringStatus").textContent =
    "Ringtone settings saved successfully ♡";
});

loadRingtoneControls();

// Local date key
function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Show notification and play ringtone
async function notify(title, message) {
  playRingtone();

  if ("Notification" in window &&
      Notification.permission === "granted") {
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;

        await registration.showNotification(title, {
          body: message,
          icon: "./icon.svg",
          tag: title + "-" + message
        });

        return;
      }

      new Notification(title, { body: message });
    } catch (error) {
      console.error("Notification failed:", error);
    }
  }
}

// Check deadlines and bedtime
function checkReminders() {
  const now = new Date();
  const today = localDateKey(now);

  tasks.forEach(task => {
    if (
      !task.completed &&
      task.deadline &&
      new Date(task.deadline).getTime() <= now.getTime()
    ) {
      const key = "task-" + task.id;

      if (!alerted[key]) {
        alerted[key] = true;
        save(ALERTS_KEY, alerted);
        notify("Task deadline reached", task.title);
      }
    }
  });

  const currentTime =
    String(now.getHours()).padStart(2, "0") + ":" +
    String(now.getMinutes()).padStart(2, "0");

  const bedtimeKey = "bedtime-" + today;

  if (
    settings.bedtime &&
    currentTime >= settings.bedtime &&
    !alerted[bedtimeKey]
  ) {
    alerted[bedtimeKey] = true;
    save(ALERTS_KEY, alerted);

    const unfinished = tasks.filter(task => !task.completed);

    const message = unfinished.length
      ? `You have ${unfinished.length} unfinished task(s). Review your list and plan tomorrow.`
      : "Everything is completed. Well done! Take time to rest.";

    notify("Your bedtime check 🌙", message);
  }
}

// Start app
render();
checkReminders();
setInterval(checkReminders, 15000);

// Register service worker
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js")
    .catch(error => console.error("Service worker error:", error));
}

// Install app button, where supported
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event;
  $("installApp").hidden = false;
});

$("installApp").addEventListener("click", async () => {
  if (!installPrompt) return;

  installPrompt.prompt();
  await installPrompt.userChoice;

  installPrompt = null;
  $("installApp").hidden = true;
});
