import logging
from dataclasses import dataclass
from typing import List, Optional

logger = logging.getLogger(__name__)

@dataclass
class ParsedBSERecord:
    symbol: str
    company_name: str
    price_date: str
    currency: str
    volume: float
    high_price: Optional[float]
    low_price: Optional[float]
    last_close: Optional[float]
    current_close: Optional[float]
    price_change: float
    bid_price: Optional[float]
    ask_price: Optional[float]
    bid_size: Optional[int]
    ask_size: Optional[int]
    section: str

TICKER_NAME_MAP = {
    "BHL": "Banks Holdings Limited",
    "BDI": "Barbados Dairy Industries Limited",
    "BFL": "Barbados Farms Limited",
    "BCO": "Barbados Light & Power Company Limited",
    "CSP": "Cave Shepherd & Company Limited",
    "CIBC": "FirstCaribbean International Bank",
    "FCI": "FirstCaribbean International Bank",
    "EMABDR": "Emera Deposit Receipt",
    "CPFD": "Caribbean Pension Funds - CPFD Development",
    "CPFV": "Eppley Caribbean Property Fund Limited - Value Fund",
    "GEL": "Goddard Enterprises Limited",
    "ICBL": "Insurance Corporation of Barbados Limited",
    "OCM": "One Caribbean Media Limited",
    "SFC": "Sagicor Financial Corporation",
    "WIB": "West India Biscuit Company Limited",
    "GOB SERIES B": "Government of Barbados Series B",
    "GOB SERIES C": "Government of Barbados Series C",
    "GOB SERIES D": "Government of Barbados Series D",
    "GOB SERIES F": "Government of Barbados Series F",
    "GOB SERIES I": "Government of Barbados Series I",
    "PBSLO": "Productive Business Solutions Limited - USD Preference Shares",
    "PBSL1050": "Productive Business Solutions Limited - 10.50% JMD",
    "PBSL925": "Productive Business Solutions Limited - 9.25% USD Preference Shares",
    "PBSL975": "Productive Business Solutions Limited - 9.75% JMD",
    "ABV": "ABV Investments Incorporated",
    "CWBL": "Cable & Wireless Barbados Limited",
}

def clean_float(val: str) -> Optional[float]:
    if not val:
        return None
    val = val.strip().replace(",", "")
    if val == "" or val == "-" or val == "N/A":
        return None
    try:
        return float(val)
    except ValueError:
        return None

def clean_int(val: str) -> Optional[int]:
    if not val:
        return None
    val = val.strip().replace(",", "")
    if val == "" or val == "-" or val == "N/A":
        return None
    try:
        return int(val)
    except ValueError:
        return None

def parse_csv_line(line: str) -> List[str]:
    result = []
    current = ''
    in_quotes = False
    for char in line:
        if char == '"':
            in_quotes = not in_quotes
        elif char == ',' and not in_quotes:
            result.append(current.strip())
            current = ''
        else:
            current += char
    result.append(current.strip())
    return result

def parse_bse_csv(csv_text: str) -> List[ParsedBSERecord]:
    records = []
    lines = csv_text.splitlines()
    
    current_section = "Main"
    headers = None
    col_map = {}
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Detect section headings
        if line == "Main" or line == "\ufeffMain":
            current_section = "Main"
            headers = None
            continue
        elif line == "Fixed Income":
            current_section = "Fixed Income"
            headers = None
            continue
        elif line == "ISM":
            current_section = "ISM"
            headers = None
            continue
            
        # Detect header row
        if "Trade Date" in line or "Trade_Date" in line:
            headers = parse_csv_line(line)
            col_map = {h.strip('"').lower(): idx for idx, h in enumerate(headers)}
            continue
            
        if headers is None:
            continue
            
        # Parse data row
        row = parse_csv_line(line)
        if len(row) < len(headers):
            continue
            
        try:
            symbol = row[col_map['security']].strip('"')
            if not symbol:
                continue
                
            trade_date = row[col_map['trade date']].strip('"')
            currency = row[col_map['currency']].strip('"')
            
            volume = clean_float(row[col_map['volume']]) or 0.0
            high_price = clean_float(row[col_map['high']])
            low_price = clean_float(row[col_map['low']])
            last_close = clean_float(row[col_map['last close']])
            current_close = clean_float(row[col_map['current close']])
            price_change = clean_float(row[col_map['price change']]) or 0.0
            
            bid_price = clean_float(row[col_map['bid price']]) if 'bid price' in col_map else None
            ask_price = clean_float(row[col_map['ask price']]) if 'ask price' in col_map else None
            bid_size = clean_int(row[col_map['bid size']]) if 'bid size' in col_map else None
            ask_size = clean_int(row[col_map['ask size']]) if 'ask size' in col_map else None
            
            company_name = TICKER_NAME_MAP.get(symbol, f"Security {symbol}")
            
            records.append(ParsedBSERecord(
                symbol=symbol,
                company_name=company_name,
                price_date=trade_date,
                currency=currency,
                volume=volume,
                high_price=high_price,
                low_price=low_price,
                last_close=last_close,
                current_close=current_close,
                price_change=price_change,
                bid_price=bid_price,
                ask_price=ask_price,
                bid_size=bid_size,
                ask_size=ask_size,
                section=current_section
            ))
        except Exception as e:
            logger.warning(f"Failed to parse row line: '{line}'. Error: {e}")
            
    return records
