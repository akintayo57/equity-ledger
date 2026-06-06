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
- **Frontend Framework:** React 19 + TypeScript.
- **Build Tool:** Vite.
- **Styling:** Tailwind CSS (v4) with global theme classes supporting light and dark modes.
- **Charting Engine:** Recharts (responsive Line, Area, and Pie charts dynamically styled based on light/dark modes).
- **State Management:** Custom React Context store synchronizing with Firebase Firestore via real-time listeners (`onSnapshot`).
- **Offline / Fallback Database:** A zero-dependency mock database (`localStorage` provider) inside `firebase.ts` that intercepts and handles auth/database actions offline if connection fails or is blocked.
- **Routing:** React Router (`HashRouter` implementation) for stable PWA navigation.

## Implemented Architecture Enhancements
- **Cloud Backend & Sync:** Transitioned to Firebase Firestore to allow multi-device sync and persistent user portfolios.
- **Automated Regional Scrapers:** Developed standalone offline scraping pipelines (`bse_collector` and `gasci_collector`) in Python that fetch stock datasets, parse files, and populate a local SQLite instance before exporting to CSV.
- **Node Seeding Utility**: Developed scripts in Node (`seed_local_firestore.ts`, `import_bse_prices.ts`) that import scraped CSV price data directly into local emulator Firestore or cloud dev.
- **Authentication**: Native Google OAuth integrated via Firebase Authentication (supported by anonymous guest fallback for local testing and developer mode).
- **Comprehensive Testing**: Setup a full suite containing 35 Vitest unit tests (covering store calculations, data formatters, and rendering components) alongside a Playwright E2E integration test suite running on Chromium and Mobile Safari viewports.
