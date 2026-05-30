let subscriptions = [];

async function loadSubscriptions() {
  if (!hasSupabase()) {
    subscriptions = getStore("mmm-subscriptions", seedSubscriptions);
    renderSubscriptions();
    return;
  }
  const { data, error } = await db.from("subscriptions").select("*").order("date", { ascending: true });
  if (error) return toast(error.message);
  subscriptions = data || [];
  renderSubscriptions();
}

function renderSubscriptions() {
  const grid = document.getElementById("subGrid");
  const total = subscriptions.reduce((s, x) => s + Number(x.amount), 0);
  document.getElementById("monthlySubs").textContent = money(total);
  document.getElementById("yearlySubs").textContent = money(total * 12);
  document.getElementById("subCount").textContent = subscriptions.length;
  const warning = document.getElementById("subWarning");
  if (warning) warning.textContent = total > 0 ? "Review recurring expenses regularly." : "No recurring subscription cost yet.";
  grid.innerHTML = subscriptions.length ? subscriptions.map(s => `<div class="card sub-card"><h3>${s.name}</h3><p>Next billing: ${s.date}</p><h2>${money(s.amount)}/mo</h2><span>${s.status}</span></div>`).join("") : `<div class="card"><h3>No subscriptions yet</h3><p>Add Netflix, Spotify, gym, tools, or any recurring payment you use.</p></div>`;
}

async function saveSubscription(event) {
  event.preventDefault();
  const item = {
    name: document.getElementById("subName").value,
    amount: Number(document.getElementById("subAmount").value),
    date: document.getElementById("subDate").value,
    status: "Active"
  };

  if (hasSupabase()) {
    const { data: userData } = await db.auth.getUser();
    if (!userData.user) return toast("Please login again");
    const { error } = await db.from("subscriptions").insert({ ...item, user_id: userData.user.id });
    if (error) return toast(error.message);
    await loadSubscriptions();
  } else {
    subscriptions.unshift({ ...item, id: crypto.randomUUID() });
    setStore("mmm-subscriptions", subscriptions);
    renderSubscriptions();
  }

  event.target.reset();
  toast("Subscription added");
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("subForm")?.addEventListener("submit", saveSubscription);
  loadSubscriptions();
});
