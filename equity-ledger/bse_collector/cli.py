import argparse
import sys
import logging
import hashlib
from datetime import datetime, timedelta, date
from pathlib import Path

from bse_collector.logging_config import setup_logging
from bse_collector.config import (
    DEFAULT_DB_PATH,
    DEFAULT_RAW_DIR,
    DEFAULT_EXPORT_DIR,
    EXCHANGE_CODE,
    EXCHANGE_NAME,
    EXCHANGE_CURRENCY
)
from bse_collector.db import (
    init_db,
    get_db_connection,
    get_exchange_id,
    insert_or_get_security,
    insert_trade_session,
    insert_security_price,
    insert_raw_source,
    create_collection_run,
    update_collection_run
)
from bse_collector.fetch import fetch_url
from bse_collector.parser import parse_bse_csv
from bse_collector.export import export_dataset

logger = logging.getLogger("bse_collector")

def compute_hash(text: str) -> str:
    """Compute SHA256 hash of text content."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()

def get_weekday_dates(start: date, end: date) -> list[date]:
    """Get list of date objects for all weekdays (Mon-Fri) between start and end inclusive."""
    dates = []
    curr = start
    while curr <= end:
        if curr.weekday() < 5:  # 0=Monday, ..., 4=Friday
            dates.append(curr)
        curr += timedelta(days=1)
    return dates

def process_dates(conn, exchange_id, dates, raw_dir, start_date_str, end_date_str, live_fetch_limit=None) -> tuple[int, int, int, int, int, int]:
    """Shared routine to crawl and parse daily reports for a list of target dates."""
    records_fetched = 0
    records_inserted = 0
    records_updated = 0
    records_skipped = 0
    errors_count = 0
    warnings_count = 0
    live_fetched_count = 0

    for i, dt in enumerate(dates):
        date_str = dt.strftime("%Y-%m-%d")
        url = f"https://bse.com.bb/reports/download-csv?tradeDate={date_str}"
        
        # Check cache filename
        filename = f"bse_report_{date_str}.csv"
        cache_file = raw_dir / filename
        
        # Apply live fetch limit check
        if not cache_file.is_file():
            if live_fetch_limit is not None and live_fetched_count >= live_fetch_limit:
                logger.info(f"Reached live fetch limit ({live_fetch_limit}). Stopping session crawl.")
                break
            live_fetched_count += 1

        logger.info(f"Processing date {i+1}/{len(dates)}: {date_str}")
        content, local_path = fetch_url(url, raw_dir=raw_dir)
        
        if content is None or local_path is None:
            logger.error(f"Failed to fetch report for date: {date_str}")
            errors_count += 1
            continue
            
        content_hash = compute_hash(content)
        records_fetched += 1
        
        # Parse records
        records = parse_bse_csv(content)
        if not records:
            logger.info(f"No trading records found in report for {date_str} (possible holiday, weekend, or empty file)")
            records_skipped += 1
            # Still record raw source for logging
            insert_raw_source(conn, url, "session", str(local_path), content_hash, notes="No trading records found (empty CSV).")
            continue
            
        # Record raw source
        insert_raw_source(conn, url, "session", str(local_path), content_hash)
        
        # Insert trade session metadata
        sess_id, sess_inserted, sess_updated = insert_trade_session(
            conn,
            exchange_id,
            session_date=date_str,
            source_url=url,
            raw_file_path=str(local_path),
            source_hash=content_hash,
            notes=f"Daily report for {date_str} with {len(records)} records"
        )
        
        if sess_inserted:
            records_inserted += 1
        elif sess_updated:
            records_updated += 1
        else:
            records_skipped += 1
            
        # Insert records into security and pricing tables
        for record in records:
            # Upsert security details
            sec_id, sec_inserted, sec_updated = insert_or_get_security(
                conn,
                exchange_id,
                symbol=record.symbol,
                name=record.company_name,
                sector=record.section,
                status="active",
                source_url=url
            )
            if sec_inserted:
                records_inserted += 1
            elif sec_updated:
                records_updated += 1
                
            # Upsert price details
            _, pr_inserted, pr_updated = insert_security_price(
                conn,
                security_id=sec_id,
                exchange_id=exchange_id,
                session_id=sess_id,
                price_date=record.price_date,
                open_price=None, # BSE daily CSV reports don't explicitly list open price
                high_price=record.high_price,
                low_price=record.low_price,
                close_price=record.current_close,
                last_traded_price=record.current_close,
                previous_price=record.last_close,
                price_change=record.price_change,
                volume=record.volume,
                currency=record.currency or EXCHANGE_CURRENCY,
                source_url=url,
                source_hash=content_hash,
                confidence=1.0,
                notes=f"Parsed from section: {record.section}"
            )
            
            if pr_inserted:
                records_inserted += 1
            elif pr_updated:
                records_updated += 1
            else:
                records_skipped += 1
                
    return (records_fetched, records_inserted, records_updated, records_skipped, errors_count, warnings_count)

def handle_build(args):
    """Execute full/range dataset build."""
    db_path = Path(args.db)
    raw_dir = Path(args.output_dir)
    
    init_db(db_path)
    
    conn = get_db_connection(db_path)
    run_id = create_collection_run(conn, "build")
    exchange_id = get_exchange_id(conn)
    
    start_date_str = getattr(args, "start_date", None)
    end_date_str = getattr(args, "end_date", None)
    
    # Defaults
    if not end_date_str:
        end_date = date.today()
    else:
        try:
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        except ValueError:
            logger.error(f"Invalid end-date format: '{end_date_str}'. Must be YYYY-MM-DD.")
            sys.exit(1)
            
    if not start_date_str:
        start_date = end_date - timedelta(days=14)
    else:
        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        except ValueError:
            logger.error(f"Invalid start-date format: '{start_date_str}'. Must be YYYY-MM-DD.")
            sys.exit(1)
            
    logger.info(f"Starting BSE build execution run for range {start_date} to {end_date}...")
    
    dates = get_weekday_dates(start_date, end_date)
    if args.limit is not None:
        dates = dates[:args.limit]
        logger.info(f"Limit option set: restricting loop to {args.limit} weekdays.")
        
    try:
        fetched, inserted, updated, skipped, errors, warnings = process_dates(
            conn, exchange_id, dates, raw_dir, 
            start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d"),
            live_fetch_limit=args.live_fetch_limit
        )
        
        update_collection_run(
            conn, run_id, "success",
            fetched=fetched,
            inserted=inserted,
            updated=updated,
            skipped=skipped,
            errors=errors,
            warnings=warnings,
            notes=f"BSE build run completed for range {start_date} to {end_date}."
        )
        logger.info("BSE build run completed successfully.")
    except Exception as e:
        logger.exception("Fatal error during build run:")
        update_collection_run(
            conn, run_id, "failed",
            notes=f"Failed due to error: {e}"
        )
        sys.exit(1)
    finally:
        conn.close()

def handle_update(args):
    """Execute incremental update from the latest parsed date in DB to today."""
    db_path = Path(args.db)
    raw_dir = Path(args.output_dir)
    
    if not db_path.is_file():
        logger.error(f"Database file does not exist at {db_path}. Run build command first.")
        sys.exit(1)
        
    conn = get_db_connection(db_path)
    run_id = create_collection_run(conn, "update")
    exchange_id = get_exchange_id(conn)
    
    start_date_str = getattr(args, "start_date", None)
    end_date_str = getattr(args, "end_date", None)
    
    # Determine End Date
    if not end_date_str:
        end_date = date.today()
    else:
        try:
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        except ValueError:
            logger.error(f"Invalid end-date format: '{end_date_str}'. Must be YYYY-MM-DD.")
            sys.exit(1)
            
    # Determine Start Date
    if not start_date_str:
        # Query max session date for BSE
        cursor = conn.cursor()
        cursor.execute("SELECT MAX(session_date) FROM trade_sessions WHERE exchange_id = ?", (exchange_id,))
        row = cursor.fetchone()
        if row and row[0]:
            max_date = datetime.strptime(row[0], "%Y-%m-%d").date()
            start_date = max_date + timedelta(days=1)
            logger.info(f"Last session in DB was {max_date}. Starting update from {start_date}.")
        else:
            start_date = end_date - timedelta(days=14)
            logger.info(f"No existing BSE sessions found. Starting update from default 14 days ago: {start_date}.")
    else:
        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        except ValueError:
            logger.error(f"Invalid start-date format: '{start_date_str}'. Must be YYYY-MM-DD.")
            sys.exit(1)
            
    if start_date > end_date:
        logger.info(f"Start date {start_date} is after end date {end_date}. Nothing to update.")
        update_collection_run(conn, run_id, "success", notes="Start date after end date. Nothing to update.")
        conn.close()
        return

    logger.info(f"Starting BSE incremental update execution run for range {start_date} to {end_date}...")
    
    dates = get_weekday_dates(start_date, end_date)
    
    try:
        fetched, inserted, updated, skipped, errors, warnings = process_dates(
            conn, exchange_id, dates, raw_dir,
            start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d"),
            live_fetch_limit=args.live_fetch_limit
        )
        
        update_collection_run(
            conn, run_id, "success",
            fetched=fetched,
            inserted=inserted,
            updated=updated,
            skipped=skipped,
            errors=errors,
            warnings=warnings,
            notes=f"BSE update completed for range {start_date} to {end_date}."
        )
        logger.info("BSE update run completed successfully.")
    except Exception as e:
        logger.exception("Fatal error during update run:")
        update_collection_run(
            conn, run_id, "failed",
            notes=f"Failed due to error: {e}"
        )
        sys.exit(1)
    finally:
        conn.close()

def handle_export(args):
    """Export BSE tables to CSV files."""
    db_path = Path(args.db)
    output_dir = Path(args.output_dir)
    
    if not db_path.is_file():
        logger.error(f"Database file does not exist at {db_path}. Run build or update first.")
        sys.exit(1)
        
    logger.info(f"Exporting BSE dataset tables to directory: {output_dir}")
    counts = export_dataset(db_path, output_dir)
    print("\nBSE Dataset Export Completed Successfully:")
    for file, count in counts.items():
        print(f"  - {file}: {count} records written")
    print()

def handle_list_securities(args):
    """List all BSE securities in the database."""
    db_path = Path(args.db)
    if not db_path.is_file():
        logger.error(f"Database file does not exist at {db_path}. Run build command first.")
        sys.exit(1)
        
    conn = get_db_connection(db_path)
    exchange_id = get_exchange_id(conn)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, symbol, name, sector, status 
        FROM securities 
        WHERE exchange_id = ? 
        ORDER BY symbol
    """, (exchange_id,))
    rows = cursor.fetchall()
    conn.close()
    
    print("\n==========================================")
    print(f"BSE Securities Listed in database ({len(rows)} total)")
    print("==========================================")
    print(f"{'ID':<4} | {'Symbol':<10} | {'Status':<8} | {'Company Name':<45}")
    print("-" * 75)
    for r in rows:
        print(f"{r['id']:<4} | {r['symbol'] or 'None':<10} | {r['status']:<8} | {r['name']:<45}")
    print("==========================================\n")

def handle_list_sessions(args):
    """List all BSE trade sessions in the database."""
    db_path = Path(args.db)
    if not db_path.is_file():
        logger.error(f"Database file does not exist at {db_path}. Run build command first.")
        sys.exit(1)
        
    conn = get_db_connection(db_path)
    exchange_id = get_exchange_id(conn)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, session_date, source_url 
        FROM trade_sessions 
        WHERE exchange_id = ? 
        ORDER BY session_date DESC
    """, (exchange_id,))
    rows = cursor.fetchall()
    conn.close()
    
    print("\n==========================================")
    print(f"BSE Trade Sessions in database ({len(rows)} total)")
    print("==========================================")
    print(f"{'Session ID':<10} | {'Session Date':<12} | {'Source URL':<50}")
    print("-" * 80)
    for r in rows[:40]:  # show recent 40
        print(f"{r['id']:<10} | {r['session_date']:<12} | {r['source_url']}")
    if len(rows) > 40:
        print(f"  ... and {len(rows)-40} more sessions")
    print("==========================================\n")

def main():
    parser = argparse.ArgumentParser(
        description="BSE Barbados Stock Exchange Offline Data Pipeline Tool",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose logging")
    parser.add_argument("--json", action="store_true", help="Output logs in JSON format")
    
    subparsers = parser.add_subparsers(title="commands", dest="command", required=True)
    
    # 1. build
    p_build = subparsers.add_parser("build", help="Build full/range dataset")
    p_build.add_argument("--db", default=str(DEFAULT_DB_PATH), help="Path to SQLite database")
    p_build.add_argument("--output-dir", default=str(DEFAULT_RAW_DIR), help="Directory to save raw CSV files")
    p_build.add_argument("--limit", type=int, help="Limit number of days processed (for debugging)")
    p_build.add_argument("--live-fetch-limit", type=int, help="Limit number of live CSV fetches from the network")
    p_build.add_argument("--start-date", help="Start date filter for session crawling (YYYY-MM-DD)")
    p_build.add_argument("--end-date", help="End date filter for session crawling (YYYY-MM-DD)")
    p_build.set_defaults(func=handle_build)
    
    # 2. update
    p_update = subparsers.add_parser("update", help="Update existing dataset with new sessions")
    p_update.add_argument("--db", default=str(DEFAULT_DB_PATH), help="Path to SQLite database")
    p_update.add_argument("--output-dir", default=str(DEFAULT_RAW_DIR), help="Directory to save raw CSV files")
    p_update.add_argument("--live-fetch-limit", type=int, help="Limit number of live CSV fetches from the network")
    p_update.add_argument("--start-date", help="Start date filter for session crawling (YYYY-MM-DD)")
    p_update.add_argument("--end-date", help="End date filter for session crawling (YYYY-MM-DD)")
    p_update.set_defaults(func=handle_update)
    
    # 3. export
    p_exp = subparsers.add_parser("export", help="Export BSE dataset tables to CSV")
    p_exp.add_argument("--db", default=str(DEFAULT_DB_PATH), help="Path to SQLite database")
    p_exp.add_argument("--output-dir", default=str(DEFAULT_EXPORT_DIR), help="Directory to write export files")
    p_exp.set_defaults(func=handle_export)
    
    # 4. list-securities
    p_sec = subparsers.add_parser("list-securities", help="Print listed BSE securities stored in DB")
    p_sec.add_argument("--db", default=str(DEFAULT_DB_PATH), help="Path to SQLite database")
    p_sec.set_defaults(func=handle_list_securities)
    
    # 5. list-sessions
    p_sess = subparsers.add_parser("list-sessions", help="Print parsed BSE sessions stored in DB")
    p_sess.add_argument("--db", default=str(DEFAULT_DB_PATH), help="Path to SQLite database")
    p_sess.set_defaults(func=handle_list_sessions)
    
    args = parser.parse_args()
    
    setup_logging(verbose=args.verbose, use_json=args.json)
    
    args.func(args)

if __name__ == "__main__":
    main()
