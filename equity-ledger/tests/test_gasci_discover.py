import pytest
from gasci_collector.discover import extract_year_from_url, discover_year_links, discover_session_links, discover_security_links

def test_extract_year_from_url():
    assert extract_year_from_url("https://guyanastockexchangeinc.com/trades/2026-trades/") == 2026
    assert extract_year_from_url("https://guyanastockexchangeinc.com/trades/2025-2/") == 2025
    assert extract_year_from_url("https://guyanastockexchangeinc.com/trades/current/") is None
    assert extract_year_from_url("https://guyanastockexchangeinc.com/security/banks-dih/") is None

def test_discover_year_links():
    mock_html = """
    <html>
      <body>
        <div class="menu">
          <a href="/trades/2026-trades/">2026 Trades</a>
          <a href="/trades/2025-2/">2025 Trades</a>
          <a href="/security/banks-dih/">Not a trade archive</a>
          <a href="/trades/">Main trades page</a>
        </div>
      </body>
    </html>
    """
    base_url = "https://guyanastockexchangeinc.com/trades/"
    links = discover_year_links(mock_html, base_url)
    
    assert len(links) == 2
    assert "https://guyanastockexchangeinc.com/trades/2026-trades/" in links
    assert "https://guyanastockexchangeinc.com/trades/2025-2/" in links

def test_discover_session_links():
    mock_html = """
    <html>
      <body>
        <table>
          <tr><td><a href="/trade_session/1174/">Session 1174</a></td></tr>
          <tr><td><a href="/trade_session/1173/">Session 1173</a></td></tr>
          <tr><td><a href="/trade_session/1174/pdf/">PDF Report</a></td></tr>
        </table>
      </body>
    </html>
    """
    base_url = "https://guyanastockexchangeinc.com/trades/"
    links = discover_session_links(mock_html, base_url)
    
    assert len(links) == 2
    assert "https://guyanastockexchangeinc.com/trade_session/1174/" in links
    assert "https://guyanastockexchangeinc.com/trade_session/1173/" in links

def test_discover_security_links():
    mock_html = """
    <html>
      <body>
        <ul>
          <li><a href="/security/banks-dih-holdings-inc/">Banks DIH</a></li>
          <li><a href="/security/demerara-bank-limited/">Demerara Bank</a></li>
          <li><a href="/not-a-security/">Other Page</a></li>
        </ul>
      </body>
    </html>
    """
    base_url = "https://guyanastockexchangeinc.com/securities/"
    links = discover_security_links(mock_html, base_url)
    
    assert len(links) == 2
    assert "https://guyanastockexchangeinc.com/security/banks-dih-holdings-inc/" in links
    assert "https://guyanastockexchangeinc.com/security/demerara-bank-limited/" in links
