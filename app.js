
const $ = id => document.getElementById(id);

const STORAGE_KEY = "littlePlannerTasks";
const SETTINGS_KEY = "littlePlannerSettings";
const ALERTS_KEY = "littlePlannerAlerts";

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

function load(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

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
        <input type="checkbox" data-check="${task.id}"
          aria-label="Mark ${escapeHTML(task.title)} completed"
          ${task.completed ? "checked" : ""}>
        <div class="task-content">
          <div class="task-title">${escapeHTML(task.title)}</div>
          <div class="task-meta">
            ${escapeHTML(task.category)} · ${escapeHTML(deadlineText)}
            ${overdue ? " · OVERDUE" : ""}
          </div>
        </div>
        <button class="delete" data-delete="${task.id}"
          aria-label="Delete task">✕</button>
      </article>`;
  }).join("");
}

$("taskForm").addEventListener("submit", event => {
  event.preventDefault();

  const title = $("taskInput").value.trim();
  if (!title) return;

  const deadlineValue = $("deadline").value;
  const deadline = deadlineValue
    ? new Date(deadlineValue).toISOString()
    : "";

  tasks.unshift({
    id: makeId(),
    title,
    category: $("category").value,
    deadline,
    completed: false,
    createdAt: new Date().toISOString()
  });

  persist();
  $("taskForm").reset();
  $("taskInput").focus();
});

$("taskList").addEventListener("change", event => {
  const id = event.target.dataset.check;
  if (!id) return;

  const task = tasks.find(item => item.id === id);
  if (task) {
    task.completed = event.target.checked;
    persist();
  }
});

$("taskList").addEventListener("click", event => {
  const id = event.target.dataset.delete;
  if (!id) return;

  tasks = tasks.filter(task => task.id !== id);
  persist();
});

$("filter").addEventListener("change", render);

$("today").textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
});

$("bedtime").value = settings.bedtime;

$("saveBedtime").addEventListener("click", () => {
  settings.bedtime = $("bedtime").value || "21:45";
  save(SETTINGS_KEY, settings);
  alert("Bedtime reminder saved: " + settings.bedtime);
});

async function enableNotifications() {
  if (!("Notification" in window)) {
    alert("Notifications aren't supported in this browser.");
    return;
  }

  const permission = await Notification.requestPermission();

  if (permission === "granted") {
    alert("Notifications enabled. Keep this app running for scheduled checks.");
  } else {
    alert("Notifications were not enabled. Check your browser settings.");
  }
}

$("enableAlerts").addEventListener("click", enableNotifications);


function playRingtone() {
  if (!settings.ringEnabled) return;

  try {
    const AudioClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioClass) {
      $("ringStatus").textContent =
        "Audio is not supported by this browser.";
      return;
    }

    audioContext ||= new AudioClass();

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const melodies = {
      classic: [880, 660, 880, 660],
      gentle: [523, 659, 784, 659],
      urgent: [880, 880, 660, 880, 880, 660]
    };

    const notes = melodies[settings.ringtone] || melodies.classic;
    const volume = Math.max(0.01, Math.min(1, settings.volume / 100));
    const startTime = audioContext.currentTime + 0.05;

    notes.forEach((frequency, index) => {
      const start = startTime + index * 0.3;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(volume * 0.18, start + 0.04);
      gain.gain.setValueAtTime(volume * 0.18, start + 0.12);
      gain.gain.linearRampToValueAtTime(0.001, start + 0.25);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start(start);
      oscillator.stop(start + 0.27);
    });
  } catch (error) {
    console.error("Ringtone playback failed:", error);
  }
}


function checkReminders() {
  const now = new Date();
  const today = now.toLocaleDateString("en-CA");

  tasks.forEach(task => {
    if (!task.completed && task.deadline &&
        new Date(task.deadline).getTime() <= now.getTime()) {
      const key = "task-" + task.id;

      if (!alerted[key]) {
        alerted[key] = true;
        save(ALERTS_KEY, alerted);
        notify("Task deadline reached", task.title);
      }
    }
  });

  const currentTime = now.toTimeString().slice(0, 5);
  const bedtimeKey = "bedtime-" + today;

  if (currentTime >= settings.bedtime && !alerted[bedtimeKey]) {
    alerted[bedtimeKey] = true;
    save(ALERTS_KEY, alerted);

    const unfinished = tasks.filter(task => !task.completed);
    const message = unfinished.length
      ? `You have ${unfinished.length} unfinished task(s). Review your list and plan tomorrow.`
      : "Everything is completed. Well done! Take some time to rest.";

    notify("Your bedtime check 🌙", message);
  }
}

render();
checkReminders();
setInterval(checkReminders, 15000);

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js").catch(console.error);
}

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
