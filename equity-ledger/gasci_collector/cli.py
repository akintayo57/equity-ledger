import argparse
import sys
import logging
from pathlib import Path
from datetime import datetime

from gasci_collector.logging_config import setup_logging
from gasci_collector.config import (
    DEFAULT_DB_PATH,
    DEFAULT_RAW_DIR,
    DEFAULT_EXPORT_DIR,
    EXCHANGE_CODE
)
from gasci_collector.db import (
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
from gasci_collector.fetch import fetch_url, get_cache_filename
from gasci_collector.discover import (
    discover_all_sessions,
    discover_all_securities,
    discover_session_links
)
from gasci_collector.parse.trade_sessions import parse_session_page
from gasci_collector.parse.companies import parse_company_page, parse_company_historical_prices
from gasci_collector.validate import run_validation, print_validation_report
from gasci_collector.export import export_dataset

logger = logging.getLogger("gasci_collector")

def handle_build(args):
    """Execute the full dataset build from scratch."""
    db_path = Path(args.db)
    raw_dir = Path(args.output_dir)
    
    # Initialize DB (idempotent, won't delete existing data if it exists)
    init_db(db_path)
    
    conn = get_db_connection(db_path)
    run_id = create_collection_run(conn, "build")
    exchange_id = get_exchange_id(conn)
    
    start_date = getattr(args, "start_date", None)
    end_date = getattr(args, "end_date", None)
    
    if start_date:
        try:
            datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            logger.error(f"Invalid start-date format: '{start_date}'. Must be YYYY-MM-DD.")
            sys.exit(1)
            
    if end_date:
        try:
            datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            logger.error(f"Invalid end-date format: '{end_date}'. Must be YYYY-MM-DD.")
            sys.exit(1)
            
    logger.info("Starting GASCI build execution run...")
    
    records_fetched = 0
    records_inserted = 0
    records_updated = 0
    records_skipped = 0
    errors_count = 0
    warnings_count = 0
    
    try:
        # 1. Discover and populate list of securities first
        logger.info("Discovering listed companies...")
        security_urls = discover_all_securities(raw_dir=raw_dir)
        for url in security_urls:
            html, content_hash, local_path = fetch_url(url, raw_dir=raw_dir)
            if not html:
                errors_count += 1
                continue
                
            records_fetched += 1
            insert_raw_source(conn, url, "security", str(local_path), content_hash)
            
            parsed_comp = parse_company_page(html, url)
            if parsed_comp:
                sec_id, sec_inserted, sec_updated = insert_or_get_security(
                    conn,
                    exchange_id,
                    name=parsed_comp.name,
                    symbol=parsed_comp.symbol,
                    status=parsed_comp.status,
                    source_url=url
                )
                if sec_inserted:
                    records_inserted += 1
                elif sec_updated:
                    records_updated += 1
                else:
                    records_skipped += 1
                    
                # Optionally parse historical table prices on the company profile page
                hist_prices = parse_company_historical_prices(html, sec_id, exchange_id, url, content_hash)
                logger.info(f"Discovered {len(hist_prices)} historical prices directly on company page for {parsed_comp.name}")
                for hp in hist_prices:
                    if start_date and hp.price_date < start_date:
                        records_skipped += 1
                        continue
                    if end_date and hp.price_date > end_date:
                        records_skipped += 1
                        continue
                    _, pr_inserted, pr_updated = insert_security_price(
                        conn,
                        security_id=sec_id,
                        exchange_id=exchange_id,
                        session_id=None,
                        price_date=hp.price_date,
                        open_price=hp.open_price,
                        high_price=hp.high_price,
                        low_price=hp.low_price,
                        close_price=hp.close_price,
                        last_traded_price=hp.last_traded_price,
                        volume=hp.volume,
                        currency=EXCHANGE_CODE,
                        source_url=url,
                        source_hash=content_hash,
                        confidence=hp.confidence,
                        notes=hp.notes
                    )
                    if pr_inserted:
                        records_inserted += 1
                    elif pr_updated:
                        records_updated += 1
                    else:
                        records_skipped += 1
            else:
                warnings_count += 1
                logger.warning(f"Could not parse company page: {url}")
                
        # 2. Discover and parse all weekly trade sessions
        logger.info("Discovering weekly trade sessions...")
        session_urls = discover_all_sessions(
            raw_dir=raw_dir,
            start_date=start_date,
            end_date=end_date
        )
        
        # Limit to crawl range if requested (e.g. for developer debug build)
        if args.limit is not None:
            session_urls = session_urls[:args.limit]
            logger.info(f"Limit option set: restricting crawl to {args.limit} sessions.")
            
        live_fetched_count = 0
        for i, url in enumerate(session_urls):
            cache_file = raw_dir / get_cache_filename(url)
            if not cache_file.is_file():
                if getattr(args, "live_fetch_limit", None) is not None and live_fetched_count >= args.live_fetch_limit:
                    logger.info(f"Reached live fetch limit ({args.live_fetch_limit}). Stopping session crawl.")
                    break
                live_fetched_count += 1

            logger.info(f"Processing session {i+1}/{len(session_urls)}: {url}")
            html, content_hash, local_path = fetch_url(url, raw_dir=raw_dir)
            if not html:
                errors_count += 1
                continue
                
            parsed_sess = parse_session_page(html, url, content_hash)
            if parsed_sess:
                if start_date and parsed_sess.session_date < start_date:
                    logger.info(f"Skipping session {parsed_sess.session_date} (before start date {start_date})")
                    records_skipped += 1
                    continue
                if end_date and parsed_sess.session_date > end_date:
                    logger.info(f"Skipping session {parsed_sess.session_date} (after end date {end_date})")
                    records_skipped += 1
                    continue

                records_fetched += 1
                insert_raw_source(conn, url, "session", str(local_path), content_hash)
                
                # Insert session details
                notes = f"Session {parsed_sess.session_id}"
                sess_id, sess_inserted, sess_updated = insert_trade_session(
                    conn,
                    exchange_id,
                    session_date=parsed_sess.session_date,
                    source_url=url,
                    raw_file_path=str(local_path),
                    source_hash=content_hash,
                    notes=notes
                )
                if sess_inserted:
                    records_inserted += 1
                elif sess_updated:
                    records_updated += 1
                else:
                    records_skipped += 1
                    
                # Insert each security price row
                for price_rec in parsed_sess.prices:
                    # Dynamically get or insert the security from session table
                    symbol = price_rec.symbol
                    sec_id, sec_inserted, sec_updated = insert_or_get_security(
                        conn,
                        exchange_id,
                        name=price_rec.company_name,
                        symbol=symbol,
                        source_url=url
                    )
                    if sec_inserted:
                        records_inserted += 1
                    elif sec_updated:
                        records_updated += 1
                        
                    # Insert pricing data
                    if start_date and price_rec.price_date < start_date:
                        logger.debug(f"Skipping price row for {symbol} on {price_rec.price_date} (before start date {start_date})")
                        records_skipped += 1
                        continue
                    if end_date and price_rec.price_date > end_date:
                        logger.debug(f"Skipping price row for {symbol} on {price_rec.price_date} (after end date {end_date})")
                        records_skipped += 1
                        continue

                    _, pr_inserted, pr_updated = insert_security_price(
                        conn,
                        security_id=sec_id,
                        exchange_id=exchange_id,
                        session_id=sess_id,
                        price_date=price_rec.price_date,
                        open_price=price_rec.open_price,
                        high_price=price_rec.high_price,
                        low_price=price_rec.low_price,
                        close_price=price_rec.close_price,
                        last_traded_price=price_rec.last_traded_price,
                        volume=price_rec.volume,
                        currency=EXCHANGE_CODE,
                        source_url=url,
                        source_hash=content_hash,
                        confidence=price_rec.confidence,
                        notes=price_rec.notes
                    )
                    if pr_inserted:
                        records_inserted += 1
                    elif pr_updated:
                        records_updated += 1
                    else:
                        records_skipped += 1
            else:
                warnings_count += 1
                logger.warning(f"Could not parse session page: {url}")
                
        update_collection_run(
            conn, run_id, "success",
            fetched=records_fetched,
            inserted=records_inserted,
            updated=records_updated,
            skipped=records_skipped,
            errors=errors_count,
            warnings=warnings_count,
            notes="Full build completed successfully."
        )
        logger.info("GASCI build run completed successfully.")
        
    except Exception as e:
        logger.exception("Fatal error during build run:")
        update_collection_run(
            conn, run_id, "failed",
            fetched=records_fetched,
            inserted=records_inserted,
            updated=records_updated,
            skipped=records_skipped,
            errors=errors_count + 1,
            warnings=warnings_count,
            notes=f"Failed due to error: {e}"
        )
        sys.exit(1)
    finally:
        conn.close()

def handle_update(args):
    """Execute the incremental update of the dataset."""
    db_path = Path(args.db)
    raw_dir = Path(args.output_dir)
    
    if not db_path.is_file():
        logger.error(f"Database file does not exist at {db_path}. Run build command first.")
        sys.exit(1)
        
    conn = get_db_connection(db_path)
    run_id = create_collection_run(conn, "update")
    exchange_id = get_exchange_id(conn)
    
    start_date = getattr(args, "start_date", None)
    end_date = getattr(args, "end_date", None)
    
    if start_date:
        try:
            datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            logger.error(f"Invalid start-date format: '{start_date}'. Must be YYYY-MM-DD.")
            sys.exit(1)
            
    if end_date:
        try:
            datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            logger.error(f"Invalid end-date format: '{end_date}'. Must be YYYY-MM-DD.")
            sys.exit(1)
            
    logger.info("Starting GASCI incremental update execution run...")
    
    records_fetched = 0
    records_inserted = 0
    records_updated = 0
    records_skipped = 0
    errors_count = 0
    warnings_count = 0
    
    try:
        # Check if custom date parameters are provided
        if start_date or end_date:
            logger.info("Discovering sessions using start/end date filters...")
            session_urls = discover_all_sessions(
                raw_dir=raw_dir,
                start_date=start_date,
                end_date=end_date
            )
        else:
            # For updates, we fetch only the main trades page to see recent sessions.
            # This page shows the current year's weekly session links.
            trades_url = f"{EXCHANGE_WEBSITE.rstrip('/')}/trades/"
            html, _, _ = fetch_url(trades_url, raw_dir=raw_dir, force_refresh=True)
            if not html:
                logger.error("Could not fetch the trades index page.")
                sys.exit(1)
            session_urls = discover_session_links(html, trades_url)
            
        logger.info(f"Discovered {len(session_urls)} sessions in scope.")
        
        # Filter URLs: Only fetch session pages that are NOT already parsed in the database
        cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT source_url FROM trade_sessions")
        existing_urls = set(row[0] for row in cursor.fetchall() if row[0])
        
        new_session_urls = [url for url in session_urls if url not in existing_urls]
        logger.info(f"Found {len(new_session_urls)} new sessions to process.")
        
        live_fetched_count = 0
        for url in new_session_urls:
            cache_file = raw_dir / get_cache_filename(url)
            if not cache_file.is_file():
                if getattr(args, "live_fetch_limit", None) is not None and live_fetched_count >= args.live_fetch_limit:
                    logger.info(f"Reached live fetch limit ({args.live_fetch_limit}). Stopping update crawl.")
                    break
                live_fetched_count += 1

            html, content_hash, local_path = fetch_url(url, raw_dir=raw_dir)
            if not html:
                errors_count += 1
                continue
                
            parsed_sess = parse_session_page(html, url, content_hash)
            if parsed_sess:
                if start_date and parsed_sess.session_date < start_date:
                    logger.info(f"Skipping session {parsed_sess.session_date} (before start date {start_date})")
                    records_skipped += 1
                    continue
                if end_date and parsed_sess.session_date > end_date:
                    logger.info(f"Skipping session {parsed_sess.session_date} (after end date {end_date})")
                    records_skipped += 1
                    continue

                records_fetched += 1
                insert_raw_source(conn, url, "session", str(local_path), content_hash)
                
                sess_id, sess_inserted, sess_updated = insert_trade_session(
                    conn,
                    exchange_id,
                    session_date=parsed_sess.session_date,
                    source_url=url,
                    raw_file_path=str(local_path),
                    source_hash=content_hash,
                    notes=f"Session {parsed_sess.session_id}"
                )
                if sess_inserted:
                    records_inserted += 1
                elif sess_updated:
                    records_updated += 1
                else:
                    records_skipped += 1
                    
                for price_rec in parsed_sess.prices:
                    # Lookup / get security
                    sec_id, sec_inserted, sec_updated = insert_or_get_security(
                        conn,
                        exchange_id,
                        name=price_rec.company_name,
                        symbol=price_rec.symbol,
                        source_url=url
                    )
                    if sec_inserted:
                        records_inserted += 1
                    elif sec_updated:
                        records_updated += 1
                        
                    # Insert price
                    if start_date and price_rec.price_date < start_date:
                        logger.debug(f"Skipping price row for {symbol} on {price_rec.price_date} (before start date {start_date})")
                        records_skipped += 1
                        continue
                    if end_date and price_rec.price_date > end_date:
                        logger.debug(f"Skipping price row for {symbol} on {price_rec.price_date} (after end date {end_date})")
                        records_skipped += 1
                        continue

                    _, pr_inserted, pr_updated = insert_security_price(
                        conn,
                        security_id=sec_id,
                        exchange_id=exchange_id,
                        session_id=sess_id,
                        price_date=price_rec.price_date,
                        open_price=price_rec.open_price,
                        high_price=price_rec.high_price,
                        low_price=price_rec.low_price,
                        close_price=price_rec.close_price,
                        last_traded_price=price_rec.last_traded_price,
                        volume=price_rec.volume,
                        currency=EXCHANGE_CODE,
                        source_url=url,
                        source_hash=content_hash,
                        confidence=price_rec.confidence,
                        notes=price_rec.notes
                    )
                    if pr_inserted:
                        records_inserted += 1
                    elif pr_updated:
                        records_updated += 1
                    else:
                        records_skipped += 1
            else:
                warnings_count += 1
                logger.warning(f"Could not parse session page: {url}")
                
        update_collection_run(
            conn, run_id, "success",
            fetched=records_fetched,
            inserted=records_inserted,
            updated=records_updated,
            skipped=records_skipped,
            errors=errors_count,
            warnings=warnings_count,
            notes=f"Incremental update complete. Processed {len(new_session_urls)} new sessions."
        )
        logger.info("GASCI update run completed successfully.")
        
    except Exception as e:
        logger.exception("Fatal error during update run:")
        update_collection_run(
            conn, run_id, "failed",
            fetched=records_fetched,
            inserted=records_inserted,
            updated=records_updated,
            skipped=records_skipped,
            errors=errors_count + 1,
            warnings=warnings_count,
            notes=f"Failed due to error: {e}"
        )
        sys.exit(1)
    finally:
        conn.close()

def handle_validate(args):
    """Run data quality and consistency checks."""
    db_path = Path(args.db)
    if not db_path.is_file():
        logger.error(f"Database file does not exist at {db_path}. Run build command first.")
        sys.exit(1)
        
    issues = run_validation(db_path)
    errors_count = print_validation_report(issues)
    
    if errors_count > 0:
        sys.exit(1)

def handle_export(args):
    """Export SQLite tables to CSV datasets."""
    db_path = Path(args.db)
    output_dir = Path(args.output_dir)
    
    if not db_path.is_file():
        logger.error(f"Database file does not exist at {db_path}. Run build command first.")
        sys.exit(1)
        
    logger.info(f"Exporting dataset tables to directory: {output_dir}")
    counts = export_dataset(db_path, output_dir)
    print("\nDataset Export Completed Successfully:")
    for file, count in counts.items():
        print(f"  - {file}: {count} records written")
    print()

def handle_inspect_source(args):
    """Inspect and preview table headers and row counts for a given URL."""
    url = args.url
    # Temporary raw folder in workspace
    raw_dir = Path("./data/raw")
    logger.info(f"Inspecting source page URL: {url}")
    html, content_hash, _ = fetch_url(url, raw_dir=raw_dir, force_refresh=True)
    if not html:
        logger.error(f"Failed to fetch content for inspection: {url}")
        sys.exit(1)
        
    if "trade_session" in url:
        parsed_sess = parse_session_page(html, url, content_hash)
        if parsed_sess:
            print("\n==========================================")
            print(f"Parsed Session Details for {url}")
            print("==========================================")
            print(f"Session Number: {parsed_sess.session_id}")
            print(f"Session Date:   {parsed_sess.session_date}")
            print(f"Total Rows:     {len(parsed_sess.prices)}")
            print("------------------------------------------")
            print("Sample Row Previews:")
            for p in parsed_sess.prices[:5]:
                print(f"  - [{p.symbol or 'NEW'}] {p.company_name}: Close={p.close_price}, LastTraded={p.last_traded_price}, Traded={p.is_traded}")
            print("==========================================\n")
        else:
            print("Failed to parse page as a trade session.")
    elif "security" in url:
        parsed_comp = parse_company_page(html, url)
        if parsed_comp:
            print("\n==========================================")
            print(f"Parsed Company Details for {url}")
            print("==========================================")
            print(f"Company Name: {parsed_comp.name}")
            print(f"Symbol:       {parsed_comp.symbol or 'NOT DETECTED'}")
            print(f"Slug:         {parsed_comp.slug}")
            print(f"Status:       {parsed_comp.status}")
            print("==========================================\n")
        else:
            print("Failed to parse page as a listed company security.")
    else:
        print("URL path format is not explicitly recognized as a trade session or security page. Checked content headers only.")

def handle_list_securities(args):
    """List all securities in the database."""
    db_path = Path(args.db)
    if not db_path.is_file():
        logger.error(f"Database file does not exist at {db_path}. Run build command first.")
        sys.exit(1)
        
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id, symbol, name, status, last_seen_at FROM securities ORDER BY symbol")
    rows = cursor.fetchall()
    conn.close()
    
    print("\n==========================================")
    print(f"Securities Listed in database ({len(rows)} total)")
    print("==========================================")
    print(f"{'ID':<4} | {'Symbol':<6} | {'Status':<8} | {'Company Name':<45}")
    print("-" * 70)
    for r in rows:
        print(f"{r['id']:<4} | {r['symbol'] or 'None':<6} | {r['status']:<8} | {r['name']:<45}")
    print("==========================================\n")

def handle_list_sessions(args):
    """List all trade sessions in the database."""
    db_path = Path(args.db)
    if not db_path.is_file():
        logger.error(f"Database file does not exist at {db_path}. Run build command first.")
        sys.exit(1)
        
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id, session_date, source_url FROM trade_sessions ORDER BY session_date DESC")
    rows = cursor.fetchall()
    conn.close()
    
    print("\n==========================================")
    print(f"Trade Sessions parsed in database ({len(rows)} total)")
    print("==========================================")
    print(f"{'Session ID':<10} | {'Session Date':<12} | {'Source URL':<50}")
    print("-" * 80)
    for r in rows[:40]: # show recent 40
        print(f"{r['id']:<10} | {r['session_date']:<12} | {r['source_url']}")
    if len(rows) > 40:
        print(f"  ... and {len(rows)-40} more sessions")
    print("==========================================\n")

def main():
    parser = argparse.ArgumentParser(
        description="GASCI Guyana Stock Exchange Offline Data Pipeline Tool",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose logging")
    parser.add_argument("--json", action="store_true", help="Output logs in JSON format")
    
    subparsers = parser.add_subparsers(title="commands", dest="command", required=True)
    
    # 1. build
    p_build = subparsers.add_parser("build", help="Build full dataset from scratch")
    p_build.add_argument("--db", default=str(DEFAULT_DB_PATH), help="Path to SQLite database")
    p_build.add_argument("--output-dir", default=str(DEFAULT_RAW_DIR), help="Directory to save raw HTML files")
    p_build.add_argument("--limit", type=int, help="Limit number of sessions crawled (for debugging)")
    p_build.add_argument("--live-fetch-limit", type=int, help="Limit number of live HTML fetches from the network")
    p_build.add_argument("--start-date", help="Start date filter for session crawling (YYYY-MM-DD)")
    p_build.add_argument("--end-date", help="End date filter for session crawling (YYYY-MM-DD)")
    p_build.set_defaults(func=handle_build)
    
    # 2. update
    p_update = subparsers.add_parser("update", help="Update existing dataset with new sessions")
    p_update.add_argument("--db", default=str(DEFAULT_DB_PATH), help="Path to SQLite database")
    p_update.add_argument("--output-dir", default=str(DEFAULT_RAW_DIR), help="Directory to save raw HTML files")
    p_update.add_argument("--live-fetch-limit", type=int, help="Limit number of live HTML fetches from the network")
    p_update.add_argument("--start-date", help="Start date filter for session crawling (YYYY-MM-DD)")
    p_update.add_argument("--end-date", help="End date filter for session crawling (YYYY-MM-DD)")
    p_update.set_defaults(func=handle_update)
    
    # 3. validate
    p_val = subparsers.add_parser("validate", help="Validate dataset data quality rules")
    p_val.add_argument("--db", default=str(DEFAULT_DB_PATH), help="Path to SQLite database")
    p_val.set_defaults(func=handle_validate)
    
    # 4. export
    p_exp = subparsers.add_parser("export", help="Export dataset tables to CSV")
    p_exp.add_argument("--db", default=str(DEFAULT_DB_PATH), help="Path to SQLite database")
    p_exp.add_argument("--format", choices=["csv"], default="csv", help="Export file format")
    p_exp.add_argument("--output-dir", default=str(DEFAULT_EXPORT_DIR), help="Directory to write export files")
    p_exp.set_defaults(func=handle_export)
    
    # 5. inspect-source
    p_insp = subparsers.add_parser("inspect-source", help="Preview table rows and parse checks for a URL")
    p_insp.add_argument("--url", required=True, help="URL to inspect")
    p_insp.set_defaults(func=handle_inspect_source)
    
    # 6. list-securities
    p_sec = subparsers.add_parser("list-securities", help="Print listed securities stored in DB")
    p_sec.add_argument("--db", default=str(DEFAULT_DB_PATH), help="Path to SQLite database")
    p_sec.set_defaults(func=handle_list_securities)
    
    # 7. list-sessions
    p_sess = subparsers.add_parser("list-sessions", help="Print parsed sessions stored in DB")
    p_sess.add_argument("--db", default=str(DEFAULT_DB_PATH), help="Path to SQLite database")
    p_sess.set_defaults(func=handle_list_sessions)
    
    args = parser.parse_args()
    
    setup_logging(verbose=args.verbose, use_json=args.json)
    
    args.func(args)

if __name__ == "__main__":
    main()
