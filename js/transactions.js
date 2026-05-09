let transactions = [];
let editingId = null;

function renderTransactions() {
  const body = document.getElementById("transactionRows");
  if (!body) return;
  const search = document.getElementById("txSearch").value.toLowerCase();
  const category = document.getElementById("txCategory").value;
  const sort = document.getElementById("txSort").value;
  let rows = [...transactions].filter(t => t.title.toLowerCase().includes(search) && (category === "All" || t.category === category));
  rows.sort((a, b) => sort === "new" ? new Date(b.date) - new Date(a.date) : new Date(a.date) - new Date(b.date));
  body.innerHTML = rows.length ? rows.map(t => `
    <tr>
      <td><strong>${t.title}</strong></td>
      <td>${t.category}</td>
      <td><span class="tag ${t.type}">${t.type}</span></td>
      <td>${t.date}</td>
      <td class="${t.type === "income" ? "positive" : "negative"}">${t.type === "income" ? "+" : "-"}${money(t.amount)}</td>
      <td>
        <button class="icon-btn" onclick="editTransaction('${t.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="icon-btn" onclick="deleteTransaction('${t.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join("") : `<tr><td colspan="6">No transactions yet. Click Add Transaction to enter your own income or expense.</td></tr>`;
  document.getElementById("txCount").textContent = rows.length;
}

function openTransactionModal() {
  editingId = null;
  document.getElementById("txForm").reset();
  document.getElementById("txId").value = "";
  document.getElementById("txModalTitle").textContent = "Add Transaction";
  document.getElementById("txModal").classList.add("show");
}

function closeTransactionModal() { document.getElementById("txModal").classList.remove("show"); }

function editTransaction(id) {
  const item = transactions.find(t => t.id === id);
  if (!item) return;
  editingId = id;
  ["title", "amount", "category", "type", "date"].forEach(key => document.getElementById(`tx-${key}`).value = item[key]);
  document.getElementById("txModalTitle").textContent = "Edit Transaction";
  document.getElementById("txModal").classList.add("show");
}

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  setStore("mmm-transactions", transactions);
  renderTransactions();
  toast("Transaction deleted");
}

document.addEventListener("DOMContentLoaded", () => {
  transactions = getStore("mmm-transactions", seedTransactions);
  ["txSearch", "txCategory", "txSort"].forEach(id => document.getElementById(id)?.addEventListener("input", renderTransactions));
  document.getElementById("addTxBtn")?.addEventListener("click", openTransactionModal);
  document.getElementById("closeTxModal")?.addEventListener("click", closeTransactionModal);
  document.getElementById("exportCsv")?.addEventListener("click", () => exportCSV(transactions));
  document.getElementById("txForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const item = {
      id: editingId || crypto.randomUUID(),
      title: document.getElementById("tx-title").value,
      amount: Number(document.getElementById("tx-amount").value),
      category: document.getElementById("tx-category").value,
      type: document.getElementById("tx-type").value,
      date: document.getElementById("tx-date").value
    };
    transactions = editingId ? transactions.map(t => t.id === editingId ? item : t) : [item, ...transactions];
    setStore("mmm-transactions", transactions);
    closeTransactionModal();
    renderTransactions();
    toast(editingId ? "Transaction updated" : "Transaction added");
  });
  renderTransactions();
});
