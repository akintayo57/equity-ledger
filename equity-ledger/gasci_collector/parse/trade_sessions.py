import logging
import re
from datetime import datetime
from typing import Optional, Union, List
from bs4 import BeautifulSoup
from gasci_collector.models import ParsedSession, ParsedPrice

logger = logging.getLogger(__name__)

def clean_float(value: str) -> Optional[float]:
    """Clean numeric strings (remove commas, currency signs) and parse to float."""
    if not value:
        return None
    val = value.strip().replace(",", "").replace("G$", "").replace("$", "")
    if not val or val == "-" or val == "N/A" or val == "nil":
        return None
    try:
        return float(val)
    except ValueError:
        logger.warning(f"Failed to parse numeric value: {value}")
        return None

def clean_int(value: str) -> Optional[int]:
    """Clean integer strings and parse to int."""
    if not value:
        return None
    val = value.strip().replace(",", "")
    if not val or val == "-" or val == "N/A":
        return None
    try:
        return int(val)
    except ValueError:
        try:
            return int(float(val))
        except ValueError:
            logger.warning(f"Failed to parse integer value: {value}")
            return None

def parse_date(date_str: str) -> Optional[str]:
    """Convert DD/MM/YYYY or YYYY-MM-DD to YYYY-MM-DD."""
    if not date_str or not date_str.strip():
        return None
    val = date_str.strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(val, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    logger.warning(f"Failed to parse date string: {date_str}")
    return None

def parse_session_page(html: str, source_url: str, source_hash: str) -> Optional[ParsedSession]:
    """
    Parse a weekly trade session HTML page.
    Returns a ParsedSession object containing metadata and a list of ParsedPrice objects.
    """
    soup = BeautifulSoup(html, "html.parser")
    
    # 1. Parse Session ID / Number & Session Date from the session banner
    session_div = soup.find("div", class_="session")
    session_id = None
    session_date = None
    
    if session_div:
        h1 = session_div.find("h1")
        if h1:
            h1_text = h1.get_text().strip()
            match = re.search(r'Session\s+(\d+)', h1_text, re.IGNORECASE)
            if match:
                session_id = int(match.group(1))
                
        date_div = session_div.find("div", class_="date")
        if date_div:
            date_text = date_div.get_text().strip()
            session_date = parse_date(date_text)
            
    if not session_id or not session_date:
        title = soup.find("title")
        if title:
            title_text = title.get_text()
            match_id = re.search(r'Session\s+(\d+)', title_text, re.IGNORECASE)
            if match_id and not session_id:
                session_id = int(match_id.group(1))
                
        text = soup.get_text()
        date_matches = re.findall(r'\b\d{2}/\d{2}/\d{4}\b', text)
        if date_matches and not session_date:
            session_date = parse_date(date_matches[0])
            
    if not session_id:
        logger.warning(f"Could not parse Session ID from session page: {source_url}")
        return None
    if not session_date:
        logger.warning(f"Could not parse Session Date from session page: {source_url}")
        return None

    # 2. Parse the summary table
    table = soup.find("table")
    if not table:
        logger.warning(f"No table found on session page {source_url}")
        return None
        
    rows = table.find_all("tr")
    if not rows:
        logger.warning(f"Table on page {source_url} has no rows.")
        return None
        
    # Extract headers
    header_row = rows[0]
    headers = [th.get_text().strip().lower() for th in header_row.find_all(["th", "td"])]
    
    # Map headers to indices
    idx_map = {}
    for i, h in enumerate(headers):
        if "issuer" in h or "company" in h:
            idx_map["issuer"] = i
        elif "mnemonic" in h or "ticker" in h or "symbol" in h:
            idx_map["mnemonic"] = i
        elif "opening" in h:
            idx_map["open_price"] = i
        elif "mwap" in h or "weighted" in h:
            idx_map["mwap"] = i
        elif "last trade price" in h or "last traded price" in h or "closing price" in h:
            idx_map["last_trade_price"] = i
        elif "last trade date" in h or "last traded date" in h:
            idx_map["last_trade_date"] = i
        elif "total volume" in h or "vol traded" in h:
            idx_map["total_volume"] = i
        elif "best bid" in h:
            idx_map["best_bid"] = i
        elif "best offer" in h:
            idx_map["best_offer"] = i
        elif "low" in h and h == "low g$":
            idx_map["low_price"] = i
        elif "high" in h and h == "high g$":
            idx_map["high_price"] = i
            
    if "issuer" not in idx_map and "mnemonic" not in idx_map:
        logger.warning(f"Table in {source_url} is missing both Issuer and Mnemonic headers.")
        return None

    prices = []
    
    # Process data rows
    for row in rows[1:]:
        cells = [td.get_text().strip() for td in row.find_all(["td", "th"])]
        if len(cells) < len(headers):
            continue
            
        issuer = cells[idx_map["issuer"]] if "issuer" in idx_map else None
        mnemonic = cells[idx_map["mnemonic"]] if "mnemonic" in idx_map else None
        
        if not issuer and not mnemonic:
            continue
            
        last_trade_date_str = cells[idx_map["last_trade_date"]] if "last_trade_date" in idx_map else ""
        last_trade_date = parse_date(last_trade_date_str)
        
        is_traded = True
        price_date = session_date
        
        if last_trade_date and last_trade_date != session_date:
            is_traded = False
            price_date = last_trade_date
            
        open_price = clean_float(cells[idx_map["open_price"]]) if "open_price" in idx_map else None
        mwap = clean_float(cells[idx_map["mwap"]]) if "mwap" in idx_map else None
        last_trade_price = clean_float(cells[idx_map["last_trade_price"]]) if "last_trade_price" in idx_map else None
        best_bid = clean_float(cells[idx_map["best_bid"]]) if "best_bid" in idx_map else None
        best_offer = clean_float(cells[idx_map["best_offer"]]) if "best_offer" in idx_map else None
        low_price = clean_float(cells[idx_map["low_price"]]) if "low_price" in idx_map else None
        high_price = clean_float(cells[idx_map["high_price"]]) if "high_price" in idx_map else None
        total_volume = clean_float(cells[idx_map["total_volume"]]) if "total_volume" in idx_map else None
        
        close_price = mwap if mwap is not None else last_trade_price
        
        confidence = 1.0 if is_traded else 0.5
        notes = ""
        if not is_traded:
            notes = f"Carried forward from last trade date {price_date}"
        if total_volume:
            notes += f" | Vol: {total_volume}k shares"
            
        price_rec = ParsedPrice(
            symbol=mnemonic,
            company_name=issuer,
            price_date=price_date,
            open_price=open_price,
            high_price=high_price,
            low_price=low_price,
            close_price=close_price,
            last_traded_price=last_trade_price,
            volume=total_volume,
            best_bid=best_bid,
            best_offer=best_offer,
            confidence=confidence,
            is_traded=is_traded,
            notes=notes.strip(" | ")
        )
        prices.append(price_rec)
        
    return ParsedSession(
        session_id=session_id,
        session_date=session_date,
        source_url=source_url,
        source_hash=source_hash,
        prices=prices
    )
