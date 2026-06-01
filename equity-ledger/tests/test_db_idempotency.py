import sqlite3
from pathlib import Path
from gasci_collector.db import (
    init_db,
    get_db_connection,
    get_exchange_id,
    insert_or_get_security,
    insert_trade_session,
    insert_security_price
)

def test_sqlite_db_idempotency():
    # Setup an in-memory test database connection
    # Note: init_db runs on file-paths, we can create a temporary db file or setup schemas manually in memory
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    
    # Run the table creation schemas
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE exchanges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        country TEXT NOT NULL,
        website_url TEXT NOT NULL,
        currency TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """)
    cursor.execute("""
    CREATE TABLE securities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exchange_id INTEGER NOT NULL,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        sector TEXT,
        status TEXT NOT NULL DEFAULT 'unknown',
        listing_date DATE,
        source_url TEXT,
        first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (exchange_id) REFERENCES exchanges (id) ON DELETE CASCADE,
        UNIQUE (exchange_id, symbol)
    );
    """)
    cursor.execute("""
    CREATE TABLE trade_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exchange_id INTEGER NOT NULL,
        session_date DATE NOT NULL,
        source_url TEXT,
        raw_file_path TEXT,
        source_hash TEXT,
        fetched_at DATETIME,
        parsed_at DATETIME,
        status TEXT NOT NULL,
        notes TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (exchange_id) REFERENCES exchanges (id) ON DELETE CASCADE,
        UNIQUE (exchange_id, session_date)
    );
    """)
    cursor.execute("""
    CREATE TABLE security_prices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        security_id INTEGER NOT NULL,
        exchange_id INTEGER NOT NULL,
        session_id INTEGER,
        price_date DATE NOT NULL,
        open_price REAL,
        high_price REAL,
        low_price REAL,
        close_price REAL,
        last_traded_price REAL,
        previous_price REAL,
        price_change REAL,
        price_change_pct REAL,
        volume REAL,
        currency TEXT NOT NULL,
        source_url TEXT,
        source_hash TEXT,
        confidence REAL DEFAULT 1.0,
        notes TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (security_id) REFERENCES securities (id) ON DELETE CASCADE,
        FOREIGN KEY (exchange_id) REFERENCES exchanges (id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES trade_sessions (id) ON DELETE SET NULL,
        UNIQUE (security_id, price_date)
    );
    """)
    
    # Seed exchange
    cursor.execute("""
        INSERT INTO exchanges (code, name, country, website_url, currency)
        VALUES ('GASCI', 'Guyana Exchange', 'Guyana', 'https://gse.com', 'GYD')
    """)
    conn.commit()
    
    exchange_id = 1
    
    # 1. Test Security Idempotency
    sec_id1, inserted1, updated1 = insert_or_get_security(
        conn, exchange_id, name="Banks DIH Holdings Inc.", symbol="BDH", source_url="https://url1"
    )
    assert inserted1 is True
    assert updated1 is False
    
    # Insert again (identical)
    sec_id2, inserted2, updated2 = insert_or_get_security(
        conn, exchange_id, name="Banks DIH Holdings Inc.", symbol="BDH", source_url="https://url1"
    )
    assert sec_id1 == sec_id2
    assert inserted2 is False
    assert updated2 is False
    
    # Insert again with minor name variation (should resolve to same security via name normalization or symbol map)
    sec_id3, inserted3, updated3 = insert_or_get_security(
        conn, exchange_id, name="Banks DIH Holdings Inc", symbol="BDH", source_url="https://url2"
    )
    assert sec_id1 == sec_id3
    assert inserted3 is False
    assert updated3 is False
    
    # 2. Test Session Idempotency
    sess_id1, s_inserted1, s_updated1 = insert_trade_session(
        conn, exchange_id, session_date="2026-05-25", source_url="https://sess1", source_hash="hash1"
    )
    assert s_inserted1 is True
    assert s_updated1 is False
    
    # Insert session again (identical)
    sess_id2, s_inserted2, s_updated2 = insert_trade_session(
        conn, exchange_id, session_date="2026-05-25", source_url="https://sess1", source_hash="hash1"
    )
    assert sess_id1 == sess_id2
    assert s_inserted2 is False
    assert s_updated2 is False
    
    # Insert session again (with updated hash / changes)
    sess_id3, s_inserted3, s_updated3 = insert_trade_session(
        conn, exchange_id, session_date="2026-05-25", source_url="https://sess1", source_hash="hash2"
    )
    assert sess_id1 == sess_id3
    assert s_inserted3 is False
    assert s_updated3 is True
    
    # 3. Test Price Record Idempotency
    pr_id1, p_inserted1, p_updated1 = insert_security_price(
        conn, security_id=sec_id1, exchange_id=exchange_id, session_id=sess_id1,
        price_date="2026-05-25", open_price=140.0, high_price=163.0, low_price=140.0,
        close_price=152.7, last_traded_price=163.0, volume=12.4, currency="GYD",
        source_url="https://sess1", source_hash="hash1"
    )
    assert p_inserted1 is True
    assert p_updated1 is False
    
    # Insert price again (identical)
    pr_id2, p_inserted2, p_updated2 = insert_security_price(
        conn, security_id=sec_id1, exchange_id=exchange_id, session_id=sess_id1,
        price_date="2026-05-25", open_price=140.0, high_price=163.0, low_price=140.0,
        close_price=152.7, last_traded_price=163.0, volume=12.4, currency="GYD",
        source_url="https://sess1", source_hash="hash1"
    )
    assert pr_id1 == pr_id2
    assert p_inserted2 is False
    assert p_updated2 is False
    
    # Insert price again (with different price and source hash - represents edit/correction)
    pr_id3, p_inserted3, p_updated3 = insert_security_price(
        conn, security_id=sec_id1, exchange_id=exchange_id, session_id=sess_id1,
        price_date="2026-05-25", open_price=140.0, high_price=163.0, low_price=140.0,
        close_price=155.0, last_traded_price=163.0, volume=12.4, currency="GYD",
        source_url="https://sess1", source_hash="hash2"
    )
    assert pr_id1 == pr_id3
    assert p_inserted3 is False
    assert p_updated3 is True
    
    conn.close()
