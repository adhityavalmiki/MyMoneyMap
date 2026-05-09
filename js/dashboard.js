document.addEventListener("DOMContentLoaded", () => {
  const tx = getStore("mmm-transactions", seedTransactions);
  const income = tx.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expenses = tx.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const savings = income - expenses;

  const values = { balance: savings, income, expenses, savings };
  Object.entries(values).forEach(([key, value]) => {
    const el = document.querySelector(`[data-value="${key}"]`);
    if (el) el.textContent = money(value);
  });

  const monthlyIncome = Array(6).fill(0);
  const monthlyExpenses = Array(6).fill(0);
  tx.forEach((item) => {
    const monthIndex = new Date(item.date).getMonth();
    if (monthIndex >= 0 && monthIndex < 6) {
      if (item.type === "income") monthlyIncome[monthIndex] += Number(item.amount);
      if (item.type === "expense") monthlyExpenses[monthIndex] += Number(item.amount);
    }
  });

  const categoryTotals = ["Rent", "Food", "Shopping", "Bills", "Transport"].map((category) =>
    tx.filter((item) => item.type === "expense" && item.category === category).reduce((sum, item) => sum + Number(item.amount), 0)
  );
  const weeklyTotals = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((_, index) =>
    tx.filter((item) => item.type === "expense" && ((new Date(item.date).getDay() + 6) % 7) === index).reduce((sum, item) => sum + Number(item.amount), 0)
  );

  makeLineChart("incomeExpenseChart", ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], monthlyIncome, monthlyExpenses);
  makeDoughnutChart("categoryChart", ["Rent", "Food", "Shopping", "Bills", "Transport"], categoryTotals);
  makeBarChart("weeklyChart", ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], weeklyTotals);
  makeDoughnutChart("savingsChart", ["Savings", "Expenses"], [Math.max(savings, 0), expenses]);

  const recent = document.getElementById("recentTransactions");
  if (recent) {
    recent.innerHTML = tx.length ? tx.slice(0, 5).map(t => `
      <div class="mini-row">
        <span><strong>${t.title}</strong><br><small>${t.category} • ${t.date}</small></span>
        <span class="${t.type === "income" ? "positive" : "negative"}">${t.type === "income" ? "+" : "-"}${money(t.amount)}</span>
      </div>
    `).join("") : `<div class="mini-row"><span>No transactions yet. Add your first income or expense.</span></div>`;
  }
});
