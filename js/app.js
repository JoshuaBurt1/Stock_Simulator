/* ==========================================================================
   Global State & Local Storage Keys
   ========================================================================== */
const CASH_KEY = "sim_cash_balance";
const HOLDINGS_KEY = "sim_holdings";

let cash = parseFloat(localStorage.getItem(CASH_KEY)) || 100000.0;
let holdings = JSON.parse(localStorage.getItem(HOLDINGS_KEY)) || {};

let rawTopTickers = [];
let selectedSymbols = new Set();
let chartMap = new Map();
let cardCounter = 0;

// Date Setup
const currentDate = new Date();
function formatDateToYearMonthDay(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}
const formattedDate = formatDateToYearMonthDay(currentDate);

const targetDate = new Date();
targetDate.setDate(targetDate.getDate() - 2);
const snapshotDateStr = formatDateToYearMonthDay(targetDate);

/* ==========================================================================
   DOM Element References
   ========================================================================== */
const cashBalanceEl = document.getElementById("cashBalance");
const portfolioValueEl = document.getElementById("portfolioValue");
const netWorthEl = document.getElementById("netWorth");
const holdingsTableBody = document.getElementById("holdingsTableBody");
const tradeForm = document.getElementById("tradeForm");
const simTickerInput = document.getElementById("simTicker");
const simDateInput = document.getElementById("simDate");
const tradeStatus = document.getElementById("tradeStatus");
const resetSimBtn = document.getElementById("resetSimBtn");

const stockSearchInput = document.getElementById("stockSearchInput");
const addStockBtn = document.getElementById("addStockBtn");
const clearBtn = document.getElementById("clear");
const stockSelect2 = document.querySelector("#stockSelect2");
const resultsContainer = document.getElementById("resultsContainer");

/* ==========================================================================
   1. SIMULATOR LOGIC
   ========================================================================== */
function saveSimulatorState() {
  localStorage.setItem(CASH_KEY, cash.toString());
  localStorage.setItem(HOLDINGS_KEY, JSON.stringify(holdings));
}

/**
 * Fetches the latest available close price for a ticker.
 */
async function getLatestPrice(symbol) {
  try {
    const res = await fetch(`https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${API_KEY}`);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      return data.results[0].c;
    }
  } catch (err) {
    console.error(`Failed to fetch current price for ${symbol}:`, err);
  }
  return null;
}

/**
 * Updates UI metrics dynamically by fetching real-time/latest close prices
 * for all portfolio holdings.
 */
async function updateSimulatorUI() {
  cashBalanceEl.textContent = `$${cash.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  const symbols = Object.keys(holdings);

  if (symbols.length === 0) {
    holdingsTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-500">No stock holdings in portfolio.</td></tr>`;
    portfolioValueEl.textContent = "$0.00";
    netWorthEl.textContent = `$${cash.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return;
  }

  // Fetch current market prices for all portfolio items concurrently
  await Promise.all(
    symbols.map(async (symbol) => {
      const currentPrice = await getLatestPrice(symbol);
      if (currentPrice !== null) {
        holdings[symbol].lastPrice = currentPrice;
      }
    })
  );

  let totalPortfolioVal = 0;
  holdingsTableBody.innerHTML = "";

  symbols.forEach((symbol) => {
    const data = holdings[symbol];
    const currentPrice = data.lastPrice || data.avgCost;
    const val = data.shares * currentPrice;
    totalPortfolioVal += val;

    const tr = document.createElement("tr");
    tr.className = "border-b border-slate-700/60 hover:bg-slate-700/30";
    tr.innerHTML = `
      <td class="p-3 font-bold text-white">${symbol}</td>
      <td class="p-3">${data.shares}</td>
      <td class="p-3">$${data.avgCost.toFixed(2)}</td>
      <td class="p-3 text-indigo-400">$${currentPrice.toFixed(2)}</td>
      <td class="p-3 text-emerald-400">$${val.toFixed(2)}</td>
    `;
    holdingsTableBody.appendChild(tr);
  });

  portfolioValueEl.textContent = `$${totalPortfolioVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const netWorth = cash + totalPortfolioVal;
  netWorthEl.textContent = `$${netWorth.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  saveSimulatorState();
}

tradeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const symbol = simTickerInput.value.trim().toUpperCase();
  const shares = parseInt(document.getElementById("simShares").value, 10);
  const action = document.getElementById("simAction").value;
  const simDate = simDateInput.value;

  if (!symbol || isNaN(shares) || shares <= 0) return;

  const dateLabel = simDate ? `for ${simDate}` : "latest price";
  tradeStatus.textContent = `Fetching price for ${symbol} (${dateLabel})...`;
  tradeStatus.className = "text-xs text-amber-400 min-h-[16px]";

  try {
    let apiUrl = `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${API_KEY}`;
    if (simDate) {
      apiUrl = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${simDate}/${simDate}?adjusted=true&apiKey=${API_KEY}`;
    }

    const res = await fetch(apiUrl);
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      tradeStatus.textContent = `Error: No trading data found for ${symbol} on ${simDate || "latest date"} (market may be closed).`;
      tradeStatus.className = "text-xs text-red-400 min-h-[16px]";
      return;
    }

    const executionPrice = data.results[0].c;
    const totalCost = executionPrice * shares;
    const executedDateStr = simDate || new Date(data.results[0].t).toISOString().split("T")[0];

    if (action === "BUY") {
      if (cash < totalCost) {
        tradeStatus.textContent = `Insufficient cash! Required: $${totalCost.toFixed(2)}, Available: $${cash.toFixed(2)}`;
        tradeStatus.className = "text-xs text-red-400 min-h-[16px]";
        return;
      }

      cash -= totalCost;
      if (holdings[symbol]) {
        const totalShares = holdings[symbol].shares + shares;
        const totalSpent = holdings[symbol].shares * holdings[symbol].avgCost + totalCost;
        holdings[symbol].shares = totalShares;
        holdings[symbol].avgCost = totalSpent / totalShares;
      } else {
        holdings[symbol] = { shares, avgCost: executionPrice };
      }

      tradeStatus.textContent = `Bought ${shares} shares of ${symbol} at historical price of $${executionPrice.toFixed(2)} on ${executedDateStr}.`;
      tradeStatus.className = "text-xs text-emerald-400 min-h-[16px]";
    } else if (action === "SELL") {
      if (!holdings[symbol] || holdings[symbol].shares < shares) {
        tradeStatus.textContent = `Cannot sell: You do not own ${shares} shares of ${symbol}.`;
        tradeStatus.className = "text-xs text-red-400 min-h-[16px]";
        return;
      }

      cash += totalCost;
      holdings[symbol].shares -= shares;

      if (holdings[symbol].shares === 0) {
        delete holdings[symbol];
      }

      tradeStatus.textContent = `Sold ${shares} shares of ${symbol} at historical price of $${executionPrice.toFixed(2)} on ${executedDateStr}.`;
      tradeStatus.className = "text-xs text-emerald-400 min-h-[16px]";
    }

    saveSimulatorState();
    await updateSimulatorUI();
    tradeForm.reset();
  } catch (err) {
    tradeStatus.textContent = "API error executing order. Check API key.";
    tradeStatus.className = "text-xs text-red-400 min-h-[16px]";
    console.error(err);
  }
});

resetSimBtn.addEventListener("click", async () => {
  if (confirm("Reset simulator back to $100,000 starting cash?")) {
    cash = 100000.0;
    holdings = {};
    saveSimulatorState();
    await updateSimulatorUI();
    tradeStatus.textContent = "Simulator reset successfully.";
    tradeStatus.className = "text-xs text-slate-400 min-h-[16px]";
  }
});

/* ==========================================================================
   2. STOCK MARKET SNAPSHOT & EXPLORER
   ========================================================================== */
const apiUrlSP = `https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/${snapshotDateStr}?adjusted=true&apiKey=${API_KEY}`;

fetch(apiUrlSP)
  .then((res) => {
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  })
  .then((data) => {
    if (!data.results || data.results.length === 0) {
      stockSelect2.innerHTML = `<option disabled class="p-2 text-slate-400">No market snapshot available for ${snapshotDateStr}</option>`;
      return;
    }

    rawTopTickers = data.results
      .filter((item) => item.T && item.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, 1000);

    renderSelectOptions(rawTopTickers);
  })
  .catch((err) => {
    console.error("Market data fetch error:", err);
    stockSelect2.innerHTML = `<option disabled class="p-2 text-red-400">Error loading tickers (Check API Key)</option>`;
  });

function renderSelectOptions(tickers, filterQuery = "") {
  stockSelect2.innerHTML = "";
  let matchedCount = 0;

  tickers.forEach((item) => {
    const isMatch = filterQuery && item.T.startsWith(filterQuery.toUpperCase());
    if (filterQuery && !item.T.includes(filterQuery.toUpperCase())) return;

    const option = document.createElement("option");
    option.value = item.T;
    option.id = item.T;
    option.className = "p-2 rounded mb-0.5 hover:bg-indigo-600 hover:text-white checked:bg-indigo-600 checked:text-white cursor-pointer";

    const formattedVol = item.v >= 1_000_000
      ? `${(item.v / 1_000_000).toFixed(2)}M`
      : item.v.toLocaleString();

    option.textContent = `${item.T} — Vol: ${formattedVol}`;

    if (isMatch && matchedCount === 0) {
      option.selected = true;
      matchedCount++;
    }

    stockSelect2.appendChild(option);
  });

  if (filterQuery && stockSelect2.options.length === 0) {
    stockSelect2.innerHTML = `<option disabled class="p-2 text-slate-400">No active ticker matching "${filterQuery.toUpperCase()}"</option>`;
  }
}

stockSearchInput.addEventListener("input", (e) => {
  renderSelectOptions(rawTopTickers, e.target.value.trim());
});

stockSelect2.addEventListener("change", () => {
  if (stockSelect2.value) {
    stockSearchInput.value = stockSelect2.value;
  }
});

addStockBtn.addEventListener("click", () => submitAddStock());
stockSearchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitAddStock();
});

function submitAddStock() {
  const query = stockSearchInput.value.trim().toUpperCase() || stockSelect2.value;
  if (!query) return;

  if (selectedSymbols.has(query)) {
    const existingCard = document.querySelector(`[data-symbol="${query}"]`);
    if (existingCard) {
      existingCard.scrollIntoView({ behavior: "smooth", block: "center" });
      existingCard.classList.add("ring-2", "ring-indigo-500");
      setTimeout(() => existingCard.classList.remove("ring-2", "ring-indigo-500"), 1500);
    }
    return;
  }

  addStockCard(query);
  stockSearchInput.value = "";
  renderSelectOptions(rawTopTickers);
}

clearBtn.addEventListener("click", () => {
  resultsContainer.innerHTML = "";
  chartMap.forEach((entry) => {
    if (entry.chart) entry.chart.destroy();
  });
  chartMap.clear();
  selectedSymbols.clear();
});

function filterResultsByPeriod(results, period) {
  if (!results || results.length === 0) return [];

  const latestTimestamp = results[results.length - 1].t;
  const latestDate = new Date(latestTimestamp);
  let startDate = new Date(latestDate);

  switch (period) {
    case "24H": startDate.setDate(latestDate.getDate() - 1); break;
    case "7D":  startDate.setDate(latestDate.getDate() - 7); break;
    case "1M":  startDate.setMonth(latestDate.getMonth() - 1); break;
    case "3M":  startDate.setMonth(latestDate.getMonth() - 3); break;
    case "YTD": startDate = new Date(latestDate.getFullYear(), 0, 1); break;
    case "1Y":  startDate.setFullYear(latestDate.getFullYear() - 1); break;
    case "Max": return results;
    default:    return results;
  }

  const startTime = startDate.getTime();
  return results.filter((r) => r.t >= startTime);
}

/* ==========================================================================
   3. DYNAMIC CHART CARD CREATION
   ========================================================================== */
function addStockCard(symbol) {
  selectedSymbols.add(symbol);
  const cardId = `card-${cardCounter++}`;

  const stockCard = document.createElement("div");
  stockCard.className = "bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl flex flex-col gap-5 relative transition-all duration-300";
  stockCard.id = cardId;
  stockCard.dataset.symbol = symbol;

  // Card Header
  const cardHeader = document.createElement("div");
  cardHeader.className = "flex flex-wrap justify-between items-center gap-4 border-b border-slate-700 pb-3";

  const headerLeft = document.createElement("div");
  headerLeft.className = "flex items-center gap-3";

  const stockNameHeading = document.createElement("h2");
  stockNameHeading.className = "text-2xl font-bold text-white tracking-wide";
  stockNameHeading.textContent = symbol;

  // "Trade This Stock" Quick Action Button
  const tradeShortcutBtn = document.createElement("button");
  tradeShortcutBtn.className = "px-3 py-1 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 rounded-lg text-xs font-semibold transition-all cursor-pointer";
  tradeShortcutBtn.textContent = "Trade Ticker";
  tradeShortcutBtn.addEventListener("click", () => {
    simTickerInput.value = symbol;
    tradeForm.scrollIntoView({ behavior: "smooth", block: "center" });
    simTickerInput.focus();
  });

  headerLeft.appendChild(stockNameHeading);
  headerLeft.appendChild(tradeShortcutBtn);

  const headerRight = document.createElement("div");
  headerRight.className = "flex items-center gap-4 flex-wrap";

  // Time Frame Selector
  const timeSelector = document.createElement("div");
  timeSelector.className = "inline-flex items-center bg-slate-900 border border-slate-700 rounded-full p-1 gap-1";

  const periods = ["24H", "7D", "1M", "3M", "YTD", "1Y", "Max"];
  const defaultPeriod = "1Y";

  periods.forEach((period) => {
    const btn = document.createElement("button");
    const isActive = period === defaultPeriod;
    btn.className = `time-btn text-xs font-semibold px-3 py-1.5 rounded-full transition-all cursor-pointer ${
      isActive ? "bg-white text-indigo-600 shadow" : "bg-transparent text-slate-400 hover:text-slate-100"
    }`;
    btn.textContent = period;
    btn.dataset.period = period;
    timeSelector.appendChild(btn);
  });

  // Delete Card Button
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "p-2 text-slate-400 hover:text-white bg-transparent hover:bg-red-600 rounded-lg transition-all flex items-center justify-center cursor-pointer";
  deleteBtn.title = "Remove Chart";
  deleteBtn.innerHTML = `
    <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
  `;

  deleteBtn.addEventListener("click", () => {
    selectedSymbols.delete(symbol);
    if (chartMap.has(cardId)) {
      const entry = chartMap.get(cardId);
      if (entry.chart) entry.chart.destroy();
      chartMap.delete(cardId);
    }
    stockCard.remove();
  });

  headerRight.appendChild(timeSelector);
  headerRight.appendChild(deleteBtn);

  cardHeader.appendChild(headerLeft);
  cardHeader.appendChild(headerRight);

  // Body Layout (Grid)
  const cardBody = document.createElement("div");
  cardBody.className = "grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-6";

  // Table Wrapper
  const tableWrapper = document.createElement("div");
  tableWrapper.className = "max-h-[380px] overflow-y-auto border border-slate-700 rounded-lg bg-slate-900";

  const table = document.createElement("table");
  table.className = "w-full text-left text-xs md:text-sm border-collapse";

  const thead = document.createElement("thead");
  thead.className = "sticky top-0 bg-slate-800 text-slate-400 font-semibold uppercase text-[11px] tracking-wider z-10 border-b border-slate-700";

  const tr = document.createElement("tr");
  ["Date", "Open", "Close", "High", "Low"].forEach((text) => {
    const th = document.createElement("th");
    th.className = "px-4 py-3";
    th.textContent = text;
    tr.appendChild(th);
  });
  thead.appendChild(tr);

  const tbody = document.createElement("tbody");
  table.appendChild(thead);
  table.appendChild(tbody);
  tableWrapper.appendChild(table);

  // Chart Canvas Wrapper
  const chartWrapper = document.createElement("div");
  chartWrapper.className = "relative h-[380px] w-full bg-slate-900 border border-slate-700 rounded-lg p-4";

  const canvas = document.createElement("canvas");
  chartWrapper.appendChild(canvas);

  cardBody.appendChild(tableWrapper);
  cardBody.appendChild(chartWrapper);

  stockCard.appendChild(cardHeader);
  stockCard.appendChild(cardBody);

  resultsContainer.appendChild(stockCard);

  chartMap.set(cardId, { chart: null, cardElement: stockCard });

  // Fetch Historical Price Data
  const apiUrl = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/2020-01-01/${formattedDate}?apiKey=${API_KEY}`;

  fetch(apiUrl)
    .then((res) => res.json())
    .then((data) => {
      if (!data.results || data.results.length === 0) {
        stockNameHeading.textContent = `${symbol} (No data available)`;
        return;
      }

      const rawResults = data.results;
      const ctx = canvas.getContext("2d");

      const gradient = ctx.createLinearGradient(0, 0, 0, 300);
      gradient.addColorStop(0, "rgba(99, 102, 241, 0.4)");
      gradient.addColorStop(1, "rgba(99, 102, 241, 0.0)");

      const chart = new Chart(ctx, {
        type: "line",
        data: {
          labels: [],
          datasets: [{
            label: "Close Price ($)",
            data: [],
            borderColor: "#6366f1",
            backgroundColor: gradient,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.1,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: "#94a3b8" } },
            tooltip: {
              backgroundColor: "#1e293b",
              titleColor: "#f8fafc",
              bodyColor: "#6366f1",
              borderColor: "#334155",
              borderWidth: 1,
            },
          },
          scales: {
            y: { grid: { color: "#334155" }, ticks: { color: "#94a3b8" } },
            x: { grid: { display: false }, ticks: { color: "#94a3b8", maxTicksLimit: 8 } },
          },
        },
      });

      if (chartMap.has(cardId)) {
        chartMap.get(cardId).chart = chart;
      }

      function renderView(period) {
        const filtered = filterResultsByPeriod(rawResults, period);

        tbody.innerHTML = "";
        filtered.forEach((r) => {
          const row = tbody.insertRow();
          row.className = "hover:bg-slate-800/50 border-b border-slate-800/60";

          [
            new Date(r.t).toLocaleDateString(),
            `$${r.o.toFixed(2)}`,
            `$${r.c.toFixed(2)}`,
            `$${r.h.toFixed(2)}`,
            `$${r.l.toFixed(2)}`
          ].forEach((text) => {
            const cell = row.insertCell();
            cell.className = "px-4 py-2 text-slate-200";
            cell.textContent = text;
          });
        });

        chart.data.labels = filtered.map((r) => new Date(r.t).toLocaleDateString());
        chart.data.datasets[0].data = filtered.map((r) => r.c);
        chart.update();
      }

      renderView(defaultPeriod);

      timeSelector.querySelectorAll(".time-btn[data-period]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          timeSelector.querySelectorAll(".time-btn").forEach((b) => {
            b.classList.remove("bg-white", "text-indigo-600", "shadow");
            b.classList.add("bg-transparent", "text-slate-400", "hover:text-slate-100");
          });
          e.currentTarget.classList.remove("bg-transparent", "text-slate-400", "hover:text-slate-100");
          e.currentTarget.classList.add("bg-white", "text-indigo-600", "shadow");
          renderView(e.currentTarget.dataset.period);
        });
      });
    })
    .catch((err) => {
      console.error(`Error loading ${symbol}:`, err);
      stockNameHeading.textContent = `${symbol} (Error loading data)`;
    });
}

// Initial Simulator Load
updateSimulatorUI();