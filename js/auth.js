document.addEventListener("DOMContentLoaded", () => {
  const login = document.getElementById("loginForm");
  const register = document.getElementById("registerForm");
  const password = document.getElementById("regPassword");
  const confirm = document.getElementById("confirmPassword");
  const strength = document.querySelector(".strength span");

  login?.addEventListener("submit", (e) => {
    e.preventDefault();
    toast("Logged in successfully");
    setTimeout(() => location.href = "dashboard.html", 650);
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
    document.querySelector(".success-pop").classList.add("show");
    toast("Account created");
    setTimeout(() => location.href = "dashboard.html", 900);
  });
});
