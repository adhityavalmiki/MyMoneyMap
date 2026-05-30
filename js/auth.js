document.addEventListener("DOMContentLoaded", () => {
  const login = document.getElementById("loginForm");
  const register = document.getElementById("registerForm");
  const forgotPassword = document.getElementById("forgotPasswordForm");
  const resetPassword = document.getElementById("resetPasswordForm");
  const password = document.getElementById("regPassword");
  const confirm = document.getElementById("confirmPassword");
  const strength = document.querySelector(".strength span");
  const params = new URLSearchParams(location.search);
  const nextPage = params.get("next") || "dashboard.html";

  function setLoading(button, text) {
    button.dataset.originalText = button.dataset.originalText || button.textContent;
    button.textContent = text;
    button.disabled = true;
  }

  function clearLoading(button) {
    button.textContent = button.dataset.originalText;
    button.disabled = false;
  }

  function resetRedirectUrl() {
    const currentPath = location.pathname.replace(/[^/]+$/, "reset-password.html");
    return `${location.origin}${currentPath}`;
  }

  login?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!hasSupabase()) return toast("Supabase is not connected");
    const button = e.target.querySelector("button[type='submit']");
    setLoading(button, "Logging in...");

    const email = normalizeEmail(document.getElementById("loginEmail").value);
    const passwordValue = document.getElementById("loginPassword").value;
    const { data, error } = await db.auth.signInWithPassword({ email, password: passwordValue });

    if (error) {
      clearLoading(button);
      toast(error.message);
      return;
    }

    await getSupabaseUser();
    toast("Logged in successfully");
    setTimeout(() => location.href = nextPage, 450);
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

  register?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!hasSupabase()) return toast("Supabase is not connected");
    if (password.value !== confirm.value) return toast("Passwords do not match");

    const button = e.target.querySelector("button[type='submit']");
    setLoading(button, "Creating account...");
    const name = document.getElementById("regName").value.trim();
    const email = normalizeEmail(document.getElementById("regEmail").value);
    const currency = document.getElementById("regCurrency").value;

    const { data, error } = await db.auth.signUp({
      email,
      password: password.value,
      options: {
        data: { name, currency }
      }
    });

    if (error) {
      clearLoading(button);
      toast(error.message);
      return;
    }

    if (!data.session) {
      document.querySelector(".success-pop").classList.add("show");
      document.querySelector(".success-pop").innerHTML = '<i class="fa-solid fa-envelope-circle-check"></i> Check your email to verify your account, then login.';
      toast("Verification email sent");
      clearLoading(button);
      return;
    }

    await db.from("profiles").upsert({
      id: data.user.id,
      name,
      email,
      currency,
      monthly_budget: 0,
      savings_goal: 0
    });
    await getSupabaseUser();
    document.querySelector(".success-pop").classList.add("show");
    toast("Account created");
    setTimeout(() => location.href = "dashboard.html", 700);
  });

  forgotPassword?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!hasSupabase()) return toast("Supabase is not connected");
    const button = e.target.querySelector("button[type='submit']");
    setLoading(button, "Sending...");
    const email = normalizeEmail(document.getElementById("forgotEmail").value);
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: resetRedirectUrl()
    });

    if (error) {
      clearLoading(button);
      toast(error.message);
      return;
    }

    document.getElementById("forgotSuccess")?.classList.add("show");
    toast("Reset link sent");
    clearLoading(button);
  });

  resetPassword?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!hasSupabase()) return toast("Supabase is not connected");
    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmNewPassword").value;
    if (newPassword.length < 8) return toast("Password must be at least 8 characters");
    if (newPassword !== confirmPassword) return toast("Passwords do not match");

    const button = e.target.querySelector("button[type='submit']");
    setLoading(button, "Updating...");
    const { error } = await db.auth.updateUser({ password: newPassword });

    if (error) {
      clearLoading(button);
      toast(error.message || "Open the reset link from your email first");
      return;
    }

    document.getElementById("resetSuccess")?.classList.add("show");
    toast("Password updated");
    await db.auth.signOut();
    setTimeout(() => location.href = "login.html", 900);
  });
});
