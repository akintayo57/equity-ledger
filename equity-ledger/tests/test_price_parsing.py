import os
from pathlib import Path
from gasci_collector.parse.trade_sessions import parse_session_page

def test_parse_trade_session_file():
    fixture_path = Path(__file__).parent / "fixtures" / "trade_session_1174.html"
    with open(fixture_path, "r", encoding="utf-8") as f:
        html = f.read()
        
    parsed = parse_session_page(html, "https://guyanastockexchangeinc.com/trade_session/1174/", "mock-hash")
    
    assert parsed is not None
    assert parsed.session_id == 1174
    assert parsed.session_date == "2026-05-25"
    assert len(parsed.prices) == 2
    
    # Verify BDH (traded today)
    bdh = next(p for p in parsed.prices if p.symbol == "BDH")
    assert bdh.company_name == "Banks DIH Holdings Inc."
    assert bdh.price_date == "2026-05-25"
    assert bdh.close_price == 152.7  # MWAP
    assert bdh.last_traded_price == 163.0
    assert bdh.is_traded is True
    assert bdh.volume == 67.2
    assert bdh.confidence == 1.0
    
    # Verify CBI (not traded today, carried forward from 29/12/2025)
    cbi = next(p for p in parsed.prices if p.symbol == "CBI")
    assert cbi.company_name == "Citizens Bank Guyana Incorporated"
    assert cbi.price_date == "2025-12-29"
    assert cbi.close_price == 388.0  # Last Trade Price used because MWAP is empty
    assert cbi.last_traded_price == 388.0
    assert cbi.is_traded is False
    assert cbi.volume is None
    assert cbi.confidence == 0.5
    assert "Carried forward from last trade date 2025-12-29" in cbi.notes
