import re
import logging
from bs4 import BeautifulSoup
from datetime import datetime
from typing import Optional, List, Dict

logger = logging.getLogger(__name__)

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12
}

# Standard ECSE equities company name to symbol mapping
COMPANY_SYMBOL_MAPPING = {
    "east caribbean financial holding company ltd": "ECFH",
    "east caribbean financial holding company limited": "ECFH",
    "the bank of nevis ltd": "BON",
    "the bank of nevis limited": "BON",
    "bank of nevis": "BON",
    "the west indies oil company limited": "WIOC",
    "the west indies oil company ltd": "WIOC",
    "west indies oil company limited": "WIOC",
    "west indies oil company ltd": "WIOC",
    "dominica electricity services limited": "DOMLEC",
    "dominica electricity services ltd": "DOMLEC",
    "dominica electricity services": "DOMLEC",
    "grenada co-operative bank limited": "GCBL",
    "grenada co-operative bank ltd": "GCBL",
    "grenada co-operative bank": "GCBL",
    "st lucia electricity services limited": "LUCELEC",
    "st lucia electricity services ltd": "LUCELEC",
    "st lucia electricity services": "LUCELEC",
    "republic bank (grenada) limited": "RBGD",
    "republic bank (grenada) ltd": "RBGD",
    "republic bank grenada limited": "RBGD",
    "republic bank grenada ltd": "RBGD",
    "s. l. horsford & company limited": "SLH",
    "s. l. horsford & company ltd": "SLH",
    "s. l. horsford and company limited": "SLH",
    "s. l. horsford and company ltd": "SLH",
    "tdc limited": "TDC",
    "tdc ltd": "TDC",
    "cable & wireless st kitts and nevis limited": "CWKN",
    "cable & wireless st kitts and nevis ltd": "CWKN",
    "bank of st vincent and the grenadines limited": "BSVG",
    "bank of st vincent and the grenadines ltd": "BSVG",
}

class ParsedECSERecord:
    def __init__(
        self,
        symbol: str,
        company_name: str,
        price_date: str,
        close_price: float,
        volume: Optional[float] = None,
        notes: Optional[str] = None
    ):
        self.symbol = symbol
        self.company_name = company_name
        self.price_date = price_date
        self.close_price = close_price
        self.volume = volume
        self.notes = notes

    def __repr__(self):
        return f"<ParsedECSERecord {self.symbol} on {self.price_date}: ${self.close_price}>"

def clean_company_key(name: str) -> str:
    """Normalize names to lowercase, strip trailing/leading spaces, replace multiple spaces with single space."""
    text = name.lower().strip()
    text = re.sub(r'\s+', ' ', text)
    # Strip dots in abbreviations for better matching, except keep standard ones
    text = text.replace("corporation", "corp").replace("incorporated", "inc")
    return text

def parse_date_from_text(text: str) -> Optional[str]:
    """
    Search for date formats like '5 June 2026' or '05 June 2026' or 'June 5, 2026' in text.
    Returns:
        ISO date string 'YYYY-MM-DD' or None.
    """
    # 1. Match '5 June 2026' or '05 June 2026'
    match1 = re.search(r'\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b', text)
    if match1:
        day = int(match1.group(1))
        month_name = match1.group(2).lower()
        year = int(match1.group(3))
        month = MONTHS.get(month_name)
        if month:
            return f"{year:04d}-{month:02d}-{day:02d}"

    # 2. Match 'June 5, 2026'
    match2 = re.search(r'\b([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\b', text)
    if match2:
        month_name = match2.group(1).lower()
        day = int(match2.group(2))
        year = int(match2.group(3))
        month = MONTHS.get(month_name)
        if month:
            return f"{year:04d}-{month:02d}-{day:02d}"

    return None

def parse_ecse_html(html_content: str, url: str) -> List[ParsedECSERecord]:
    """
    Parse the ECSE Daily News Report HTML content.
    Extracts the session date and closing prices.
    """
    soup = BeautifulSoup(html_content, "html.parser")
    
    # 1. Extract session date from title or header tags
    session_date = None
    
    title_tag = soup.find("title")
    if title_tag:
        session_date = parse_date_from_text(title_tag.get_text())
        
    if not session_date:
        entry_title = soup.find(class_=re.compile("entry-title|post-title|title"))
        if entry_title:
            session_date = parse_date_from_text(entry_title.get_text())
            
    if not session_date:
        # Fallback to parsing the date from the URL slug
        session_date = parse_date_from_text(url)
        
    if not session_date:
        # Fallback to search body text
        session_date = parse_date_from_text(soup.get_text())
        
    if not session_date:
        logger.warning(f"Could not extract trade session date for ECSE URL: {url}")
        return []

    # 2. Extract closing prices list from body text
    records = []
    body_text = soup.get_text()
    
    # Parse lines matching: "Company Name: $Price" or "Company Name ... $Price"
    # Pattern: Name followed by optional dots/colons/dashes, then dollar sign and float
    price_pattern = re.compile(r"([A-Za-z0-9\s&',.()-]+?)\s*(?::|\.\.\.|\.\.|\b)\s*\$\s*(\d+\.\d{2})\b")
    
    # Find all paragraph tags to narrow down lines, or fall back to splitting body text by lines
    p_tags = soup.find_all("p")
    lines = [p.get_text().strip() for p in p_tags] if p_tags else body_text.split("\n")
    
    for line in lines:
        line = line.strip()
        if not line or "$" not in line:
            continue
            
        # Skip sentences describing daily trades, index values, or odd lots when parsing closing prices
        line_lower = line.lower()
        if any(word in line_lower for word in ["traded", "shares", "index", "market today", "odd lot", "tip of the day"]):
            continue
            
        # Parse lines matching: "Company Name: $Price" or "Company Name ... $Price"
        # Pattern: Name followed by optional dots/colons/dashes, then dollar sign and float
        for match in price_pattern.finditer(line):
            candidate_name = match.group(1).strip()
            price_val = float(match.group(2))
            
            # Normalize candidate name
            clean_key = clean_company_key(candidate_name)
            
            # Try to resolve to symbol
            symbol = None
            company_name = None
            
            # Check if it's already a standard symbol (e.g. "ECFH")
            upper_cand = candidate_name.upper()
            if upper_cand in set(COMPANY_SYMBOL_MAPPING.values()):
                symbol = upper_cand
                company_name = candidate_name
            elif clean_key in COMPANY_SYMBOL_MAPPING:
                symbol = COMPANY_SYMBOL_MAPPING[clean_key]
                company_name = candidate_name
            else:
                # Do a substring match to be extra resilient, but restrict candidate length
                for name_key, sym in COMPANY_SYMBOL_MAPPING.items():
                    if name_key in clean_key and len(clean_key) < len(name_key) + 15:
                        symbol = sym
                        company_name = candidate_name
                        break
                        
            if symbol:
                # 3. Look for volumes in the same post body
                # The daily trade reports describe the actual volume traded in paragraphs, e.g. "776 shares of ECFH traded"
                volume = None
                vol_match = re.search(
                    r'\b(\d{1,3}(?:,\d{3})*)\s+shares?\s+of\s+' + re.escape(candidate_name) + r'\b',
                    body_text,
                    re.IGNORECASE
                )
                if not vol_match:
                    # Try searching for the symbol
                    vol_match = re.search(
                        r'\b(\d{1,3}(?:,\d{3})*)\s+shares?\s+of\s+' + re.escape(symbol) + r'\b',
                        body_text,
                        re.IGNORECASE
                    )
                if vol_match:
                    try:
                        volume = float(vol_match.group(1).replace(",", ""))
                    except Exception:
                        pass
                        
                notes = f"Parsed from ECSE Daily News Report"
                if volume:
                    notes += f" | Traded Volume: {int(volume)}"
                    
                records.append(ParsedECSERecord(
                    symbol=symbol,
                    company_name=company_name,
                    price_date=session_date,
                    close_price=price_val,
                    volume=volume,
                    notes=notes
                ))
                
    # Deduplicate records by symbol (taking the first match if multiple)
    seen_symbols = set()
    deduped_records = []
    for r in records:
        if r.symbol not in seen_symbols:
            seen_symbols.add(r.symbol)
            deduped_records.append(r)
            
    return deduped_records
