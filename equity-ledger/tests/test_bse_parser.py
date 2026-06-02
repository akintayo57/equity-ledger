import pytest
from bse_collector.parser import parse_bse_csv, ParsedBSERecord

def test_parse_bse_csv_multi_section():
    mock_csv = """Main
"Security","Trade Date","Currency","Volume","High","Low","Last Close","Current Close","Price Change","Bid Price","Ask Price","Bid Size","Ask Size"
"GEL","2026-05-28","BBD","1,000","2.50","2.45","2.40","2.48","0.08","2.45","2.50","500","1,000"
"ICBL","2026-05-28","BBD","0","N/A","N/A","1.80","1.80","0.00","-","-","-","-"

Fixed Income
"Security","Trade Date","Currency","Volume","High","Low","Last Close","Current Close","Price Change"
"GOB SERIES B","2026-05-28","BBD","20,000","73.00","73.00","72.50","73.00","0.50"

ISM
"Security","Trade Date","Currency","Volume","High","Low","Last Close","Current Close","Price Change"
"PBSLO","2026-05-28","USD","500","0.55","0.55","0.55","0.55","0.00"
"""

    records = parse_bse_csv(mock_csv)
    
    assert len(records) == 4
    
    # 1. Verify Goddard Enterprises Limited (GEL)
    gel = next(r for r in records if r.symbol == "GEL")
    assert gel.company_name == "Goddard Enterprises Limited"
    assert gel.price_date == "2026-05-28"
    assert gel.currency == "BBD"
    assert gel.volume == 1000.0
    assert gel.high_price == 2.50
    assert gel.low_price == 2.45
    assert gel.last_close == 2.40
    assert gel.current_close == 2.48
    assert gel.price_change == 0.08
    assert gel.bid_price == 2.45
    assert gel.ask_price == 2.50
    assert gel.bid_size == 500
    assert gel.ask_size == 1000
    assert gel.section == "Main"
    
    # 2. Verify Insurance Corporation of Barbados (ICBL) - checking float and N/A handling
    icbl = next(r for r in records if r.symbol == "ICBL")
    assert icbl.company_name == "Insurance Corporation of Barbados Limited"
    assert icbl.volume == 0.0
    assert icbl.high_price is None
    assert icbl.low_price is None
    assert icbl.last_close == 1.80
    assert icbl.current_close == 1.80
    assert icbl.price_change == 0.0
    assert icbl.bid_price is None
    assert icbl.ask_price is None
    assert icbl.section == "Main"
    
    # 3. Verify Fixed Income bond
    gob = next(r for r in records if r.symbol == "GOB SERIES B")
    assert gob.company_name == "Government of Barbados Series B"
    assert gob.volume == 20000.0
    assert gob.current_close == 73.0
    assert gob.section == "Fixed Income"
    
    # 4. Verify ISM pref share
    pbs = next(r for r in records if r.symbol == "PBSLO")
    assert pbs.company_name == "Productive Business Solutions Limited - USD Preference Shares"
    assert pbs.currency == "USD"
    assert pbs.volume == 500.0
    assert pbs.current_close == 0.55
    assert pbs.section == "ISM"
