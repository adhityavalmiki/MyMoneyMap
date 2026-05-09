let stocks = [];
const FINNHUB_API_KEY = "d7u3hb9r01qvtsq0bel0d7u3hb9r01qvtsq0belg";

async function fetchLivePrice(symbol) {
  const cleanSymbol = symbol.trim().toUpperCase();
  if (!cleanSymbol) return null;

  try {
    const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(cleanSymbol)}&token=${FINNHUB_API_KEY}`);
    if (!response.ok) throw new Error("Quote request failed");
    const quote = await response.json();
    return Number(quote.c) || null;
  } catch (error) {
    console.error("Finnhub quote error:", error);
    return null;
  }
}

function setPortfolioStatus(message) {
  const status = document.getElementById("portfolioStatus");
  if (status) status.textContent = message;
}

function renderPortfolio() {
  const grid = document.getElementById("stockGrid");
  const body = document.getElementById("stockRows");
  const total = stocks.reduce((s, x) => s + x.quantity * x.current, 0);
  const invested = stocks.reduce((s, x) => s + x.quantity * x.buy, 0);
  document.getElementById("portfolioValue").textContent = money(total);
  const plPercent = invested ? ((total - invested) / invested) * 100 : 0;
  document.getElementById("portfolioPL").textContent = `${plPercent.toFixed(2)}%`;
  grid.innerHTML = stocks.length ? stocks.map(s => {
    const pl = (s.current - s.buy) * s.quantity;
    return `<div class="card stock-card"><h3>${s.symbol}</h3><p>${s.quantity} shares • Live ${money(s.current)}</p><h2>${money(s.quantity * s.current)}</h2><span class="${pl >= 0 ? "positive" : "negative"}">${pl >= 0 ? "+" : ""}${money(pl)}</span></div>`;
  }).join("") : `<div class="card"><h3>No stocks yet</h3><p>Add your first stock holding to calculate portfolio value and profit/loss.</p></div>`;
  body.innerHTML = stocks.length ? stocks.map(s => {
    const pl = (s.current - s.buy) * s.quantity;
    return `<tr><td><strong>${s.symbol}</strong></td><td>${s.quantity}</td><td>${money(s.buy)}</td><td>${money(s.current)}</td><td class="${pl >= 0 ? "positive" : "negative"}">${money(pl)}</td></tr>`;
  }).join("") : `<tr><td colspan="5">No portfolio data yet. Add stocks using the form above.</td></tr>`;
  makeDoughnutChart("portfolioChart", stocks.length ? stocks.map(s => s.symbol) : ["No holdings"], stocks.length ? stocks.map(s => s.quantity * s.current) : [0]);
}

async function refreshLivePrices() {
  if (!stocks.length) {
    toast("Add stocks before refreshing live prices");
    return;
  }

  setPortfolioStatus("Fetching live prices from Finnhub...");
  const updated = [];
  for (const stock of stocks) {
    const livePrice = await fetchLivePrice(stock.symbol);
    updated.push({ ...stock, current: livePrice || stock.current });
  }
  stocks = updated;
  setStore("mmm-stocks", stocks);
  renderPortfolio();
  setPortfolioStatus("Live prices updated with Finnhub");
  toast("Live stock prices refreshed");
}

document.addEventListener("DOMContentLoaded", () => {
  stocks = getStore("mmm-stocks", seedStocks);
  document.getElementById("stockForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const submitButton = e.target.querySelector("button");
    submitButton.disabled = true;
    submitButton.textContent = "Fetching live price...";

    const symbol = document.getElementById("stockSymbol").value.toUpperCase();
    const manualCurrent = Number(document.getElementById("stockCurrent").value);
    fetchLivePrice(symbol).then((livePrice) => {
      stocks.unshift({
      id: crypto.randomUUID(),
      symbol,
      quantity: Number(document.getElementById("stockQty").value),
      buy: Number(document.getElementById("stockBuy").value),
      current: livePrice || manualCurrent || Number(document.getElementById("stockBuy").value)
    });
    setStore("mmm-stocks", stocks);
    e.target.reset();
    renderPortfolio();
      toast(livePrice ? "Stock added with Finnhub live price" : "Stock added with fallback price");
      setPortfolioStatus(livePrice ? `Latest ${symbol} price loaded from Finnhub` : "Finnhub price unavailable. Used your entered or purchase price.");
    }).finally(() => {
      submitButton.disabled = false;
      submitButton.textContent = "Add Stock";
    });
  });
  document.getElementById("refreshPrices")?.addEventListener("click", refreshLivePrices);
  renderPortfolio();
});
