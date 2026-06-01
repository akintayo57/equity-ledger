# Harbour Finance - Product Specification

## Overview
Harbour Finance (formerly Caribbean Equity Ledger) is a mobile-first Progressive Web App (PWA) designed to track, manage, and analyze non-U.S. Caribbean equity holdings. It caters to investors building portfolios across regional exchanges such as GASCI (Guyana), JSE (Jamaica), TTSE (Trinidad & Tobago), and BSE (Barbados), where data is often fragmented or lacks automated data feeds.

## Core Capabilities
- **Local-First Architecture:** Ensures all portfolio data, transactions, and price points are stored locally within the browser, functioning fully offline.
- **Multi-Currency Normalization:** Converts multiple regional currencies (GYD, JMD, TTD, BBD, XCD) to a base currency (USD) to provide a unified valuation model.
- **Fundamentals Tracking:** Tracks and displays key security ratios (P/E, EPS, Div Yield, P/B, ROE) allowing for fundamental analysis. 

## Key Modules & Views

### 1. Dashboard (The Home View)
- High-level portfolio net worth in USD.
- Total realized/unrealized gains and cost bases.
- Visual summary tiles for quick health checks.
- Mini-list of top performing or key holdings.

### 2. Holdings & Watchlist
- **Portfolio Tab:** Lists all actively held securities. Displays ticker, company name, market value, portfolio weight, and percentage return. Flags stale price data.
- **Watchlist Tab:** Tracks potential investments not currently held, displaying the latest market price, sector, country, and key fundamental ratios if available. 
- **Holding Detail View:** A drill-down view showing detailed stats (Avg Cost, Shares), price history over time (1M, 3M, 6M, 1Y interactive charts), fundamentals snapshot, and transaction history for the specific asset.

### 3. Performance Analytics
- **Portfolio Trend Chart:** Interactive area chart displaying portfolio value growth simulated over variable timeframes (1M, 3M, 6M, 1Y).
- **Sector Allocation:** Interactive pie chart (using Recharts) mapping exposure by industry (Financials, Consumer Staples, Industrials, etc.).
- **Data Freshness Warning:** Alerts the user to any holdings calculating value using stale data.

### 4. Transactions Book
- Ledgers all Buy/Sell and Dividend events across securities.
- Provides history tracking for capital gains calculation and cost-basis adjustment.

### 5. Settings & Data Management
- **Market Data:** Interfaces to manually correct or input new price points and FX conversion rates.
- **Fundamentals:** Batch CSV uploader for updating stock ratios across multiple symbols simultaneously, plus single-asset targeted manual edits.
- **Profile & About:** Demo profiles and version tracking.

## Technical Architecture
- **Frontend Framework:** React 18+ constructed with functional components.
- **Build Tool:** Vite + TypeScript.
- **Styling:** Tailwind CSS for a scalable, mobile-first design system.
- **Charting Engine:** Recharts (responsive Line, Area, and Pie charts).
- **State Management:** Custom React Context store synchronizing with `localStorage`.
- **Routing:** React Router (`HashRouter` implementation) for stable PWA navigation.

## Future Expansion Scenarios (for Antigravity transition)
- **Cloud Backend:** Transitioning from `localStorage` to Firebase or Cloud SQL to allow multi-device sync and persistent user accounts.
- **Automated Pricing:** Integration with an external API scraper for Caribbean asset prices to eliminate manual data entry.
- **Auth:** OAuth 2.0 implementation to replace the simulated demo profile.
