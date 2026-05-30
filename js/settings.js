let loadedProfile = null;

async function loadSettingsProfile() {
  if (!hasSupabase()) return getSettings();
  const { data: userData } = await db.auth.getUser();
  if (!userData.user) return getSettings();

  const { data, error } = await db.from("profiles").select("*").eq("id", userData.user.id).maybeSingle();
  if (error) toast(error.message);

  loadedProfile = data || {
    id: userData.user.id,
    name: userData.user.user_metadata?.name || userData.user.email?.split("@")[0] || "User",
    email: userData.user.email,
    currency: userData.user.user_metadata?.currency || "INR",
    monthly_budget: 0,
    savings_goal: 0
  };
  localStorage.setItem("mmm-profile-cache", JSON.stringify({
    id: userData.user.id,
    name: loadedProfile.name,
    email: loadedProfile.email,
    currency: loadedProfile.currency,
    monthlyBudget: loadedProfile.monthly_budget || 0,
    savingsGoal: loadedProfile.savings_goal || 0
  }));
  return {
    ...defaultSettings,
    name: loadedProfile.name,
    email: loadedProfile.email,
    currency: loadedProfile.currency,
    monthlyBudget: loadedProfile.monthly_budget || 0,
    savingsGoal: loadedProfile.savings_goal || 0
  };
}

async function fillSettingsForm() {
  const settings = await loadSettingsProfile();
  document.getElementById("settingName").value = settings.name;
  document.getElementById("settingEmail").value = settings.email;
  document.getElementById("settingCurrency").value = settings.currency;
  document.getElementById("monthlyBudget").value = settings.monthlyBudget || "";
  document.getElementById("savingsGoal").value = settings.savingsGoal || "";
  document.getElementById("notifyBudget").checked = settings.notifications.budget;
  document.getElementById("notifySubscriptions").checked = settings.notifications.subscriptions;
  document.getElementById("notifyPortfolio").checked = settings.notifications.portfolio;
  document.getElementById("notifyWeekly").checked = settings.notifications.weekly;
  updateSettingsPreview();
}

function readSettingsForm() {
  const current = getSettings();
  return {
    ...current,
    name: document.getElementById("settingName").value.trim(),
    email: document.getElementById("settingEmail").value.trim(),
    currency: document.getElementById("settingCurrency").value,
    monthlyBudget: Number(document.getElementById("monthlyBudget").value || 0),
    savingsGoal: Number(document.getElementById("savingsGoal").value || 0),
    notifications: {
      budget: document.getElementById("notifyBudget").checked,
      subscriptions: document.getElementById("notifySubscriptions").checked,
      portfolio: document.getElementById("notifyPortfolio").checked,
      weekly: document.getElementById("notifyWeekly").checked
    }
  };
}

function updateSettingsPreview() {
  const settings = readSettingsForm();
  const initial = settings.name[0]?.toUpperCase() || "U";
  document.querySelector("[data-settings-initial]").textContent = initial;
  document.getElementById("budgetPreview").textContent = `Budget: ${formatMoney(settings.monthlyBudget, settings.currency)}`;
  document.getElementById("goalPreview").textContent = `Goal: ${formatMoney(settings.savingsGoal, settings.currency)}`;
}

async function saveProfile() {
  const settings = readSettingsForm();
  if (hasSupabase()) {
    const { data: userData } = await db.auth.getUser();
    if (!userData.user) return toast("Please login again");
    const { error } = await db.from("profiles").upsert({
      id: userData.user.id,
      name: settings.name,
      email: userData.user.email,
      currency: settings.currency,
      monthly_budget: settings.monthlyBudget,
      savings_goal: settings.savingsGoal
    });
    if (error) return toast(error.message);
    localStorage.setItem("mmm-profile-cache", JSON.stringify({
      id: userData.user.id,
      name: settings.name,
      email: userData.user.email,
      currency: settings.currency,
      monthlyBudget: settings.monthlyBudget,
      savingsGoal: settings.savingsGoal
    }));
  } else {
    setStore("mmm-settings", settings);
  }
  applyProfile();
  updateSettingsPreview();
  toast("Settings saved");
}

document.addEventListener("DOMContentLoaded", async () => {
  const apiKeyInput = document.getElementById("finnhubKey");
  const saveKeyBtn = document.getElementById("saveApiKey");
  if (apiKeyInput) apiKeyInput.value = localStorage.getItem("mmm-finnhub-key") || "d7u3hb9r01qvtsq0bel0d7u3hb9r01qvtsq0belg";
  if (saveKeyBtn) {
    saveKeyBtn.addEventListener("click", () => {
      localStorage.setItem("mmm-finnhub-key", apiKeyInput.value.trim());
      toast("Finnhub API key saved");
    });
  }

  await fillSettingsForm();
  document.querySelectorAll("#settingsForm input, #settingsForm select, #monthlyBudget, #savingsGoal").forEach((field) => {
    field.addEventListener("input", updateSettingsPreview);
  });

  document.getElementById("settingsForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveProfile();
  });

  document.querySelectorAll(".switch input, #monthlyBudget, #savingsGoal").forEach((field) => {
    field.addEventListener("change", saveProfile);
  });

  document.getElementById("downloadSettings").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(readSettingsForm(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mymoneymap-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    if (hasSupabase()) await db.auth.signOut();
    localStorage.removeItem("mmm-profile-cache");
    toast("Logged out");
    setTimeout(() => location.href = "login.html", 500);
  });

  document.getElementById("resetAllData").addEventListener("click", async () => {
    if (!confirm("Reset all MyMoneyMap data for this logged-in user?")) return;
    if (hasSupabase()) {
      await db.from("transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await db.from("subscriptions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await db.from("portfolio").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    } else {
      ["mmm-transactions", "mmm-stocks", "mmm-subscriptions", "mmm-settings"].forEach((key) => localStorage.removeItem(storageKey(key)));
    }
    toast("Your data was reset");
    setTimeout(() => location.href = "dashboard.html", 700);
  });
});
