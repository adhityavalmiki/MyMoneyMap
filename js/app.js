const defaultSettings = {
  name: "User",
  email: "",
  currency: "INR",
  monthlyBudget: 0,
  savingsGoal: 0,
  notifications: {
    budget: true,
    subscriptions: true,
    portfolio: true,
    weekly: true
  }
};

const seedTransactions = [];
const seedStocks = [];
const seedSubscriptions = [];
const protectedPages = ["dashboard.html", "transactions.html", "portfolio.html", "subscriptions.html", "emi.html", "settings.html"];
const scopedKeys = ["mmm-transactions", "mmm-stocks", "mmm-subscriptions", "mmm-settings"];

function currentUser() {
  return JSON.parse(localStorage.getItem("mmm-current-user") || "null");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function storageKey(key) {
  const user = currentUser();
  if (!user || !scopedKeys.includes(key)) return key;
  return `mmm:${normalizeEmail(user.email)}:${key.replace("mmm-", "")}`;
}

function requireAuth() {
  const page = location.pathname.split("/").pop() || "index.html";
  if (protectedPages.includes(page) && !currentUser()) {
    location.href = `login.html?next=${encodeURIComponent(page)}`;
  }
}

function removeOldDemoData() {
  const demoSets = {
    "mmm-transactions": ["t1", "t2", "t3", "t4", "t5"],
    "mmm-stocks": ["s1", "s2", "s3", "s4"],
    "mmm-subscriptions": ["n1", "n2", "n3", "n4"]
  };

  Object.entries(demoSets).forEach(([key, ids]) => {
    const stored = JSON.parse(localStorage.getItem(key) || "[]");
    const isOnlyOriginalDemo = stored.length === ids.length && stored.every((item) => ids.includes(item.id));
    if (isOnlyOriginalDemo) localStorage.setItem(key, "[]");
  });
}

function getStore(key, fallback) {
  const finalKey = storageKey(key);
  const existing = localStorage.getItem(finalKey);
  if (existing) return JSON.parse(existing);
  localStorage.setItem(finalKey, JSON.stringify(fallback));
  return fallback;
}

function setStore(key, value) {
  localStorage.setItem(storageKey(key), JSON.stringify(value));
}

function getSettings() {
  const user = currentUser();
  const base = {
    ...defaultSettings,
    name: user?.name || defaultSettings.name,
    email: user?.email || defaultSettings.email
  };
  return { ...base, ...getStore("mmm-settings", base) };
}

function formatMoney(value, currency = getSettings().currency) {
  const locale = currency === "INR" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function money(value) { return formatMoney(value); }

function applyProfile() {
  const settings = getSettings();
  const firstName = settings.name.trim().split(" ")[0] || "User";
  const initial = firstName[0]?.toUpperCase() || "U";
  document.querySelectorAll(".sidebar-profile strong, [data-profile-name]").forEach((el) => {
    el.textContent = firstName;
  });
  document.querySelectorAll(".avatar, [data-profile-initial]").forEach((el) => {
    el.textContent = initial;
  });
}

function toast(message) {
  let wrap = document.querySelector(".toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const item = document.createElement("div");
  item.className = "toast";
  item.textContent = message;
  wrap.appendChild(item);
  setTimeout(() => item.remove(), 2800);
}

function animateCounters(scope = document) {
  scope.querySelectorAll("[data-counter]").forEach((el) => {
    const target = Number(el.dataset.counter);
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 42));
    const timer = setInterval(() => {
      current += step;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      el.textContent = prefix + current.toLocaleString("en-IN") + suffix;
    }, 22);
  });
}

function initTheme() {
  const saved = localStorage.getItem("mmm-theme") || "light";
  document.documentElement.dataset.theme = saved;
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("mmm-theme", next);
      toast(`${next[0].toUpperCase() + next.slice(1)} mode enabled`);
    });
  });
}

function initLayout() {
  document.querySelectorAll("[data-sidebar-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => document.body.classList.toggle("sidebar-open"));
  });
  const currentPage = location.pathname.split("/").pop() || "index.html";
  let activeSet = false;
  document.querySelectorAll(".nav-item").forEach((link) => {
    link.classList.remove("active");
    if (!activeSet && link.getAttribute("href") === currentPage) {
      link.classList.add("active");
      activeSet = true;
    }
  });
}

function initRipples() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn");
    if (!btn) return;
    const circle = document.createElement("span");
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    circle.className = "ripple";
    circle.style.width = circle.style.height = `${size}px`;
    circle.style.left = `${e.clientX - rect.left - size / 2}px`;
    circle.style.top = `${e.clientY - rect.top - size / 2}px`;
    btn.appendChild(circle);
    setTimeout(() => circle.remove(), 600);
  });
}

function initLoader() {
  const loader = document.querySelector(".loader");
  if (loader) setTimeout(() => loader.classList.add("hidden"), 450);
}

function exportCSV(rows, filename = "transactions.csv") {
  if (!rows.length) {
    toast("No data to export yet");
    return;
  }
  const headers = Object.keys(rows[0] || {});
  const body = rows.map((row) => headers.map((key) => `"${String(row[key]).replaceAll('"', '""')}"`).join(","));
  const blob = new Blob([[headers.join(","), ...body].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function chartColors() {
  const dark = document.documentElement.dataset.theme === "dark";
  return { text: dark ? "#cbd5e1" : "#64748b", grid: dark ? "#243047" : "#e5e7eb" };
}

function makeLineChart(id, labels, income, expenses) {
  const el = document.getElementById(id);
  if (!el || !window.Chart) return;
  const c = chartColors();
  return new Chart(el, {
    type: "line",
    data: { labels, datasets: [
      { label: "Income", data: income, borderColor: "#10B981", backgroundColor: "rgba(16,185,129,.12)", tension: .42, fill: true },
      { label: "Expenses", data: expenses, borderColor: "#4F46E5", backgroundColor: "rgba(79,70,229,.10)", tension: .42, fill: true }
    ]},
    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 1200 }, plugins: { legend: { labels: { color: c.text } } }, scales: { x: { ticks: { color: c.text }, grid: { color: c.grid } }, y: { ticks: { color: c.text }, grid: { color: c.grid } } } }
  });
}

function makeDoughnutChart(id, labels, data) {
  const el = document.getElementById(id);
  if (!el || !window.Chart) return;
  return new Chart(el, {
    type: "doughnut",
    data: { labels, datasets: [{ data, backgroundColor: ["#4F46E5", "#10B981", "#F59E0B", "#EF4444", "#06B6D4"], borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: "68%", animation: { animateRotate: true, duration: 1200 }, plugins: { legend: { position: "bottom" } } }
  });
}

function makeBarChart(id, labels, data) {
  const el = document.getElementById(id);
  if (!el || !window.Chart) return;
  const c = chartColors();
  return new Chart(el, {
    type: "bar",
    data: { labels, datasets: [{ label: "Spending", data, backgroundColor: "#4F46E5", borderRadius: 12 }] },
    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 1000 }, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: c.text }, grid: { display: false } }, y: { ticks: { color: c.text }, grid: { color: c.grid } } } }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  requireAuth();
  removeOldDemoData();
  initLoader();
  initTheme();
  initLayout();
  initRipples();
  animateCounters();
  applyProfile();
});
