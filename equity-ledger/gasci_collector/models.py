from dataclasses import dataclass
from typing import Optional, List

@dataclass
class ParsedPrice:
    symbol: Optional[str]
    company_name: Optional[str]
    price_date: str
    open_price: Optional[float]
    high_price: Optional[float]
    low_price: Optional[float]
    close_price: Optional[float]
    last_traded_price: Optional[float]
    volume: Optional[float]  # Total volume traded (in thousands of shares)
    best_bid: Optional[float]
    best_offer: Optional[float]
    confidence: float
    is_traded: bool
    notes: str

@dataclass
class ParsedSession:
    session_id: int
    session_date: str
    source_url: str
    source_hash: str
    prices: List[ParsedPrice]

@dataclass
class ParsedCompany:
    name: str
    symbol: Optional[str]
    slug: str
    sector: Optional[str]
    status: str  # active/inactive/unknown
    listing_date: Optional[str]
    source_url: str
    first_seen_at: Optional[str] = None
    last_seen_at: Optional[str] = None
