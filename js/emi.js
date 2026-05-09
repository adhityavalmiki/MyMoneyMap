function emiValue(p, annual, months) {
  if (p <= 0 || months <= 0) return 0;
  const r = annual / 12 / 100;
  if (r === 0) return p / months;
  return (p * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

function renderEmi() {
  const p = Number(document.getElementById("loanAmount").value);
  const rate = Number(document.getElementById("interestRate").value);
  const months = Number(document.getElementById("loanTenure").value);
  document.getElementById("loanAmountText").textContent = money(p);
  document.getElementById("interestRateText").textContent = `${rate}%`;
  document.getElementById("loanTenureText").textContent = `${months} months`;
  const emi = emiValue(p, rate, months);
  const total = emi * months;
  const interest = total - p;
  document.getElementById("monthlyEmi").textContent = money(emi);
  document.getElementById("totalRepayment").textContent = money(total);
  document.getElementById("interestPayable").textContent = money(interest);
  const body = document.getElementById("amortRows");
  let balance = p;
  const r = rate / 12 / 100;
  body.innerHTML = Array.from({ length: Math.min(months, 24) }, (_, i) => {
    const int = balance * r;
    const principal = emi - int;
    balance -= principal;
    return `<tr><td>${i + 1}</td><td>${money(emi)}</td><td>${money(principal)}</td><td>${money(int)}</td><td>${money(Math.max(balance, 0))}</td></tr>`;
  }).join("");
  if (window.emiChart) window.emiChart.destroy();
  window.emiChart = makeDoughnutChart("emiChart", ["Principal", "Interest"], [p, interest]);
}

document.addEventListener("DOMContentLoaded", () => {
  ["loanAmount", "interestRate", "loanTenure"].forEach(id => document.getElementById(id).addEventListener("input", renderEmi));
  renderEmi();
});
