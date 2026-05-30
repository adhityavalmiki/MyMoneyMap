let stocks = [];
let selectedInstrument = { asset_type: "Stock", description: "", livePrice: null, exchange: "" };
let searchTimer = null;
let portfolioChartInstance = null;
let activeSearchType = "All";
const quoteCache = new Map();

const commodityCandidates = [
  { symbol: "OANDA:XAU_USD", description: "Gold Spot / US Dollar", type: "Commodity", exchange: "OANDA" },
  { symbol: "OANDA:XAG_USD", description: "Silver Spot / US Dollar", type: "Commodity", exchange: "OANDA" },
  { symbol: "OANDA:XPT_USD", description: "Platinum Spot / US Dollar", type: "Commodity", exchange: "OANDA" },
  { symbol: "GLD", description: "SPDR Gold Shares ETF", type: "Commodity", exchange: "NYSE" },
  { symbol: "SLV", description: "iShares Silver Trust ETF", type: "Commodity", exchange: "NYSE" },
  { symbol: "USO", description: "United States Oil Fund ETF", type: "Commodity", exchange: "NYSE" },
  { symbol: "UNG", description: "United States Natural Gas Fund ETF", type: "Commodity", exchange: "NYSE" },
  { symbol: "DBC", description: "Invesco DB Commodity Index Tracking Fund", type: "Commodity", exchange: "NYSE" }
];

const indexCandidates = [
  { symbol: "^GSPC", description: "S&P 500 Index", type: "Index", exchange: "INDEX" },
  { symbol: "^DJI", description: "Dow Jones Industrial Average", type: "Index", exchange: "INDEX" },
  { symbol: "^IXIC", description: "Nasdaq Composite", type: "Index", exchange: "INDEX" },
  { symbol: "^NSEI", description: "Nifty 50 Index", type: "Index", exchange: "NSE" },
  { symbol: "^BSESN", description: "BSE Sensex Index", type: "Index", exchange: "BSE" }
];

const bondCandidates = [
  { symbol: "TLT", description: "iShares 20+ Year Treasury Bond ETF", type: "Bond", exchange: "NASDAQ" },
  { symbol: "IEF", description: "iShares 7-10 Year Treasury Bond ETF", type: "Bond", exchange: "NASDAQ" },
  { symbol: "BND", description: "Vanguard Total Bond Market ETF", type: "Bond", exchange: "NASDAQ" },
  { symbol: "AGG", description: "iShares Core U.S. Aggregate Bond ETF", type: "Bond", exchange: "NYSE" }
];

const economyCandidates = [
  { symbol: "US10Y", description: "United States 10Y Government Bond Yield", type: "Economy", exchange: "ECON" },
  { symbol: "DXY", description: "US Dollar Index", type: "Economy", exchange: "ICE" },
  { symbol: "VIX", description: "CBOE Volatility Index", type: "Economy", exchange: "CBOE" },
  { symbol: "CPI", description: "Consumer Price Index", type: "Economy", exchange: "ECON" }
];

function marketApiKey() {
  return localStorage.getItem("mmm-finnhub-key") || "d7u3hb9r01qvtsq0bel0d7u3hb9r01qvtsq0belg";
}

async function fetchLivePrice(symbol) {
  const cleanSymbol = symbol.trim().toUpperCase();
  if (!cleanSymbol) return null;
  const cached = quoteCache.get(cleanSymbol);
  if (cached && Date.now() - cached.time < 45000) return cached.price;

  const price = await fetchQuotePrice(cleanSymbol)
    || await fetchCandlePrice(cleanSymbol);
  if (price) quoteCache.set(cleanSymbol, { price, time: Date.now() });
  return price;
}

async function fetchQuotePrice(symbol) {
  try {
    const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${marketApiKey()}`);
    if (!response.ok) throw new Error("Quote request failed");
    const quote = await response.json();
    return Number(quote.c || quote.pc) || null;
  } catch (error) {
    console.error("Quote error:", error);
    return null;
  }
}

async function fetchCandlePrice(symbol) {
  const now = Math.floor(Date.now() / 1000);
  const from = now - 60 * 60 * 24 * 14;
  const endpoint = symbol.startsWith("BINANCE:") || symbol.startsWith("COINBASE:")
    ? "crypto/candle"
    : symbol.startsWith("OANDA:")
      ? "forex/candle"
      : "stock/candle";

  try {
    const response = await fetch(`https://finnhub.io/api/v1/${endpoint}?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${now}&token=${marketApiKey()}`);
    if (!response.ok) throw new Error("Candle request failed");
    const candle = await response.json();
    if (candle.s !== "ok" || !Array.isArray(candle.c) || !candle.c.length) return null;
    return Number(candle.c[candle.c.length - 1]) || null;
  } catch (error) {
    console.error("Candle price error:", error);
    return null;
  }
}

async function searchListed(query) {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];
  try {
    const response = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(cleanQuery)}&token=${marketApiKey()}`);
    if (!response.ok) throw new Error("Search request failed");
    const payload = await response.json();
    return payload.result || [];
  } catch (error) {
    console.error("Search error:", error);
    toast("Search failed");
    return [];
  }
}

async function fetchSymbolList(kind) {
  const endpoints = {
    Crypto: [
      "https://finnhub.io/api/v1/crypto/symbol?exchange=BINANCE",
      "https://finnhub.io/api/v1/crypto/symbol?exchange=COINBASE"
    ],
    Forex: ["https://finnhub.io/api/v1/forex/symbol?exchange=OANDA"]
  };
  const urls = endpoints[kind] || [];
  const lists = await Promise.all(urls.map(async (url) => {
    try {
      const response = await fetch(`${url}&token=${marketApiKey()}`);
      return response.ok ? await response.json() : [];
    } catch {
      return [];
    }
  }));
  return lists.flat();
}

async function searchCryptoForex(query, kind) {
  const clean = query.toLowerCase();
  const list = await fetchSymbolList(kind);
  return list
    .filter((item) => `${item.symbol || ""} ${item.description || ""} ${item.displaySymbol || ""}`.toLowerCase().includes(clean))
    .slice(0, 10)
    .map((item) => ({
      symbol: item.symbol,
      description: item.description || item.displaySymbol || item.symbol,
      type: kind,
      exchange: item.symbol?.split(":")[0] || kind
    }));
}

function searchStaticList(query, list) {
  const clean = query.toLowerCase();
  return list.filter((item) => `${item.symbol} ${item.description} ${item.exchange}`.toLowerCase().includes(clean));
}

function inferExchange(item) {
  if (item.exchange) return item.exchange;
  const symbol = item.symbol || "";
  const raw = `${item.type || ""} ${item.description || ""}`.toLowerCase();
  if (symbol.startsWith("BINANCE:")) return "BINANCE";
  if (symbol.startsWith("COINBASE:")) return "COINBASE";
  if (symbol.startsWith("OANDA:")) return "OANDA";
  if (symbol.endsWith(".NS")) return "NSE";
  if (symbol.endsWith(".BO")) return "BSE";
  if (symbol.startsWith("^")) return "INDEX";
  if (raw.includes("crypto")) return "CRYPTO";
  if (raw.includes("forex")) return "FX";
  return item.mic || "US";
}

function inferAssetType(item, selectedType) {
  if (selectedType !== "All") return selectedType;
  const raw = `${item.type || ""} ${item.description || ""}`.toLowerCase();
  if (raw.includes("crypto")) return "Crypto";
  if (raw.includes("forex") || item.symbol?.startsWith("OANDA:")) return raw.includes("xau") || raw.includes("gold") || raw.includes("silver") ? "Commodity" : "Forex";
  if (raw.includes("etf")) return "ETF";
  if (raw.includes("fund")) return "Fund";
  if (raw.includes("option")) return "Option";
  if (raw.includes("future")) return "Future";
  if (raw.includes("bond") || raw.includes("treasury")) return "Bond";
  if (raw.includes("index") || item.symbol?.startsWith("^")) return "Index";
  if (raw.includes("economy") || raw.includes("yield") || raw.includes("cpi")) return "Economy";
  if (raw.includes("commodity") || raw.includes("gold") || raw.includes("silver") || raw.includes("oil") || raw.includes("gas")) return "Commodity";
  return "Stock";
}

async function searchWithPrices(query) {
  const type = activeSearchType;
  const searches = [];
  if (["All", "Stock", "Fund", "Option", "Future"].includes(type)) searches.push(searchListed(query));
  if (["All", "Crypto"].includes(type)) searches.push(searchCryptoForex(query, "Crypto"));
  if (["All", "Forex"].includes(type)) searches.push(searchCryptoForex(query, "Forex"));
  if (["All", "Commodity"].includes(type)) searches.push(Promise.resolve(searchStaticList(query, commodityCandidates)));
  if (["All", "Index"].includes(type)) searches.push(Promise.resolve(searchStaticList(query, indexCandidates)));
  if (["All", "Bond"].includes(type)) searches.push(Promise.resolve(searchStaticList(query, bondCandidates)));
  if (["All", "Economy"].includes(type)) searches.push(Promise.resolve(searchStaticList(query, economyCandidates)));

  const seen = new Set();
  const raw = (await Promise.all(searches)).flat();
  const top = raw
    .filter((item) => item.symbol && !seen.has(item.symbol) && seen.add(item.symbol))
    .slice(0, 10)
    .map((item) => ({ ...item, inferredType: inferAssetType(item, type), exchange: inferExchange(item) }));

  const enriched = [];
  for (const item of top.slice(0, 6)) {
    enriched.push({ ...item, livePrice: await fetchLivePrice(item.symbol) });
  }
  return enriched;
}

function setPortfolioStatus(message) {
  const status = document.getElementById("portfolioStatus");
  if (status) status.textContent = message;
}

async function loadPortfolio() {
  if (!hasSupabase()) {
    stocks = getStore("mmm-stocks", seedStocks);
    renderPortfolio();
    return;
  }
  const { data, error } = await db.from("portfolio").select("*").order("created_at", { ascending: false });
  if (error) return toast(error.message);
  stocks = data || [];
  renderPortfolio();
}

function renderPortfolio() {
  const grid = document.getElementById("stockGrid");
  const body = document.getElementById("stockRows");
  const enriched = stocks.map((s) => {
    const qty = Number(s.quantity);
    const buy = Number(s.buy);
    const current = Number(s.current);
    const marketValue = qty * current;
    const cost = qty * buy;
    const pl = marketValue - cost;
    const returnPct = cost ? (pl / cost) * 100 : 0;
    return { ...s, qty, buy, current, marketValue, cost, pl, returnPct };
  });
  const total = enriched.reduce((sum, item) => sum + item.marketValue, 0);
  const invested = enriched.reduce((sum, item) => sum + item.cost, 0);
  const unrealized = total - invested;
  const plPercent = invested ? (unrealized / invested) * 100 : 0;
  const best = enriched.length ? [...enriched].sort((a, b) => b.returnPct - a.returnPct)[0] : null;
  const largest = enriched.length ? [...enriched].sort((a, b) => b.marketValue - a.marketValue)[0] : null;

  document.getElementById("portfolioValue").textContent = money(total);
  document.getElementById("investedValue").textContent = money(invested);
  document.getElementById("unrealizedPL").textContent = money(unrealized);
  document.getElementById("unrealizedPL").className = unrealized >= 0 ? "positive" : "negative";
  document.getElementById("holdingCount").textContent = stocks.length;
  document.getElementById("portfolioPL").textContent = `${plPercent.toFixed(2)}%`;
  document.getElementById("bestPerformer").textContent = best ? `${best.symbol} ${best.returnPct.toFixed(1)}%` : "None";
  document.getElementById("bestPerformer").className = best?.returnPct >= 0 ? "positive" : "negative";
  document.getElementById("largestAllocation").textContent = largest ? `${largest.symbol} ${total ? ((largest.marketValue / total) * 100).toFixed(1) : 0}%` : "None";

  grid.innerHTML = enriched.length ? enriched.map((item) => {
    const mode = item.investment_mode || "Lump Sum";
    const sipInfo = mode.includes("SIP") && item.sip_amount ? `${money(item.sip_amount)} ${item.sip_frequency || "Monthly"}` : "N/A";
    return `<div class="card stock-card">
      <div class="holding-card-header"><div><h3>${item.symbol}</h3><p>${item.description || item.asset_type || "Holding"}</p></div><span class="holding-badge">${item.exchange || item.asset_type || "MARKET"}</span></div>
      <h2>${money(item.marketValue)}</h2>
      <span class="${item.pl >= 0 ? "positive" : "negative"}">${item.pl >= 0 ? "+" : ""}${money(item.pl)} (${item.returnPct.toFixed(2)}%)</span>
      <div class="holding-stats"><span>Mode<br><strong>${mode}</strong></span><span>Qty<br><strong>${item.qty}</strong></span><span>Live<br><strong>${money(item.current)}</strong></span><span>SIP<br><strong>${sipInfo}</strong></span></div>
    </div>`;
  }).join("") : `<div class="card"><h3>No holdings yet</h3><p>Open search and add your first instrument.</p></div>`;

  body.innerHTML = enriched.length ? enriched.map((item) => {
    const mode = item.investment_mode || "Lump Sum";
    const sipInfo = mode.includes("SIP") && item.sip_amount ? `${money(item.sip_amount)} ${item.sip_frequency || "Monthly"}` : "";
    return `<tr><td>${item.asset_type || "Stock"}</td><td><strong>${item.symbol}</strong><br><small>${item.description || ""}</small></td><td>${item.exchange || "--"}</td><td><strong>${mode}</strong><br><small>${item.investment_date || ""} ${sipInfo}</small></td><td>${item.qty}</td><td>${money(item.buy)}</td><td>${money(item.current)}</td><td>${money(item.marketValue)}</td><td class="${item.pl >= 0 ? "positive" : "negative"}">${money(item.pl)}</td><td class="${item.returnPct >= 0 ? "positive" : "negative"}">${item.returnPct.toFixed(2)}%</td></tr>`;
  }).join("") : `<tr><td colspan="10">No portfolio data yet. Search and add a holding.</td></tr>`;

  if (portfolioChartInstance) portfolioChartInstance.destroy();
  portfolioChartInstance = makeDoughnutChart("portfolioChart", enriched.length ? enriched.map(s => s.symbol) : ["No holdings"], enriched.length ? enriched.map(s => s.marketValue) : [0]);
  renderAllocationList(enriched, total);
}

function renderAllocationList(enriched, total) {
  const wrap = document.getElementById("allocationList");
  if (!wrap) return;
  const byType = enriched.reduce((acc, item) => {
    const type = item.asset_type || "Stock";
    acc[type] = (acc[type] || 0) + item.marketValue;
    return acc;
  }, {});
  const rows = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  wrap.innerHTML = rows.length ? rows.map(([type, value]) => {
    const pct = total ? (value / total) * 100 : 0;
    return `<div class="allocation-row"><strong>${type}</strong><div class="allocation-bar"><span style="width:${pct}%"></span></div><span>${pct.toFixed(1)}%</span></div>`;
  }).join("") : `<p>No allocation yet. Add holdings to see portfolio mix.</p>`;
}

function updateInvestmentModeUI() {
  const mode = document.getElementById("investmentMode")?.value || "Lump Sum";
  const isSip = mode.includes("SIP");
  const isPrevious = mode.includes("Previous");
  const sipFields = document.getElementById("sipFields");
  const modeHelp = document.getElementById("modeHelp");
  const qty = document.getElementById("stockQty");
  const buy = document.getElementById("stockBuy");
  const date = document.getElementById("investmentDate");
  const sipAmount = document.getElementById("sipAmount");
  const sipFrequency = document.getElementById("sipFrequency");

  if (sipFields) sipFields.style.display = isSip ? "grid" : "none";
  if (qty) qty.placeholder = isSip ? "Total units accumulated" : "Quantity";
  if (buy) buy.placeholder = isSip ? "Average buy price / NAV" : "Purchase price";
  if (date) date.title = isSip ? "SIP start date" : "Investment date";
  if (sipAmount) sipAmount.required = isSip;
  if (sipFrequency) {
    sipFrequency.required = isSip;
    if (isSip && !sipFrequency.value) sipFrequency.value = "Monthly";
    if (!isSip) sipFrequency.value = "";
  }

  if (modeHelp) {
    modeHelp.textContent = isSip
      ? `${isPrevious ? "Previous SIP" : "SIP"}: enter total units accumulated so far, average buy/NAV, SIP amount, frequency, and start date.`
      : `${isPrevious ? "Previous lump sum" : "Lump sum"}: enter quantity, purchase price, and investment date. SIP fields are hidden.`;
  }
}

function renderInstrumentResults(results) {
  const wrap = document.getElementById("instrumentResults");
  if (!results.length) {
    wrap.innerHTML = `<div class="instrument-result"><span>No matches found. Try another symbol or name.</span></div>`;
    return;
  }

  wrap.innerHTML = results.map((item) => `
    <button class="instrument-result" type="button" data-symbol="${item.symbol}" data-description="${item.description || ""}" data-type="${item.inferredType || item.type || "Stock"}" data-price="${item.livePrice || ""}" data-exchange="${item.exchange || inferExchange(item)}">
      <span><strong>${item.symbol}</strong><small>${item.inferredType || item.type || "Instrument"} | ${item.description || "No description"}</small></span>
      <span><span class="${item.livePrice ? "positive" : "warning"}">${item.livePrice ? money(item.livePrice) : "Price unavailable"}</span><span class="exchange-chip">${item.exchange || inferExchange(item)}</span></span>
    </button>
  `).join("");

  wrap.querySelectorAll(".instrument-result").forEach((button) => {
    button.addEventListener("click", () => {
      selectedInstrument = {
        asset_type: button.dataset.type,
        description: button.dataset.description,
        livePrice: Number(button.dataset.price) || null,
        exchange: button.dataset.exchange
      };
      document.getElementById("stockSymbol").value = button.dataset.symbol;
      document.getElementById("stockName").value = button.dataset.description;
      document.getElementById("stockExchange").value = button.dataset.exchange;
      document.getElementById("stockAssetType").value = button.dataset.type;
      document.getElementById("ticketSymbol").textContent = button.dataset.symbol;
      document.getElementById("ticketExchange").textContent = button.dataset.exchange;
      document.getElementById("ticketType").textContent = button.dataset.type;
      document.getElementById("ticketPrice").textContent = selectedInstrument.livePrice ? money(selectedInstrument.livePrice) : "--";
      if (selectedInstrument.livePrice) document.getElementById("stockCurrent").value = selectedInstrument.livePrice;
      updateTradingTicket();
      setPortfolioStatus(`Selected ${button.dataset.symbol}${selectedInstrument.livePrice ? ` at ${money(selectedInstrument.livePrice)}` : ""}. Enter investment details and add holding.`);
      closeInstrumentSearch();
    });
  });
}

async function runInstrumentSearch() {
  const query = document.getElementById("instrumentSearch").value;
  const button = document.getElementById("searchInstrument");
  if (!query.trim()) {
    document.getElementById("instrumentResults").innerHTML = "";
    return;
  }
  if (button) {
    button.disabled = true;
    button.textContent = "Searching...";
  }
  setPortfolioStatus("Searching market data and loading live prices...");
  const results = await searchWithPrices(query);
  renderInstrumentResults(results);
  if (button) {
    button.disabled = false;
    button.innerHTML = '<i class="fa-solid fa-magnifying-glass-chart"></i>Search Now';
  }
  setPortfolioStatus(results.length ? "Live search results loaded. Select one to add it to your portfolio." : "No market matches found.");
}

function scheduleLiveSearch() {
  clearTimeout(searchTimer);
  const query = document.getElementById("instrumentSearch").value.trim();
  if (query.length < 2) {
    document.getElementById("instrumentResults").innerHTML = "";
    return;
  }
  document.getElementById("instrumentResults").innerHTML = `<div class="instrument-result"><span>Searching live market data...</span></div>`;
  searchTimer = setTimeout(runInstrumentSearch, 550);
}

function openInstrumentSearch() {
  document.getElementById("instrumentModal").classList.add("show");
  setTimeout(() => document.getElementById("instrumentSearch").focus(), 80);
}

function closeInstrumentSearch() {
  document.getElementById("instrumentModal").classList.remove("show");
}

function updateTradingTicket() {
  const symbol = document.getElementById("stockSymbol")?.value || "None";
  const exchange = document.getElementById("stockExchange")?.value || "--";
  const type = document.getElementById("stockAssetType")?.value || selectedInstrument.asset_type || "--";
  const manualPrice = Number(document.getElementById("stockCurrent")?.value || 0);
  const price = selectedInstrument.livePrice || manualPrice;
  document.getElementById("ticketSymbol").textContent = symbol || "None";
  document.getElementById("ticketExchange").textContent = exchange;
  document.getElementById("ticketType").textContent = type;
  document.getElementById("ticketPrice").textContent = price ? money(price) : "--";
}

async function refreshLivePrices() {
  if (!stocks.length) return toast("Add holdings before refreshing live prices");
  setPortfolioStatus("Fetching live prices...");
  for (const stock of stocks) {
    const livePrice = await fetchLivePrice(stock.symbol);
    if (!livePrice) continue;
    stock.current = livePrice;
    if (hasSupabase()) await db.from("portfolio").update({ current: livePrice }).eq("id", stock.id);
  }
  if (!hasSupabase()) setStore("mmm-stocks", stocks);
  await loadPortfolio();
  const time = new Date().toLocaleTimeString();
  setPortfolioStatus(`Live prices updated at ${time}.`);
  const last = document.getElementById("lastPriceUpdate");
  if (last) last.textContent = time;
  toast("Live prices refreshed");
}

async function saveStock(event) {
  event.preventDefault();
  const submitButton = event.target.querySelector("button");
  submitButton.disabled = true;
  submitButton.textContent = "Fetching live price...";

  const symbol = document.getElementById("stockSymbol").value.toUpperCase();
  const manualCurrent = Number(document.getElementById("stockCurrent").value);
  const buy = Number(document.getElementById("stockBuy").value);
  const livePrice = selectedInstrument.livePrice || await fetchLivePrice(symbol);
  const item = {
    symbol,
    description: document.getElementById("stockName").value || selectedInstrument.description || "",
    asset_type: document.getElementById("stockAssetType").value || selectedInstrument.asset_type || "Stock",
    exchange: document.getElementById("stockExchange").value || selectedInstrument.exchange || "",
    investment_mode: document.getElementById("investmentMode").value,
    investment_date: document.getElementById("investmentDate").value || new Date().toISOString().slice(0, 10),
    sip_amount: Number(document.getElementById("sipAmount").value || 0),
    sip_frequency: document.getElementById("sipFrequency").value,
    quantity: Number(document.getElementById("stockQty").value),
    buy,
    current: livePrice || manualCurrent || buy
  };

  if (hasSupabase()) {
    const { data: userData } = await db.auth.getUser();
    if (!userData.user) {
      submitButton.disabled = false;
      submitButton.textContent = "Add Holding";
      return toast("Please login again");
    }
    let { error } = await db.from("portfolio").insert({ ...item, user_id: userData.user.id });
    if (error && /asset_type|description|exchange|investment_mode|investment_date|sip_amount|sip_frequency/i.test(error.message)) {
      const fallback = { symbol: item.symbol, quantity: item.quantity, buy: item.buy, current: item.current, user_id: userData.user.id };
      const fallbackResponse = await db.from("portfolio").insert(fallback);
      error = fallbackResponse.error;
    }
    if (error) toast(error.message);
  } else {
    stocks.unshift({ ...item, id: crypto.randomUUID() });
    setStore("mmm-stocks", stocks);
  }

  event.target.reset();
  selectedInstrument = { asset_type: "Stock", description: "", livePrice: null, exchange: "" };
  document.getElementById("ticketSymbol").textContent = "None";
  document.getElementById("ticketExchange").textContent = "--";
  document.getElementById("ticketType").textContent = "--";
  document.getElementById("ticketPrice").textContent = "--";
  updateTradingTicket();
  updateInvestmentModeUI();
  await loadPortfolio();
  toast(livePrice ? "Holding added with live price" : "Holding added with fallback price");
  setPortfolioStatus(livePrice ? `Latest ${symbol} price loaded` : "Live quote unavailable. Used your entered or purchase price.");
  submitButton.disabled = false;
  submitButton.textContent = "Add Holding";
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("stockForm")?.addEventListener("submit", saveStock);
  document.getElementById("openInstrumentSearch")?.addEventListener("click", openInstrumentSearch);
  document.getElementById("closeInstrumentSearch")?.addEventListener("click", closeInstrumentSearch);
  document.getElementById("refreshPrices")?.addEventListener("click", refreshLivePrices);
  document.getElementById("instrumentSearch")?.addEventListener("input", scheduleLiveSearch);
  document.getElementById("instrumentSearch")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runInstrumentSearch();
    }
  });
  document.querySelectorAll(".market-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".market-tab").forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      activeSearchType = tab.dataset.type;
      if (document.getElementById("instrumentSearch").value.trim().length >= 2) scheduleLiveSearch();
    });
  });
  document.getElementById("investmentMode")?.addEventListener("change", updateInvestmentModeUI);
  ["stockSymbol", "stockExchange", "stockAssetType", "stockCurrent"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", updateTradingTicket);
  });
  updateTradingTicket();
  updateInvestmentModeUI();
  loadPortfolio();
  setInterval(() => {
    if (stocks.length) refreshLivePrices();
  }, 60000);
});
