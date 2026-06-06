import sqlite3
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional, Tuple
from ecse_collector.config import (
    DEFAULT_DB_PATH,
    EXCHANGE_CODE,
    EXCHANGE_NAME,
    EXCHANGE_COUNTRY,
    EXCHANGE_WEBSITE,
    EXCHANGE_CURRENCY
)

logger = logging.getLogger(__name__)

def get_db_connection(db_path: Path = DEFAULT_DB_PATH) -> sqlite3.Connection:
    """Connect to SQLite database with WAL mode and foreign key constraints enabled."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn

def init_db(db_path: Path = DEFAULT_DB_PATH) -> None:
    """Initialize the SQLite schema with tables, unique constraints, and indexes."""
    # Since the schema is shared with gasci, we connect and run seed_exchange
    conn = get_db_connection(db_path)
    seed_exchange(conn)
    conn.close()

def seed_exchange(conn: sqlite3.Connection) -> int:
    """Seed the database with the default ECSE exchange info."""
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO exchanges (code, name, country, website_url, currency)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET
            name=excluded.name,
            country=excluded.country,
            website_url=excluded.website_url,
            currency=excluded.currency,
            updated_at=CURRENT_TIMESTAMP
    """, (EXCHANGE_CODE, EXCHANGE_NAME, EXCHANGE_COUNTRY, EXCHANGE_WEBSITE, EXCHANGE_CURRENCY))
    conn.commit()
    
    cursor.execute("SELECT id FROM exchanges WHERE code = ?", (EXCHANGE_CODE,))
    return cursor.fetchone()[0]

def get_exchange_id(conn: sqlite3.Connection, code: str = EXCHANGE_CODE) -> int:
    """Get the ID of the exchange by code."""
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM exchanges WHERE code = ?", (code,))
    row = cursor.fetchone()
    if row:
        return row[0]
    return seed_exchange(conn)

def insert_or_get_security(
    conn: sqlite3.Connection,
    exchange_id: int,
    symbol: str,
    name: str,
    sector: Optional[str] = None,
    status: str = "active",
    source_url: Optional[str] = None
) -> Tuple[int, bool, bool]:
    """Idempotently find or insert a security record."""
    cursor = conn.cursor()
    symbol = symbol.upper()
    
    cursor.execute(
        "SELECT id, status FROM securities WHERE exchange_id = ? AND symbol = ?",
        (exchange_id, symbol)
    )
    row = cursor.fetchone()
    
    now_str = datetime.utcnow().isoformat() + "Z"
    
    if row:
        sec_id = row[0]
        current_status = row[1]
        
        needs_update = False
        if status != "unknown" and status != current_status:
            cursor.execute(
                "UPDATE securities SET status = ?, last_seen_at = ?, updated_at = ? WHERE id = ?",
                (status, now_str, now_str, sec_id)
            )
            needs_update = True
        else:
            cursor.execute(
                "UPDATE securities SET last_seen_at = ?, updated_at = ? WHERE id = ?",
                (now_str, now_str, sec_id)
            )
            
        conn.commit()
        return sec_id, False, needs_update
    else:
        normalized_name = name.lower().strip()
        cursor.execute("""
            INSERT INTO securities (
                exchange_id, symbol, name, normalized_name, sector, status, source_url,
                first_seen_at, last_seen_at, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            exchange_id, symbol, name, normalized_name, sector, status, source_url,
            now_str, now_str, now_str, now_str
        ))
        conn.commit()
        return cursor.lastrowid, True, False

def insert_trade_session(
    conn: sqlite3.Connection,
    exchange_id: int,
    session_date: str,
    source_url: Optional[str] = None,
    raw_file_path: Optional[str] = None,
    source_hash: Optional[str] = None,
    notes: Optional[str] = None
) -> Tuple[int, bool, bool]:
    """Upsert trade session metadata."""
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, source_hash FROM trade_sessions WHERE exchange_id = ? AND session_date = ?",
        (exchange_id, session_date)
    )
    row = cursor.fetchone()
    
    now_str = datetime.utcnow().isoformat() + "Z"
    
    if row:
        session_id = row[0]
        curr_hash = row[1]
        
        if source_hash and source_hash != curr_hash:
            cursor.execute("""
                UPDATE trade_sessions
                SET source_hash = ?, raw_file_path = ?, parsed_at = ?, status = 'parsed', notes = ?, updated_at = ?
                WHERE id = ?
            """, (source_hash, raw_file_path, now_str, notes, now_str, session_id))
            conn.commit()
            return session_id, False, True
            
        return session_id, False, False
    else:
        cursor.execute("""
            INSERT INTO trade_sessions (
                exchange_id, session_date, source_url, raw_file_path, source_hash,
                fetched_at, parsed_at, status, notes, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'parsed', ?, ?, ?)
        """, (
            exchange_id, session_date, source_url, raw_file_path, source_hash,
            now_str, now_str, notes, now_str, now_str
        ))
        conn.commit()
        return cursor.lastrowid, True, False

def insert_security_price(
    conn: sqlite3.Connection,
    security_id: int,
    exchange_id: int,
    session_id: Optional[int],
    price_date: str,
    open_price: Optional[float],
    high_price: Optional[float],
    low_price: Optional[float],
    close_price: Optional[float],
    last_traded_price: Optional[float],
    previous_price: Optional[float],
    price_change: Optional[float],
    volume: Optional[float],
    currency: str,
    source_url: Optional[str],
    source_hash: Optional[str],
    confidence: float = 1.0,
    notes: Optional[str] = None
) -> Tuple[int, bool, bool]:
    """Idempotent upsert for pricing points."""
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, close_price, source_hash FROM security_prices WHERE security_id = ? AND price_date = ?",
        (security_id, price_date)
    )
    row = cursor.fetchone()
    
    now_str = datetime.utcnow().isoformat() + "Z"
    
    if row:
        price_id = row[0]
        curr_hash = row[2]
        
        if source_hash and source_hash != curr_hash:
            cursor.execute("""
                UPDATE security_prices
                SET session_id = ?, open_price = ?, high_price = ?, low_price = ?,
                    close_price = ?, last_traded_price = ?, previous_price = ?, price_change = ?,
                    volume = ?, source_hash = ?, confidence = ?, notes = ?, updated_at = ?
                WHERE id = ?
            """, (
                session_id, open_price, high_price, low_price,
                close_price, last_traded_price, previous_price, price_change,
                volume, source_hash, confidence, notes, now_str, price_id
            ))
            conn.commit()
            return price_id, False, True
            
        return price_id, False, False
    else:
        cursor.execute("""
            INSERT INTO security_prices (
                security_id, exchange_id, session_id, price_date, open_price,
                high_price, low_price, close_price, last_traded_price, previous_price, price_change,
                volume, currency, source_url, source_hash, confidence, notes, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            security_id, exchange_id, session_id, price_date, open_price,
            high_price, low_price, close_price, last_traded_price, previous_price, price_change,
            volume, currency, source_url, source_hash, confidence, notes, now_str, now_str
        ))
        conn.commit()
        return cursor.lastrowid, True, False

def insert_raw_source(
    conn: sqlite3.Connection,
    url: str,
    source_type: str,
    local_path: str,
    content_hash: str,
    http_status: int = 200,
    notes: Optional[str] = None
) -> None:
    """Record raw source page fetches."""
    cursor = conn.cursor()
    now_str = datetime.utcnow().isoformat() + "Z"
    cursor.execute("""
        INSERT INTO raw_sources (
            source_url, source_type, local_path, content_hash, fetched_at,
            http_status, parser_version, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, '0.1.0', ?)
        ON CONFLICT(source_url) DO UPDATE SET
            local_path=excluded.local_path,
            content_hash=excluded.content_hash,
            fetched_at=excluded.fetched_at,
            http_status=excluded.http_status,
            notes=excluded.notes
    """, (url, source_type, local_path, content_hash, now_str, http_status, notes))
    conn.commit()

def create_collection_run(conn: sqlite3.Connection, run_type: str) -> int:
    """Create a new run execution record."""
    cursor = conn.cursor()
    now_str = datetime.utcnow().isoformat() + "Z"
    cursor.execute("""
        INSERT INTO collection_runs (run_type, started_at, status)
        VALUES (?, ?, 'running')
    """, (run_type, now_str))
    conn.commit()
    return cursor.lastrowid

def update_collection_run(
    conn: sqlite3.Connection,
    run_id: int,
    status: str,
    fetched: int = 0,
    inserted: int = 0,
    updated: int = 0,
    skipped: int = 0,
    errors: int = 0,
    warnings: int = 0,
    notes: Optional[str] = None
) -> None:
    """Update progress metrics of a run execution and finalize it."""
    cursor = conn.cursor()
    now_str = datetime.utcnow().isoformat() + "Z"
    cursor.execute("""
        UPDATE collection_runs
        SET status = ?,
            finished_at = ?,
            records_fetched = ?,
            records_inserted = ?,
            records_updated = ?,
            records_skipped = ?,
            errors_count = ?,
            warnings_count = ?,
            notes = ?
        WHERE id = ?
    """, (status, now_str, fetched, inserted, updated, skipped, errors, warnings, notes, run_id))
    conn.commit()
