import pytest
import sqlite3
from pathlib import Path
from datetime import datetime

from gasci_collector.db import init_db, get_db_connection
from gasci_collector.validate import run_validation, print_validation_report

def test_run_validation_empty_db(tmp_path):
    db_path = tmp_path / "test_empty.db"
    init_db(db_path)
    
    issues = run_validation(db_path)
    
    # An empty seeded database should only contain one warning about GASCI having no price history
    assert len(issues["errors"]) == 0
    # Wait, the exchange is seeded but no securities exist yet. If no securities, there shouldn't be any warnings either.
    # Let's check
    assert len(issues["warnings"]) == 0

def test_run_validation_issues(tmp_path):
    db_path = tmp_path / "test_issues.db"
    init_db(db_path)
    
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    
    # Seed a second exchange to allow testing duplicate symbols across exchanges
    cursor.execute("""
        INSERT INTO exchanges (code, name, country, website_url, currency)
        VALUES ('EX2', 'Exchange 2', 'Country 2', 'https://ex2.com', 'GYD')
    """)
    conn.commit()
    
    # 1. Error: Missing symbol or name (ID 1)
    cursor.execute("""
        INSERT INTO securities (exchange_id, symbol, name, normalized_name, status)
        VALUES (1, '', 'Banks DIH', 'banks dih', 'active')
    """)
    
    # 2. Error: Duplicate symbols (securities ID 2 and 3)
    cursor.execute("""
        INSERT INTO securities (exchange_id, symbol, name, normalized_name, status)
        VALUES (1, 'BDH', 'Banks DIH Holdings Inc.', 'banks dih holdings inc', 'active')
    """)
    cursor.execute("""
        INSERT INTO securities (exchange_id, symbol, name, normalized_name, status)
        VALUES (2, 'BDH', 'Duplicate BDH Corp', 'duplicate bdh corp', 'active')
    """)
    
    # 3. Error: Invalid price (ID 4 close_price <= 0)
    cursor.execute("""
        INSERT INTO securities (exchange_id, symbol, name, normalized_name, status)
        VALUES (1, 'DBL', 'Demerara Bank Limited', 'demerara bank limited', 'active')
    """)
    sec_dbl_id = cursor.lastrowid
    
    cursor.execute("""
        INSERT INTO security_prices (security_id, exchange_id, price_date, close_price, last_traded_price, currency)
        VALUES (?, 1, '2026-05-25', -5.0, 150.0, 'GYD')
    """, (sec_dbl_id,))
    
    # 4. Error: Future price date (date > today)
    cursor.execute("""
        INSERT INTO security_prices (security_id, exchange_id, price_date, close_price, last_traded_price, currency)
        VALUES (?, 1, '2050-01-01', 120.0, 120.0, 'GYD')
    """, (sec_dbl_id,))
    
    # 5. Error: Future session date
    cursor.execute("""
        INSERT INTO trade_sessions (exchange_id, session_date, status)
        VALUES (1, '2050-01-01', 'parsed')
    """)
    
    # 6. Warning: Security with no price history
    cursor.execute("""
        INSERT INTO securities (exchange_id, symbol, name, normalized_name, status)
        VALUES (1, 'NOPRICE', 'No Price Limited', 'no price limited', 'active')
    """)
    
    # 7. Warning: Stale price (latest price is > 30 days old)
    cursor.execute("""
        INSERT INTO securities (exchange_id, symbol, name, normalized_name, status)
        VALUES (1, 'STALE', 'Stale Security Corp', 'stale security corp', 'active')
    """)
    sec_stale_id = cursor.lastrowid
    
    cursor.execute("""
        INSERT INTO security_prices (security_id, exchange_id, price_date, close_price, last_traded_price, currency)
        VALUES (?, 1, '2020-01-01', 10.0, 10.0, 'GYD')
    """, (sec_stale_id,))
    
    conn.commit()
    conn.close()
    
    issues = run_validation(db_path)
    
    # Assert validation detects the errors
    assert any("missing symbol or name" in err for err in issues["errors"])
    assert any("Duplicate security symbol found" in err for err in issues["errors"])
    assert any("Invalid price found" in err for err in issues["errors"])
    assert any("Future price date detected" in err for err in issues["errors"])
    assert any("Future session date detected" in err for err in issues["errors"])
    
    # Assert validation detects the warnings
    assert any("no price history records" in warn for warn in issues["warnings"])
    assert any("Stale price warning" in warn for warn in issues["warnings"])
    
    # Test print report returns correct error count
    error_count = print_validation_report(issues)
    assert error_count == len(issues["errors"])
