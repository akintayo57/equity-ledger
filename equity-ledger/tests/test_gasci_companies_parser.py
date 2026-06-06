import pytest
from gasci_collector.parse.companies import extract_symbol_from_text, parse_company_page, parse_company_historical_prices

def test_extract_symbol_from_text():
    # Test matching company name followed by symbol in parentheses
    assert extract_symbol_from_text("Banks DIH Holdings Inc.", "Banks DIH Holdings Inc. (BDH) was registered in Guyana") == "BDH"
    
    # Test case insensitivity and extra whitespace
    assert extract_symbol_from_text("Banks DIH Holdings Inc.", "banks dih holdings inc.   (  BDH  )") == "BDH"
    
    # Test fallback to first match in parentheses within first 2000 chars
    assert extract_symbol_from_text("Unknown Company", "Lorem ipsum (XYZ) dolor sit amet") == "XYZ"
    
    # Test none found returns None
    assert extract_symbol_from_text("Empty Company", "No symbols here") is None

def test_parse_company_page():
    mock_html = """
    <html>
      <head>
        <title>Demerara Bank Limited | Guyana Stock Exchange</title>
      </head>
      <body>
        <h1>Demerara Bank Limited</h1>
        <p>Demerara Bank Limited (DBL) is a leading commercial bank in Guyana.</p>
      </body>
    </html>
    """
    url = "https://guyanastockexchangeinc.com/security/demerara-bank-limited/"
    company = parse_company_page(mock_html, url)
    
    assert company is not None
    assert company.name == "Demerara Bank Limited"
    assert company.symbol == "DBL"
    assert company.slug == "demerara-bank-limited"
    assert company.status == "active"
    assert company.source_url == url

def test_parse_company_page_inactive():
    mock_html = """
    <html>
      <head><title>Suspended Corp | GSE</title></head>
      <body>
        <h1>Suspended Corp</h1>
        <p>This listing is currently suspended/inactive.</p>
      </body>
    </html>
    """
    url = "https://guyanastockexchangeinc.com/security/suspended-corp/"
    company = parse_company_page(mock_html, url)
    assert company is not None
    assert company.status == "inactive"

def test_parse_company_historical_prices():
    mock_html = """
    <table class="financial-session">
      <tr>
        <th>Session</th>
        <th>Session Date</th>
        <th>Last Trade Price</th>
        <th>EPS</th>
        <th>P/E</th>
        <th>Dividends</th>
        <th>Notes</th>
      </tr>
      <tr>
        <td>1174</td>
        <td>25/05/2026</td>
        <td>G$ 152.70</td>
        <td>12.50</td>
        <td>12.20</td>
        <td>3.50</td>
        <td>Standard trade session</td>
      </tr>
      <tr>
        <td>1173</td>
        <td>18/05/2026</td>
        <td> - </td>
        <td>12.50</td>
        <td>12.20</td>
        <td>3.50</td>
        <td>No trade occurred</td>
      </tr>
    </table>
    """
    
    prices = parse_company_historical_prices(mock_html, security_id=1, exchange_id=2, source_url="mock-url", source_hash="mock-hash")
    
    assert len(prices) == 1  # 2nd row has price ' - ' which is cleaned to None, so it should be skipped
    p = prices[0]
    assert p.price_date == "2026-05-25"
    assert p.close_price == 152.7
    assert p.last_traded_price == 152.7
    assert p.is_traded is True
    assert "EPS: 12.50" in p.notes
    assert "P/E: 12.20" in p.notes
    assert "Div: 3.50" in p.notes
    assert "Notes: Standard trade session" in p.notes
