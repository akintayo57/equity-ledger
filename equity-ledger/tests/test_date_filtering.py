import pytest
from unittest.mock import patch, MagicMock
from gasci_collector.discover import extract_year_from_url, discover_all_sessions

def test_extract_year_from_url():
    assert extract_year_from_url("https://guyanastockexchangeinc.com/trades/2003-trades/") == 2003
    assert extract_year_from_url("https://guyanastockexchangeinc.com/trades/2021-2/") == 2021
    assert extract_year_from_url("https://guyanastockexchangeinc.com/trades/2025-2/") == 2025
    assert extract_year_from_url("https://guyanastockexchangeinc.com/trades/some-other-page/") is None

@patch("gasci_collector.discover.fetch_url")
def test_discover_all_sessions_date_filtering(mock_fetch_url):
    # Mock the main trades page HTML
    main_trades_html = """
    <html>
        <body>
            <a href="https://guyanastockexchangeinc.com/trades/2023-2/">2023 Trades</a>
            <a href="https://guyanastockexchangeinc.com/trades/2024-2/">2024 Trades</a>
            <a href="https://guyanastockexchangeinc.com/trades/2025-2/">2025 Trades</a>
            <a href="https://guyanastockexchangeinc.com/trade_session/1000/">Session 1000</a>
        </body>
    </html>
    """
    
    # Yearly trade pages HTML
    yr_2025_html = """
    <html>
        <body>
            <a href="https://guyanastockexchangeinc.com/trade_session/1010/">Session 1010</a>
        </body>
    </html>
    """
    
    def side_effect(url, **kwargs):
        if "/trades/2025-2/" in url:
            return yr_2025_html, "hash2025", "path2025"
        elif "/trades/" in url:
            return main_trades_html, "hashmain", "pathmain"
        return "", "", ""
        
    mock_fetch_url.side_effect = side_effect
    
    # Crawl with start/end date in 2025
    sessions = discover_all_sessions(
        raw_dir=None,
        start_date="2025-01-01",
        end_date="2025-12-31"
    )
    
    # Should only discover sessions from current year (included if current year is inside range, but system time is 2026, so current year 2026 is outside 2025)
    # Since 2026 (current year) is outside [2025, 2025], it will only fetch /trades/2025-2/
    # Thus, it should find Session 1010 but NOT Session 1000 (which is on the main page for current year 2026).
    assert "https://guyanastockexchangeinc.com/trade_session/1010/" in sessions
    assert "https://guyanastockexchangeinc.com/trade_session/1000/" not in sessions
    
    # Verify the only year page fetched was 2025
    called_urls = [args[0] for args, kwargs in mock_fetch_url.call_args_list]
    assert any("2025-2" in u for u in called_urls)
    assert not any("2024-2" in u for u in called_urls)
    assert not any("2023-2" in u for u in called_urls)
