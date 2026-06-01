from gasci_collector.normalize import normalize_company_name, generate_symbol_slug
from gasci_collector.parse.trade_sessions import clean_float, clean_int, parse_date

def test_normalize_company_name():
    assert normalize_company_name("Banks DIH Ltd.") == "banks dih limited"
    assert normalize_company_name("Demerara Bank Limited") == "demerara bank limited"
    assert normalize_company_name("Citizens Bank Guyana Incorporated") == "citizens bank guyana incorporated"
    assert normalize_company_name("J.P. Santos & Company Limited") == "j.p. santos and company limited"
    assert normalize_company_name("  Property   Holdings   Inc.  ") == "property holdings incorporated"

def test_generate_symbol_slug():
    # Test configured mappings
    assert generate_symbol_slug("banks dih holdings inc.") == "BDH"
    assert generate_symbol_slug("republic bank (guyana) limited") == "RBL"
    assert generate_symbol_slug("republic bank guyana limited") == "RBL"
    
    # Test dynamic fallback initials derivation
    assert generate_symbol_slug("random gold mining company") == "RGMC"

def test_clean_float():
    assert clean_float("152.7") == 152.7
    assert clean_float("1,234.50") == 1234.5
    assert clean_float("G$ 163.00") == 163.0
    assert clean_float("$163.00") == 163.0
    assert clean_float(" - ") is None
    assert clean_float("") is None
    assert clean_float(None) is None

def test_clean_int():
    assert clean_int("123") == 123
    assert clean_int("1,234") == 1234
    assert clean_int(" - ") is None
    assert clean_int("") is None

def test_parse_date():
    assert parse_date("25/05/2026") == "2026-05-25"
    assert parse_date("2026-05-25") == "2026-05-25"
    assert parse_date(" - ") is None
    assert parse_date("") is None
