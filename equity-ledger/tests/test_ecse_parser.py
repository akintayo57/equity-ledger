import pytest
from ecse_collector.parser import parse_date_from_text, clean_company_key, parse_ecse_html

def test_parse_date_from_text():
    assert parse_date_from_text("ECSE Daily News Report – 5 June 2026") == "2026-06-05"
    assert parse_date_from_text("ECSE Daily News Report – 05 June 2026") == "2026-06-05"
    assert parse_date_from_text("ECSE Daily News Report – June 5, 2026") == "2026-06-05"
    assert parse_date_from_text("Report for 25 May 2026") == "2026-05-25"
    assert parse_date_from_text("No date in this text") is None

def test_clean_company_key():
    assert clean_company_key("East Caribbean Financial Holding Company Ltd") == "east caribbean financial holding company ltd"
    assert clean_company_key("  The Bank of Nevis   Limited  ") == "the bank of nevis limited"

def test_parse_ecse_html():
    mock_html = """
    <html>
      <head>
        <title>ECSE Daily News Report – 5 June 2026 | Eastern Caribbean Securities Exchange</title>
      </head>
      <body>
        <h1 class="entry-title">ECSE Daily News Report – 5 June 2026</h1>
        <div class="entry-content">
          <p>Welcome to the daily news report.</p>
          <p>On the Eastern Caribbean Securities Market today, 776 shares of East Caribbean Financial Holding Company Ltd traded at $12.40.</p>
          <p>Also, 1,000 shares of The Bank of Nevis Ltd traded at $3.00.</p>
          <p>The closing prices for the listed equities on the ECSE are:</p>
          <p>East Caribbean Financial Holding Company Ltd: $12.40</p>
          <p>The Bank of Nevis Ltd: $3.00</p>
          <p>Dominica Electricity Services Ltd ... $3.50</p>
          <p>TDC Ltd: $1.05</p>
        </div>
      </body>
    </html>
    """
    url = "https://www.ecseonline.com/ecse-daily-news-report-june-5-2026/"
    records = parse_ecse_html(mock_html, url)
    
    assert len(records) == 4
    
    # 1. ECFH
    ecfh = next(r for r in records if r.symbol == "ECFH")
    assert ecfh.close_price == 12.40
    assert ecfh.price_date == "2026-06-05"
    assert ecfh.volume == 776.0
    assert "Traded Volume: 776" in ecfh.notes
    
    # 2. BON
    bon = next(r for r in records if r.symbol == "BON")
    assert bon.close_price == 3.00
    assert bon.volume == 1000.0
    assert "Traded Volume: 1000" in bon.notes
    
    # 3. DOMLEC
    domlec = next(r for r in records if r.symbol == "DOMLEC")
    assert domlec.close_price == 3.50
    assert domlec.volume is None
    
    # 4. TDC
    tdc = next(r for r in records if r.symbol == "TDC")
    assert tdc.close_price == 1.05
    assert tdc.volume is None
