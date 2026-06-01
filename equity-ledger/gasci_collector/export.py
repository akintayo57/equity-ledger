import os
import csv
import json
import logging
from pathlib import Path
from datetime import datetime
from gasci_collector.db import get_db_connection

logger = logging.getLogger(__name__)

def export_dataset(db_path: Path, output_dir: Path) -> dict[str, int]:
    """
    Exports database records as CSV tables, including a consolidated Kaggle-ready CSV file.
    Returns:
        dict containing record counts for each exported file.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    
    counts = {}
    
    # 1. Export securities.csv
    securities_path = output_dir / "securities.csv"
    cursor.execute("""
        SELECT symbol, name, normalized_name, sector, status, listing_date, source_url
        FROM securities
        ORDER BY symbol
    """)
    securities_rows = cursor.fetchall()
    
    with open(securities_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Symbol", "Name", "Normalized_Name", "Sector", "Status", "Listing_Date", "Source_URL"])
        for r in securities_rows:
            writer.writerow([r["symbol"], r["name"], r["normalized_name"], r["sector"], r["status"], r["listing_date"], r["source_url"]])
            
    counts["securities.csv"] = len(securities_rows)
    logger.info(f"Exported {len(securities_rows)} securities to {securities_path}")

    # 2. Export sessions.csv
    sessions_path = output_dir / "sessions.csv"
    cursor.execute("""
        SELECT id, session_date, source_url, notes
        FROM trade_sessions
        ORDER BY session_date DESC
    """)
    sessions_rows = cursor.fetchall()
    
    with open(sessions_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Session_ID", "Session_Date", "Source_URL", "Notes"])
        for r in sessions_rows:
            writer.writerow([r["id"], r["session_date"], r["source_url"], r["notes"]])
            
    counts["sessions.csv"] = len(sessions_rows)
    logger.info(f"Exported {len(sessions_rows)} trade sessions to {sessions_path}")

    # 3. Export prices.csv (relational table)
    prices_path = output_dir / "prices.csv"
    cursor.execute("""
        SELECT s.symbol, sp.price_date, sp.open_price, sp.high_price, sp.low_price,
               sp.close_price, sp.last_traded_price, sp.confidence, sp.notes
        FROM security_prices sp
        JOIN securities s ON sp.security_id = s.id
        ORDER BY sp.price_date DESC, s.symbol ASC
    """)
    prices_rows = cursor.fetchall()
    
    with open(prices_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Symbol", "Price_Date", "Open_Price", "High_Price", "Low_Price",
                         "Close_Price", "Last_Traded_Price", "Confidence", "Notes"])
        for r in prices_rows:
            writer.writerow([
                r["symbol"], r["price_date"], r["open_price"], r["high_price"], r["low_price"],
                r["close_price"], r["last_traded_price"], r["confidence"], r["notes"]
            ])
            
    counts["prices.csv"] = len(prices_rows)
    logger.info(f"Exported {len(prices_rows)} prices to {prices_path}")

    # 4. Export consolidated Kaggle CSV (gasci_historical_prices.csv)
    # We query all price history ordered chronologically by symbol and date
    # so we can calculate Net Change and Change Pct between trading sessions.
    kaggle_path = output_dir / "gasci_historical_prices.csv"
    cursor.execute("""
        SELECT 
            sp.price_date AS Date,
            sp.session_id AS Session_ID,
            s.symbol AS Symbol,
            s.normalized_name AS Security,
            sp.open_price AS Open_Price,
            sp.close_price AS MWAP,
            sp.low_price AS Low_Price,
            sp.high_price AS High_Price,
            sp.last_traded_price AS Close_Price,
            sp.volume AS Volume,
            sp.confidence AS Confidence,
            CASE WHEN sp.confidence >= 1.0 THEN 1 ELSE 0 END AS Is_Traded
        FROM security_prices sp
        JOIN securities s ON sp.security_id = s.id
        ORDER BY Symbol ASC, Date ASC
    """)
    raw_kaggle_rows = cursor.fetchall()
    
    # We process in memory to compute historical changes relative to the prior traded close price
    processed_kaggle_rows = []
    prev_close = {}  # Map: symbol -> prior traded Close_Price
    
    for r in raw_kaggle_rows:
        symbol = r["Symbol"]
        curr_close = r["Close_Price"]
        is_traded = r["Is_Traded"]
        
        change = None
        change_pct = None
        
        # Calculate change if we have a prior close price
        if symbol in prev_close and curr_close is not None:
            prior = prev_close[symbol]
            if prior is not None and prior > 0:
                change = round(curr_close - prior, 4)
                change_pct = round((change / prior) * 100, 2)
                
        # Only update the previous close if this is an actual traded record (not carried forward)
        # to ensure change calculations compare traded periods correctly.
        if is_traded and curr_close is not None:
            prev_close[symbol] = curr_close
            
        processed_kaggle_rows.append([
            r["Date"],
            r["Session_ID"] if r["Session_ID"] is not None else "",
            r["Symbol"],
            r["Security"],
            r["Open_Price"] if r["Open_Price"] is not None else "",
            r["MWAP"] if r["MWAP"] is not None else "",
            r["Low_Price"] if r["Low_Price"] is not None else "",
            r["High_Price"] if r["High_Price"] is not None else "",
            r["Close_Price"] if r["Close_Price"] is not None else "",
            r["Volume"] if r["Volume"] is not None else "",
            change if change is not None else "",
            change_pct if change_pct is not None else "",
            r["Is_Traded"]
        ])
        
    # Sort the processed records back to descending order by Date and ascending by Symbol (typical format)
    # Date is at index 0, Symbol at index 2
    processed_kaggle_rows.sort(key=lambda x: (x[0], x[2]), reverse=True)
    
    with open(kaggle_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Date", "Session_ID", "Symbol", "Security", "Open_Price", "MWAP",
            "Low_Price", "High_Price", "Close_Price", "Volume", "Change", "Change_Pct", "Is_Traded"
        ])
        writer.writerows(processed_kaggle_rows)
        
    counts["gasci_historical_prices.csv"] = len(processed_kaggle_rows)
    logger.info(f"Exported {len(processed_kaggle_rows)} consolidated Kaggle rows to {kaggle_path}")

    # 5. Export dataset_metadata.json
    metadata_path = output_dir / "dataset_metadata.json"
    
    # Calculate date ranges
    cursor.execute("SELECT MIN(price_date), MAX(price_date) FROM security_prices")
    min_date, max_date = cursor.fetchone()
    
    metadata = {
        "dataset_name": "Guyana Association of Securities Companies and Intermediaries (GASCI) Historical Stock Prices",
        "description": "Historical weekly trade session stock prices on the Guyana Stock Exchange.",
        "source": "Guyana Stock Exchange (https://guyanastockexchangeinc.com/)",
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "date_coverage": {
            "start_date": min_date,
            "end_date": max_date
        },
        "statistics": {
            "total_securities": counts["securities.csv"],
            "total_sessions": counts["sessions.csv"],
            "total_price_records": counts["prices.csv"]
        },
        "files": {
            "securities.csv": {
                "description": "List of companies listed on the GASCI exchange.",
                "columns": ["Symbol", "Name", "Normalized_Name", "Sector", "Status", "Listing_Date", "Source_URL"]
            },
            "sessions.csv": {
                "description": "Details of the weekly trading sessions.",
                "columns": ["Session_ID", "Session_Date", "Source_URL", "Notes"]
            },
            "prices.csv": {
                "description": "Historical price records mapping assets to dates.",
                "columns": ["Symbol", "Price_Date", "Open_Price", "High_Price", "Low_Price", "Close_Price", "Last_Traded_Price", "Confidence", "Notes"]
            },
            "gasci_historical_prices.csv": {
                "description": "Flat, consolidated stock history dataset ready for Kaggle/analysis.",
                "columns": ["Date", "Session_ID", "Symbol", "Security", "Open_Price", "MWAP", "Low_Price", "High_Price", "Close_Price", "Volume", "Change", "Change_Pct", "Is_Traded"]
            }
        }
    }
    
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
        
    logger.info(f"Exported dataset metadata to {metadata_path}")
    
    conn.close()
    return counts
