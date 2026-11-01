# Stock Trading Simulator

A web-based stock market explorer and paper trading simulator built with **HTML5**, **Tailwind CSS**, **Chart.js**, and the **Polygon.io API**. 

This application allows users to explore active stock market data, inspect interactive historical price charts, and execute paper trades with historical price backtesting.

---

## 🌟 Key Features

### 1. Interactive Market Explorer & Charting
* **Top 1000 Active Stocks:** Displays a dynamically loaded list of top market movers ordered by volume.
* **Instant Ticker Search:** Search for any valid US stock ticker (e.g., `AAPL`, `TSLA`, `NVDA`) to fetch market data.
* **Interactive Charting:** Powered by Chart.js with responsive time-frame filters (`24H`, `7D`, `1M`, `3M`, `YTD`, `1Y`, `Max`).
* **Historical Data Tables:** Side-by-side tabular view showing daily `Open`, `Close`, `High`, and `Low` historical prices.

### 2. Paper Trading & Portfolio Management
* **Starting Virtual Capital:** Begins with a simulated cash balance of **$100,000.00 USD**.
* **Real-Time Valuation:** Portfolio Value and Net Worth automatically update by fetching current market prices for all held positions.
* **Order Execution:** Supports both `BUY` and `SELL` order actions with automatic cost-basis tracking (average purchase cost).
* **Portfolio Persistence:** All cash balances and open holdings persist across browser refreshes via `localStorage`.
* **One-Click Reset:** Easily reset cash balance and portfolio back to the initial default state.

### 3. Historical Backtesting (Time Travel Orders)
* **Historical Execution:** Use the **Trade Date** selector on the trade panel to backtest trades at historical closing prices for specific past dates.
* **Live Price Adjustment:** Even if a position is opened at a past date, the current position value and total Net Worth update dynamically based on live market prices.
