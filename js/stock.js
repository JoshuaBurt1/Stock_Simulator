// Date Formatter
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

// DOM Elements
const stockSearchInput = document.getElementById("stockSearchInput");
const addStockBtn = document.getElementById("addStockBtn");
const clearBtn = document.getElementById("clear");
const stockSelect2 = document.querySelector("#stockSelect2");
const resultsContainer = document.getElementById("resultsContainer");

// Global Data Structures
let rawTopTickers = [];
let selectedSymbols = new Set();
let chartMap = new Map();
let cardCounter = 0;

// Fetch Top 1000 Most Active Stocks snapshot
const apiUrlSP = `https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/${snapshotDateStr}?adjusted=true&apiKey=${API_KEY}`;

fetch(apiUrlSP)
  .then((response) => {
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  })
  .then((data) => {
    if (!data.results || data.results.length === 0) {
      stockSelect2.innerHTML = `<option disabled>No data available for date ${snapshotDateStr}</option>`;
      return;
    }

    rawTopTickers = data.results
      .filter((item) => item.T && item.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, 1000);

    renderSelectOptions(rawTopTickers);
  })
  .catch((error) => {
    console.error("Error fetching market data:", error);
    stockSelect2.innerHTML = `<option disabled>Error loading tickers (Check API Key / Console)</option>`;
  });

// Render Tickers inside Select List
function renderSelectOptions(tickers, filterQuery = "") {
  stockSelect2.innerHTML = "";
  let matchedCount = 0;

  tickers.forEach((item) => {
    const isMatch = filterQuery && item.T.startsWith(filterQuery.toUpperCase());
    if (filterQuery && !item.T.includes(filterQuery.toUpperCase())) return;

    const option = document.createElement("option");
    option.value = item.T;
    option.id = item.T;

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
    stockSelect2.innerHTML = `<option disabled>No active ticker found matching "${filterQuery.toUpperCase()}"</option>`;
  }
}

// Live Highlight & Filter on Search Input
stockSearchInput.addEventListener("input", (e) => {
  const query = e.target.value.trim();
  renderSelectOptions(rawTopTickers, query);
});

// Sync selection from list to input box
stockSelect2.addEventListener("change", () => {
  if (stockSelect2.value) {
    stockSearchInput.value = stockSelect2.value;
  }
});

// Add Stock Action
addStockBtn.addEventListener("click", () => {
  submitAddStock();
});

stockSearchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    submitAddStock();
  }
});

function submitAddStock() {
  const query = stockSearchInput.value.trim().toUpperCase() || stockSelect2.value;
  if (!query) return;

  // Prevent duplicate additions
  if (selectedSymbols.has(query)) {
    const existingCard = document.querySelector(`[data-symbol="${query}"]`);
    if (existingCard) {
      existingCard.scrollIntoView({ behavior: "smooth", block: "center" });
      existingCard.style.outline = "2px solid var(--primary)";
      setTimeout(() => (existingCard.style.outline = "none"), 1500);
    }
    return;
  }

  addStockCard(query);
  stockSearchInput.value = "";
  renderSelectOptions(rawTopTickers);
}

// Clear All Cards
clearBtn.addEventListener("click", () => {
  clearAllCards();
});

function clearAllCards() {
  resultsContainer.innerHTML = "";
  chartMap.forEach((entry) => {
    if (entry.chart) entry.chart.destroy();
  });
  chartMap.clear();
  selectedSymbols.clear();
}

// Helper: Filter historical results array based on selected period
function filterResultsByPeriod(results, period) {
  if (!results || results.length === 0) return [];

  const latestTimestamp = results[results.length - 1].t;
  const latestDate = new Date(latestTimestamp);
  let startDate = new Date(latestDate);

  switch (period) {
    case "24H":
      startDate.setDate(latestDate.getDate() - 1);
      break;
    case "7D":
      startDate.setDate(latestDate.getDate() - 7);
      break;
    case "1M":
      startDate.setMonth(latestDate.getMonth() - 1);
      break;
    case "3M":
      startDate.setMonth(latestDate.getMonth() - 3);
      break;
    case "YTD":
      startDate = new Date(latestDate.getFullYear(), 0, 1);
      break;
    case "1Y":
      startDate.setFullYear(latestDate.getFullYear() - 1);
      break;
    case "Max":
      return results;
    default:
      return results;
  }

  const startTime = startDate.getTime();
  return results.filter((r) => r.t >= startTime);
}

// Render stock card incrementally to bottom of container
function addStockCard(symbol) {
  selectedSymbols.add(symbol);
  const cardId = `card-${cardCounter++}`;

  // Outer Card Container
  const stockCard = document.createElement("div");
  stockCard.className = "stock-card";
  stockCard.id = cardId;
  stockCard.dataset.symbol = symbol;

  // Card Header Row (Ticker Title + Time Selector + "X" Button)
  const cardHeader = document.createElement("div");
  cardHeader.className = "stock-card-header";

  const headerLeft = document.createElement("div");
  headerLeft.className = "header-left";

  const stockNameHeading = document.createElement("h2");
  stockNameHeading.textContent = symbol;

  headerLeft.appendChild(stockNameHeading);

  const headerRight = document.createElement("div");
  headerRight.className = "header-right";

  // Time Frame Selector
  const timeSelector = document.createElement("div");
  timeSelector.className = "time-frame-selector";

  const periods = ["24H", "7D", "1M", "3M", "YTD", "1Y", "Max"];
  const defaultPeriod = "1Y";

  periods.forEach((period) => {
    const btn = document.createElement("button");
    btn.className = `time-btn ${period === defaultPeriod ? "active" : ""}`;
    btn.textContent = period;
    btn.dataset.period = period;
    timeSelector.appendChild(btn);
  });

  const divider = document.createElement("div");
  divider.className = "time-divider";
  timeSelector.appendChild(divider);

  const calBtn = document.createElement("button");
  calBtn.className = "time-btn icon-btn";
  calBtn.innerHTML = `
    <svg viewBox="0 0 24 24">
      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/>
    </svg>
  `;
  timeSelector.appendChild(calBtn);

  // "X" Delete Card Button
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-card-btn";
  deleteBtn.title = "Remove Ticker";
  deleteBtn.innerHTML = `
    <svg viewBox="0 0 24 24">
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

  // Card Body Grid
  const cardBody = document.createElement("div");
  cardBody.className = "stock-card-body";

  // Table Wrapper
  const tableWrapper = document.createElement("div");
  tableWrapper.className = "table-wrapper";

  const table = document.createElement("table");
  table.className = "stock-table";

  const thead = document.createElement("thead");
  const tr = document.createElement("tr");
  ["Date", "Open", "Close", "High", "Low"].forEach((text) => {
    const th = document.createElement("th");
    th.textContent = text;
    tr.appendChild(th);
  });
  thead.appendChild(tr);

  const tbody = document.createElement("tbody");
  table.appendChild(thead);
  table.appendChild(tbody);
  tableWrapper.appendChild(table);

  // Chart Wrapper
  const chartWrapper = document.createElement("div");
  chartWrapper.className = "chart-wrapper";

  const canvas = document.createElement("canvas");
  chartWrapper.appendChild(canvas);

  cardBody.appendChild(tableWrapper);
  cardBody.appendChild(chartWrapper);

  stockCard.appendChild(cardHeader);
  stockCard.appendChild(cardBody);

  resultsContainer.appendChild(stockCard);

  chartMap.set(cardId, { chart: null, cardElement: stockCard });

  // Fetch Full Historical Data
  const apiUrl = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/2020-01-01/${formattedDate}?apiKey=${API_KEY}`;

  fetch(apiUrl)
    .then((response) => response.json())
    .then((data) => {
      if (!data.results || data.results.length === 0) {
        stockNameHeading.textContent = `${symbol} (No data available)`;
        return;
      }

      const rawResults = data.results;
      stockNameHeading.textContent = symbol;

      const ctx = canvas.getContext("2d");

      const gradient = ctx.createLinearGradient(0, 0, 0, 300);
      gradient.addColorStop(0, "rgba(99, 102, 241, 0.4)");
      gradient.addColorStop(1, "rgba(99, 102, 241, 0.0)");

      const chart = new Chart(ctx, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            {
              label: "Close Price ($)",
              data: [],
              borderColor: "#6366f1",
              backgroundColor: gradient,
              borderWidth: 2,
              pointRadius: 2,
              pointHoverRadius: 7,
              pointBackgroundColor: "#6366f1",
              pointHoverBackgroundColor: "#ffffff",
              pointHoverBorderColor: "#6366f1",
              pointHoverBorderWidth: 3,
              fill: true,
              tension: 0.1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: "index",
            intersect: false,
          },
          plugins: {
            legend: {
              labels: { color: "#94a3b8", font: { family: "Inter" } },
            },
            tooltip: {
              enabled: true,
              backgroundColor: "#1e293b",
              titleColor: "#f8fafc",
              bodyColor: "#6366f1",
              borderColor: "#334155",
              borderWidth: 1,
              padding: 10,
              displayColors: false,
              callbacks: {
                label: function (context) {
                  return `Close: $${context.parsed.y.toFixed(2)}`;
                },
              },
            },
          },
          scales: {
            y: {
              grid: { color: "#334155" },
              ticks: { color: "#94a3b8" },
              title: { display: true, text: "Price ($)", color: "#94a3b8" },
            },
            x: {
              grid: { display: false },
              ticks: { color: "#94a3b8", maxTicksLimit: 8 },
              title: { display: true, text: "Date", color: "#94a3b8" },
            },
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
          row.insertCell().textContent = new Date(r.t).toLocaleDateString();
          row.insertCell().textContent = `$${r.o.toFixed(2)}`;
          row.insertCell().textContent = `$${r.c.toFixed(2)}`;
          row.insertCell().textContent = `$${r.h.toFixed(2)}`;
          row.insertCell().textContent = `$${r.l.toFixed(2)}`;
        });

        chart.data.labels = filtered.map((r) => new Date(r.t).toLocaleDateString());
        chart.data.datasets[0].data = filtered.map((r) => r.c);
        chart.update();
      }

      renderView(defaultPeriod);

      timeSelector.querySelectorAll(".time-btn[data-period]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          timeSelector.querySelectorAll(".time-btn").forEach((b) => b.classList.remove("active"));
          e.currentTarget.classList.add("active");
          renderView(e.currentTarget.dataset.period);
        });
      });
    })
    .catch((error) => {
      console.error(`Error fetching data for ${symbol}:`, error);
      stockNameHeading.textContent = `${symbol} (Error loading data)`;
    });
}
