document.addEventListener("DOMContentLoaded", () => {
  const login = document.getElementById("loginForm");
  const register = document.getElementById("registerForm");
  const password = document.getElementById("regPassword");
  const confirm = document.getElementById("confirmPassword");
  const strength = document.querySelector(".strength span");
  const params = new URLSearchParams(location.search);
  const nextPage = params.get("next") || "dashboard.html";

  function getUsers() {
    return JSON.parse(localStorage.getItem("mmm-users") || "[]");
  }

  function saveUsers(users) {
    localStorage.setItem("mmm-users", JSON.stringify(users));
  }

  function startSession(user) {
    localStorage.setItem("mmm-current-user", JSON.stringify({
      name: user.name,
      email: user.email
    }));
  }

  login?.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = normalizeEmail(document.getElementById("loginEmail").value);
    const passwordValue = document.getElementById("loginPassword").value;
    const user = getUsers().find((item) => normalizeEmail(item.email) === email && item.password === passwordValue);
    if (!user) {
      toast("Invalid email or password. Create an account first.");
      return;
    }
    startSession(user);
    toast("Logged in successfully");
    setTimeout(() => location.href = nextPage, 650);
  });

  password?.addEventListener("input", () => {
    const value = password.value;
    let score = 0;
    if (value.length >= 8) score += 35;
    if (/[A-Z]/.test(value)) score += 20;
    if (/[0-9]/.test(value)) score += 20;
    if (/[^A-Za-z0-9]/.test(value)) score += 25;
    strength.style.width = `${score}%`;
    strength.style.background = score > 75 ? "#10B981" : score > 45 ? "#F59E0B" : "#EF4444";
  });

  register?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (password.value !== confirm.value) return toast("Passwords do not match");
    const users = getUsers();
    const user = {
      name: document.getElementById("regName").value.trim(),
      email: normalizeEmail(document.getElementById("regEmail").value),
      currency: document.getElementById("regCurrency").value,
      password: password.value
    };
    if (users.some((item) => normalizeEmail(item.email) === user.email)) {
      toast("An account with this email already exists");
      return;
    }
    users.push(user);
    saveUsers(users);
    startSession(user);
    const settingsKey = `mmm:${user.email}:settings`;
    localStorage.setItem(settingsKey, JSON.stringify({
      ...defaultSettings,
      name: user.name,
      email: user.email,
      currency: user.currency
    }));
    document.querySelector(".success-pop").classList.add("show");
    toast("Account created");
    setTimeout(() => location.href = "dashboard.html", 900);
  });
});
