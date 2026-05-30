let subscriptions = [];

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

document.addEventListener("DOMContentLoaded", () => {
  subscriptions = getStore("mmm-subscriptions", seedSubscriptions);
  document.getElementById("subForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    subscriptions.unshift({
      id: crypto.randomUUID(),
      name: document.getElementById("subName").value,
      amount: Number(document.getElementById("subAmount").value),
      date: document.getElementById("subDate").value,
      status: "Active"
    });
    setStore("mmm-subscriptions", subscriptions);
    e.target.reset();
    renderSubscriptions();
    toast("Subscription added");
  });
  renderSubscriptions();
});
