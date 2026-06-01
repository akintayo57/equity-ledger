# GASCI Stock Exchange Offline Data Collector

An offline data collection, normalization, validation, and export tool for historical security pricing on the **Guyana Stock Exchange (GASCI)**. 

This tool serves as an offline data pipeline. It extracts historical records from the official GASCI website, normalizes the values, resolves carried-forward stale prices to their actual transaction dates, validates dataset integrity, and exports clean CSV datasets—including a consolidated flat file format ready for immediate upload to **Kaggle**.

---

## Technical Stack
* **Language:** Python 3 (Tested on Python 3.9+)
* **HTML Parsing:** BeautifulSoup4
* **Database:** SQLite
* **HTTP Library:** Requests (configured to bypass site bot/security filters)
* **Testing:** Pytest

---

## Directory Layout
All raw data, compiled databases, and generated exports are saved within the project folder:
* **`data/raw/`**: Offline raw HTML cache. Saves requests locally so subsequent runs do not re-crawl the exchange.
* **`data/gasci.sqlite`**: SQLite database holding exchanges, securities, trade sessions, price points, source links, and collection logs.
* **`exports/`**: CSV tables and consolidated Kaggle dataset:
  * `securities.csv` (listed companies metadata)
  * `sessions.csv` (weekly trade sessions metadata)
  * `prices.csv` (historical pricing table)
  * `gasci_historical_prices.csv` (consolidated flat dataset ready for Kaggle)
  * `dataset_metadata.json` (describing columns, record counts, and date coverage)

---

## Setup Instructions

1. Navigate to the project directory:
   ```bash
   cd equity-ledger/equity-ledger
   ```

2. Install the required dependencies:
   ```bash
   python3 -m pip install --user requests beautifulsoup4
   ```

3. For testing or development execution, install `pytest`:
   ```bash
   python3 -m pip install --user pytest
   ```

---

## CLI Execution

You can run the collector directly from your terminal using the module syntax (`python3 -m gasci_collector`):

### 1. Build Full Dataset from Scratch
Discovers all historical trade years (going back to 2003) and all weekly sessions, caches the HTML files on disk, and populates the database.
```bash
python3 -m gasci_collector build
```
*Options:*
* `--limit <N>`: Restrict the initial crawler to the first $N$ sessions discovered (useful for fast developer test runs).
* `--db <path>`: Override the database path (default: `data/gasci.sqlite`).
* `--output-dir <path>`: Override the raw file cache directory (default: `data/raw`).
* `-v` or `--verbose`: Show detailed debug logs.

### 2. Update Existing Dataset
Checks the exchange trades index page, identifies any new weekly trade sessions that have not yet been stored in the database, and fetches/inserts them idempotently.
```bash
python3 -m gasci_collector update
```

### 3. Validate Dataset
Runs data quality checks to inspect for negative prices, duplicate price records, future dates, missing company names, and stale price alerts.
```bash
python3 -m gasci_collector validate
```

### 4. Export CSV & Kaggle Consolidated File
Generates the relational tables and the single, flat, consolidated Kaggle CSV in `exports/`:
```bash
python3 -m gasci_collector export
```

### 5. Inspect Source Page
Prints a parsed row preview and column detection summary for a given GASCI URL (useful for troubleshooting if the website structure changes):
```bash
python3 -m gasci_collector inspect-source --url "https://guyanastockexchangeinc.com/trade_session/1174/"
```

### 6. Query Lists
List all securities or trade sessions currently stored in the database:
```bash
python3 -m gasci_collector list-securities
python3 -m gasci_collector list-sessions
```

---

## Running Unit Tests
Execute the unit test suite using `pytest`:
```bash
PYTHONPATH=. python3 -m pytest tests/
```

---

## Key Core Logic

### Traded vs Carried-Forward Prices
Unlike major exchanges, the GASCI exchange trades once a week (each Monday) and list all companies in every weekly session. If a stock does not trade during a session, its last trade price is carried forward, and the date of that transaction is displayed in the "Last Trade Date" column.
* **Our handling**: The tool checks the `Last Trade Date` column. If it matches a historical date (e.g. `29/12/2025` in session `25/05/2026`), the price record is stored with `price_date = 2025-12-29`, `Is_Traded = 0`, and a confidence rating of `0.5`. If the column is empty, it means it traded during the session, and is stored with `price_date = session_date`, `Is_Traded = 1`, and a confidence rating of `1.0`.
* This dating mechanism ensures a portfolio tracker using this dataset will never calculate portfolio value using stale carried-forward prices as if they were current.

### Name Normalization
To prevent duplicate securities when the source website spells company names slightly differently across trade reports:
1. Suffixes are normalized (e.g. `Ltd.`/`Ltd` -> `Limited`, `Inc.` -> `Incorporated`, `Co.` -> `Company`).
2. Punctuation and spacing are cleaned (e.g., `&` -> `and`, multiple spaces collapsed).
3. If no official ticker is provided, the tool derives a stable uppercase initials slug (e.g. `RGMC` for `Random Gold Mining Company`).

---

## Limitations of GASCI Data
* **Incomplete Historical Columns**: Older sessions (especially prior to 2011) might lack `Open_Price`, `Low_Price`, or `High_Price` values. In these cases, those fields are exported as null/empty, but the `Close_Price` and `MWAP` (when available) are preserved.
* **Pacing of Trades**: Volume traded is represented in *thousands of shares* (e.g., `67.2` represents 67,200 shares). The exporter maintains this decimal scale.

---

## Future Expansion: Adding Other Exchanges
The tool is architected to allow adding other Caribbean exchanges (e.g., Jamaica Stock Exchange - JSE, Trinidad & Tobago Stock Exchange - TTSE) later:
1. **Exchange Code Routing**: The database includes an `exchanges` table. You can register another exchange record (e.g. `JSE`) and map security entries to its `exchange_id`.
2. **Modular Scraping**: Add another folder under `parse/` (e.g., `parse/jse_sessions.py`) implementing separate DOM parsing logic, and call it from `cli.py` based on an exchange target argument (e.g. `--exchange JSE`).
