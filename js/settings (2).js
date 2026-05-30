function fillSettingsForm() {
  const settings = getSettings();
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

document.addEventListener("DOMContentLoaded", () => {
  fillSettingsForm();
  document.querySelectorAll("#settingsForm input, #settingsForm select, #monthlyBudget, #savingsGoal").forEach((field) => {
    field.addEventListener("input", updateSettingsPreview);
  });

  document.getElementById("settingsForm").addEventListener("submit", (event) => {
    event.preventDefault();
    setStore("mmm-settings", readSettingsForm());
    applyProfile();
    updateSettingsPreview();
    toast("Settings saved");
  });

  document.querySelectorAll(".switch input, #monthlyBudget, #savingsGoal").forEach((field) => {
    field.addEventListener("change", () => {
      setStore("mmm-settings", readSettingsForm());
      updateSettingsPreview();
    });
  });

  document.getElementById("downloadSettings").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(getSettings(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mymoneymap-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("resetAllData").addEventListener("click", () => {
    if (!confirm("Reset all MyMoneyMap data on this browser?")) return;
    ["mmm-transactions", "mmm-stocks", "mmm-subscriptions", "mmm-settings"].forEach((key) => localStorage.removeItem(key));
    toast("All local data reset");
    setTimeout(() => location.href = "dashboard.html", 700);
  });
});
