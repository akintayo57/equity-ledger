import os
import csv
import json
import logging
from pathlib import Path
from datetime import datetime
from ecse_collector.db import get_db_connection, get_exchange_id
from ecse_collector.config import DEFAULT_DB_PATH, DEFAULT_EXPORT_DIR

logger = logging.getLogger(__name__)

def export_dataset(db_path: Path = DEFAULT_DB_PATH, output_dir: Path = DEFAULT_EXPORT_DIR) -> dict[str, int]:
    """
    Exports ECSE database records as CSV tables, including a consolidated historical CSV file.
    Returns:
        dict containing record counts for each exported file.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    
    exchange_id = get_exchange_id(conn)
    counts = {}
    
    # 1. Export ecse_securities.csv
    securities_path = output_dir / "ecse_securities.csv"
    cursor.execute("""
        SELECT symbol, name, normalized_name, sector, status, listing_date, source_url
        FROM securities
        WHERE exchange_id = ?
        ORDER BY symbol
    """, (exchange_id,))
    securities_rows = cursor.fetchall()
    
    with open(securities_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Symbol", "Name", "Normalized_Name", "Sector", "Status", "Listing_Date", "Source_URL"])
        for r in securities_rows:
            writer.writerow([r["symbol"], r["name"], r["normalized_name"], r["sector"], r["status"], r["listing_date"], r["source_url"]])
            
    counts["ecse_securities.csv"] = len(securities_rows)
    logger.info(f"Exported {len(securities_rows)} ECSE securities to {securities_path}")

    # 2. Export ecse_sessions.csv
    sessions_path = output_dir / "ecse_sessions.csv"
    cursor.execute("""
        SELECT id, session_date, source_url, notes
        FROM trade_sessions
        WHERE exchange_id = ?
        ORDER BY session_date DESC
    """, (exchange_id,))
    sessions_rows = cursor.fetchall()
    
    with open(sessions_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Session_ID", "Session_Date", "Source_URL", "Notes"])
        for r in sessions_rows:
            writer.writerow([r["id"], r["session_date"], r["source_url"], r["notes"]])
            
    counts["ecse_sessions.csv"] = len(sessions_rows)
    logger.info(f"Exported {len(sessions_rows)} ECSE trade sessions to {sessions_path}")

    # 3. Export ecse_prices.csv
    prices_path = output_dir / "ecse_prices.csv"
    cursor.execute("""
        SELECT s.symbol, sp.price_date, sp.open_price, sp.high_price, sp.low_price,
               sp.close_price, sp.last_traded_price, sp.confidence, sp.notes
        FROM security_prices sp
        JOIN securities s ON sp.security_id = s.id
        WHERE sp.exchange_id = ?
        ORDER BY sp.price_date DESC, s.symbol ASC
    """, (exchange_id,))
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
            
    counts["ecse_prices.csv"] = len(prices_rows)
    logger.info(f"Exported {len(prices_rows)} ECSE prices to {prices_path}")

    # 4. Export consolidated Kaggle CSV (ecse_historical_prices.csv)
    kaggle_path = output_dir / "ecse_historical_prices.csv"
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
        WHERE sp.exchange_id = ?
        ORDER BY Symbol ASC, Date ASC
    """, (exchange_id,))
    raw_kaggle_rows = cursor.fetchall()
    
    processed_kaggle_rows = []
    prev_close = {}
    
    for r in raw_kaggle_rows:
        symbol = r["Symbol"]
        curr_close = r["Close_Price"]
        is_traded = r["Is_Traded"]
        
        change = None
        change_pct = None
        
        if symbol in prev_close and curr_close is not None:
            prior = prev_close[symbol]
            if prior is not None and prior > 0:
                change = round(curr_close - prior, 4)
                change_pct = round((change / prior) * 100, 2)
                
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
        
    processed_kaggle_rows.sort(key=lambda x: (x[0], x[2]), reverse=True)
    
    with open(kaggle_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Date", "Session_ID", "Symbol", "Security", "Open_Price", "MWAP",
            "Low_Price", "High_Price", "Close_Price", "Volume", "Change", "Change_Pct", "Is_Traded"
        ])
        writer.writerows(processed_kaggle_rows)
        
    counts["ecse_historical_prices.csv"] = len(processed_kaggle_rows)
    logger.info(f"Exported {len(processed_kaggle_rows)} ECSE consolidated historical rows to {kaggle_path}")

    # 5. Export ecse_dataset_metadata.json
    metadata_path = output_dir / "ecse_dataset_metadata.json"
    
    # Calculate date ranges
    cursor.execute("SELECT MIN(price_date), MAX(price_date) FROM security_prices WHERE exchange_id = ?", (exchange_id,))
    min_date, max_date = cursor.fetchone()
    
    metadata = {
        "dataset_name": "Eastern Caribbean Securities Exchange (ECSE) Historical Stock Prices",
        "description": "Historical daily/weekly trade session stock prices on the Eastern Caribbean Securities Exchange.",
        "source": "Eastern Caribbean Securities Exchange (https://www.ecseonline.com/)",
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "date_coverage": {
            "start_date": min_date,
            "end_date": max_date
        },
        "statistics": {
            "total_securities": counts["ecse_securities.csv"],
            "total_sessions": counts["ecse_sessions.csv"],
            "total_price_records": counts["ecse_prices.csv"]
        },
        "files": {
            "ecse_securities.csv": {
                "description": "List of companies listed on the ECSE exchange.",
                "columns": ["Symbol", "Name", "Normalized_Name", "Sector", "Status", "Listing_Date", "Source_URL"]
            },
            "ecse_sessions.csv": {
                "description": "Details of the trading sessions.",
                "columns": ["Session_ID", "Session_Date", "Source_URL", "Notes"]
            },
            "ecse_prices.csv": {
                "description": "Historical price records mapping assets to dates.",
                "columns": ["Symbol", "Price_Date", "Open_Price", "High_Price", "Low_Price", "Close_Price", "Last_Traded_Price", "Confidence", "Notes"]
            },
            "ecse_historical_prices.csv": {
                "description": "Flat, consolidated stock history dataset ready for analysis.",
                "columns": ["Date", "Session_ID", "Symbol", "Security", "Open_Price", "MWAP", "Low_Price", "High_Price", "Close_Price", "Volume", "Change", "Change_Pct", "Is_Traded"]
            }
        }
    }
    
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
        
    logger.info(f"Exported ECSE dataset metadata to {metadata_path}")
    
    conn.close()
    return counts
