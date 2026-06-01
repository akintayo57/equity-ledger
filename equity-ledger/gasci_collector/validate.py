import sqlite3
import logging
from datetime import datetime
from pathlib import Path
from gasci_collector.db import get_db_connection

logger = logging.getLogger(__name__)

def run_validation(db_path: Path) -> dict[str, list[str]]:
    """
    Run validation queries on the database.
    Returns:
        dict containing lists of error/warning strings grouped by category.
    """
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    
    issues = {
        "errors": [],
        "warnings": []
    }
    
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    
    # 1. Check for missing names or symbols
    cursor.execute("SELECT id, symbol, name FROM securities WHERE symbol IS NULL OR symbol = '' OR name IS NULL OR name = ''")
    rows = cursor.fetchall()
    for row in rows:
        issues["errors"].append(f"Security ID {row['id']} has missing symbol or name. Symbol: '{row['symbol']}', Name: '{row['name']}'")
        
    # 2. Check for duplicate symbols
    cursor.execute("SELECT symbol, COUNT(*) as c FROM securities GROUP BY symbol HAVING c > 1")
    rows = cursor.fetchall()
    for row in rows:
        issues["errors"].append(f"Duplicate security symbol found: '{row['symbol']}' is used by {row['c']} records")
        
    # 3. Check for invalid prices (prices <= 0)
    cursor.execute("""
        SELECT sp.id, s.symbol, sp.price_date, sp.close_price, sp.last_traded_price
        FROM security_prices sp
        JOIN securities s ON sp.security_id = s.id
        WHERE sp.close_price <= 0 OR sp.last_traded_price <= 0
    """)
    rows = cursor.fetchall()
    for row in rows:
        issues["errors"].append(f"Invalid price found for {row['symbol']} on {row['price_date']}: Close: {row['close_price']}, Last Traded: {row['last_traded_price']}")
        
    # 4. Check for duplicate price records for same security/date
    cursor.execute("""
        SELECT security_id, price_date, COUNT(*) as c
        FROM security_prices
        GROUP BY security_id, price_date
        HAVING c > 1
    """)
    rows = cursor.fetchall()
    for row in rows:
        issues["errors"].append(f"Duplicate price records for security ID {row['security_id']} on {row['price_date']}: found {row['c']} records")

    # 5. Check for future price dates
    cursor.execute("SELECT id, security_id, price_date FROM security_prices WHERE price_date > ?", (today_str,))
    rows = cursor.fetchall()
    for row in rows:
        issues["errors"].append(f"Future price date detected in price ID {row['id']} (Security ID {row['security_id']}) on date: {row['price_date']}")

    # 6. Check for future session dates
    cursor.execute("SELECT id, session_date FROM trade_sessions WHERE session_date > ?", (today_str,))
    rows = cursor.fetchall()
    for row in rows:
        issues["errors"].append(f"Future session date detected in session ID {row['id']} on date: {row['session_date']}")

    # 7. Check for companies with no price history
    cursor.execute("""
        SELECT id, symbol, name
        FROM securities
        WHERE id NOT IN (SELECT DISTINCT security_id FROM security_prices)
    """)
    rows = cursor.fetchall()
    for row in rows:
        issues["warnings"].append(f"Security {row['symbol']} ('{row['name']}') has no price history records.")
        
    # 8. Check for stale prices (latest price is > 30 days old)
    cursor.execute("""
        SELECT s.symbol, s.name, MAX(sp.price_date) as max_date
        FROM securities s
        JOIN security_prices sp ON s.id = sp.security_id
        WHERE s.status = 'active'
        GROUP BY s.id
        HAVING max_date < date(?, '-30 days')
    """, (today_str,))
    rows = cursor.fetchall()
    for row in rows:
        issues["warnings"].append(f"Stale price warning: Active security {row['symbol']} was last traded on {row['max_date']} (over 30 days ago).")
        
    # 9. Raw files with no parsed records (raw sources not linked in trade_sessions)
    cursor.execute("""
        SELECT source_url, local_path
        FROM raw_sources
        WHERE source_type = 'session'
          AND local_path NOT IN (SELECT DISTINCT raw_file_path FROM trade_sessions WHERE raw_file_path IS NOT NULL)
    """)
    rows = cursor.fetchall()
    for row in rows:
        issues["warnings"].append(f"Raw source session page not linked to any parsed session in DB: URL {row['source_url']} at {row['local_path']}")

    conn.close()
    return issues

def print_validation_report(issues: dict[str, list[str]]) -> int:
    """
    Prints a formatted validation report.
    Returns:
        total number of errors.
    """
    errors = issues["errors"]
    warnings = issues["warnings"]
    
    print("\n==========================================")
    print("        GASCI DATA VALIDATION REPORT       ")
    print("==========================================")
    
    print(f"Total Errors: {len(errors)}")
    print(f"Total Warnings: {len(warnings)}")
    print("------------------------------------------")
    
    if errors:
        print("\nERRORS (Critical Issues):")
        for err in errors:
            print(f"  [ERR] {err}")
    else:
        print("\nNo critical errors found.")
        
    if warnings:
        print("\nWARNINGS (Non-critical Issues):")
        for warn in warnings:
            print(f"  [WARN] {warn}")
    else:
        print("\nNo warnings found.")
        
    print("==========================================\n")
    return len(errors)
