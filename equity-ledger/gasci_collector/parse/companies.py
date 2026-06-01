import logging
import re
from typing import Optional, List
from bs4 import BeautifulSoup
from gasci_collector.models import ParsedCompany, ParsedPrice
from gasci_collector.config import SYMBOL_CLEAN_MAPPING
from gasci_collector.parse.trade_sessions import clean_float, parse_date

logger = logging.getLogger(__name__)

def extract_symbol_from_text(name: str, body_text: str) -> Optional[str]:
    """
    Search for a 3-4 letter uppercase symbol in parentheses after the company name.
    E.g. "Banks DIH Holdings Inc. (BDH)"
    """
    match = re.search(r'\b' + re.escape(name) + r'\s*\(\s*([A-Z]{3,4})\s*\)', body_text, re.IGNORECASE)
    if match:
        return match.group(1).upper()
        
    matches = re.findall(r'\(([A-Z]{3,4})\)', body_text[:2000])
    if matches:
        return matches[0].upper()
        
    return None

def parse_company_page(html: str, source_url: str) -> Optional[ParsedCompany]:
    """
    Parse a company security profile page.
    Extracts company metadata.
    """
    soup = BeautifulSoup(html, "html.parser")
    
    title_tag = soup.find("title")
    title_text = title_tag.get_text().strip() if title_tag else ""
    
    name = title_text.split("|")[0].strip()
    
    if not name or name == "Security":
        h1 = soup.find("h1")
        if h1:
            name = h1.get_text().strip()
            
    if not name or name == "Security":
        logger.warning(f"Could not extract company name from security page: {source_url}")
        return None
        
    slug = source_url.rstrip("/").split("/")[-1]
    
    symbol = SYMBOL_CLEAN_MAPPING.get(name.lower())
    
    body_text = soup.get_text()
    if not symbol:
        symbol = extract_symbol_from_text(name, body_text)
        
    if not symbol:
        for tr in soup.find_all("tr"):
            attrs = tr.attrs
            for k in attrs.keys():
                if k != "class" and len(k) == 3 and k.isupper():
                    symbol = k
                    break
            if symbol:
                break
                
    normalized_name = name.strip()
    
    status = "active"
    if "suspended" in body_text.lower() or "inactive" in body_text.lower():
        status = "inactive"
        
    sector = None
    listing_date = None
    
    return ParsedCompany(
        name=name,
        symbol=symbol,
        slug=slug,
        sector=sector,
        status=status,
        listing_date=listing_date,
        source_url=source_url
    )

def parse_company_historical_prices(html: str, security_id: int, exchange_id: int, source_url: str, source_hash: str) -> List[ParsedPrice]:
    """
    Parse historical financials tables listed on the company details page.
    This collects historical price points for the security.
    """
    soup = BeautifulSoup(html, "html.parser")
    prices = []
    
    tables = soup.find_all("table", class_="financial-session")
    for table in tables:
        rows = table.find_all("tr")
        if not rows:
            continue
            
        headers = [th.get_text().strip().lower() for th in rows[0].find_all(["th", "td"])]
        
        idx_map = {}
        for i, h in enumerate(headers):
            if "session" in h and h == "session":
                idx_map["session_number"] = i
            elif "session date" in h or "date" in h:
                idx_map["session_date"] = i
            elif "last trade price" in h or "last traded price" in h:
                idx_map["last_trade_price"] = i
            elif "eps" in h:
                idx_map["eps"] = i
            elif "p/e" in h:
                idx_map["pe"] = i
            elif "dividends" in h:
                idx_map["dividends"] = i
            elif "notes" in h:
                idx_map["notes"] = i
                
        if "session_date" not in idx_map or "last_trade_price" not in idx_map:
            continue
            
        for row in rows[1:]:
            cells = [td.get_text().strip() for td in row.find_all(["td", "th"])]
            if len(cells) < len(headers):
                continue
                
            date_str = cells[idx_map["session_date"]]
            parsed_date = parse_date(date_str)
            if not parsed_date:
                continue
                
            price_val = clean_float(cells[idx_map["last_trade_price"]])
            if price_val is None:
                continue
                
            notes_parts = []
            if "eps" in idx_map:
                notes_parts.append(f"EPS: {cells[idx_map['eps']]}")
            if "pe" in idx_map:
                notes_parts.append(f"P/E: {cells[idx_map['pe']]}")
            if "dividends" in idx_map:
                notes_parts.append(f"Div: {cells[idx_map['dividends']]}")
            if "notes" in idx_map:
                notes_parts.append(f"Notes: {cells[idx_map['notes']]}")
                
            notes_str = " | ".join(notes_parts)
            
            price_rec = ParsedPrice(
                symbol=None,
                company_name=None,
                price_date=parsed_date,
                open_price=None,
                high_price=None,
                low_price=None,
                close_price=price_val,
                last_traded_price=price_val,
                volume=None,
                best_bid=None,
                best_offer=None,
                confidence=1.0,
                is_traded=True,
                notes=notes_str
            )
            prices.append(price_rec)
            
    return prices
