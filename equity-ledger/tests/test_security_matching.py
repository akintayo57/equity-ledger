import sqlite3
from gasci_collector.db import insert_or_get_security

def test_security_name_matching():
    # Connect to in-memory database and build schema for testing
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE exchanges (
        id INTEGER PRIMARY KEY,
        code TEXT UNIQUE,
        name TEXT,
        country TEXT,
        website_url TEXT,
        currency TEXT
    );
    """)
    cursor.execute("""
    CREATE TABLE securities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exchange_id INTEGER,
        symbol TEXT,
        name TEXT,
        normalized_name TEXT,
        sector TEXT,
        status TEXT,
        listing_date DATE,
        source_url TEXT,
        first_seen_at DATETIME,
        last_seen_at DATETIME,
        created_at DATETIME,
        updated_at DATETIME,
        UNIQUE(exchange_id, symbol)
    );
    """)
    cursor.execute("INSERT INTO exchanges (id, code) VALUES (1, 'GASCI')")
    conn.commit()
    
    exchange_id = 1
    
    # 1. Test J.P. Santos mapping variations
    id_jps1, _, _ = insert_or_get_security(
        conn, exchange_id, name="J.P. Santos & Company Limited", symbol="JPS"
    )
    
    id_jps2, _, _ = insert_or_get_security(
        conn, exchange_id, name="J.P. Santos Company Limited"
    )
    
    # Even without explicit symbol, it maps via normalized name or custom mapping in config
    assert id_jps1 == id_jps2
    
    # 2. Test Guyana Bank for Trade and Industry
    id_bti1, _, _ = insert_or_get_security(
        conn, exchange_id, name="Guyana Bank for Trade and Industry Limited", symbol="BTI"
    )
    
    id_bti2, _, _ = insert_or_get_security(
        conn, exchange_id, name="Guyana Bank for Trade & Industry Limited"
    )
    
    assert id_bti1 == id_bti2
    
    # 3. Test Republic Bank variations
    id_rbl1, _, _ = insert_or_get_security(
        conn, exchange_id, name="Republic Bank (Guyana) Limited"
    )
    
    id_rbl2, _, _ = insert_or_get_security(
        conn, exchange_id, name="Republic Bank Guyana Limited"
    )
    
    assert id_rbl1 == id_rbl2
    
    conn.close()
