import logging
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from datetime import datetime
from typing import Optional, List

from gasci_collector.fetch import fetch_url
from gasci_collector.config import EXCHANGE_WEBSITE

logger = logging.getLogger(__name__)

def extract_year_from_url(url: str) -> Optional[int]:
    """Extract 4-digit year from trades archive URLs."""
    part = url.strip("/").split("/")[-1]
    # Match 2003-trades, 2021-2, 2025-2, etc.
    match = re.search(r'\b(20\d{2})\b', part)
    if match:
        return int(match.group(1))
    return None

import re # Ensure re is imported for extract_year_from_url

def discover_year_links(trades_html: str, base_url: str) -> List[str]:
    """
    Parse the main /trades/ page HTML and extract all yearly archive URLs.
    """
    soup = BeautifulSoup(trades_html, "html.parser")
    year_links = set()
    
    for a in soup.find_all("a", href=True):
        href = a["href"]
        full_url = urljoin(base_url, href)
        
        if "/trades/" in full_url and full_url != base_url:
            part = full_url.strip("/").split("/")[-1]
            if any(char.isdigit() for char in part):
                year_links.add(full_url)
                
    logger.debug(f"Discovered {len(year_links)} yearly trade archive pages.")
    return sorted(list(year_links))

def discover_session_links(page_html: str, base_url: str) -> List[str]:
    """
    Extract all trade session links (e.g. /trade_session/1174/) from a page's HTML.
    """
    soup = BeautifulSoup(page_html, "html.parser")
    session_links = set()
    
    for a in soup.find_all("a", href=True):
        href = a["href"]
        full_url = urljoin(base_url, href)
        if "/trade_session/" in full_url:
            parts = full_url.rstrip("/").split("/")
            if parts[-1].isdigit():
                session_links.add(full_url.rstrip("/") + "/")
                
    return sorted(list(session_links))

def discover_all_sessions(
    raw_dir=None,
    force_refresh=False,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> List[str]:
    """
    Crawl the GASCI site starting from the trades page to discover trade sessions.
    Optimized to only fetch relevant year archive pages if start_date/end_date is specified.
    """
    start_year = None
    end_year = None
    current_year = datetime.now().year
    
    if start_date:
        try:
            start_year = datetime.strptime(start_date, "%Y-%m-%d").year
        except ValueError:
            logger.error(f"Invalid start date format: {start_date}. Expected YYYY-MM-DD.")
            
    if end_date:
        try:
            end_year = datetime.strptime(end_date, "%Y-%m-%d").year
        except ValueError:
            logger.error(f"Invalid end date format: {end_date}. Expected YYYY-MM-DD.")

    trades_url = urljoin(EXCHANGE_WEBSITE, "/trades/")
    html, _, _ = fetch_url(trades_url, raw_dir=raw_dir, force_refresh=force_refresh)
    if not html:
        logger.error("Could not fetch the main trades index page.")
        return []
        
    year_urls = discover_year_links(html, trades_url)
    
    # Filter year URLs based on start_year / end_year range
    filtered_year_urls = []
    for y_url in year_urls:
        yr = extract_year_from_url(y_url)
        if yr:
            if start_year and yr < start_year:
                continue
            if end_year and yr > end_year:
                continue
        filtered_year_urls.append(y_url)
        
    all_sessions = set()
    
    # Check if current year is within range to include main page sessions
    include_current = True
    if start_year and current_year < start_year:
        include_current = False
    if end_year and current_year > end_year:
        include_current = False
        
    if include_current:
        main_sessions = discover_session_links(html, trades_url)
        all_sessions.update(main_sessions)
        logger.info(f"Found {len(main_sessions)} sessions on current year trades page.")
    
    # Extract sessions from each filtered year's index page
    for yr_url in filtered_year_urls:
        yr_html, _, _ = fetch_url(yr_url, raw_dir=raw_dir, force_refresh=force_refresh)
        if yr_html:
            yr_sessions = discover_session_links(yr_html, yr_url)
            all_sessions.update(yr_sessions)
            logger.info(f"Found {len(yr_sessions)} sessions on yearly page {yr_url}")
            
    logger.info(f"Total unique trade sessions discovered within year ranges: {len(all_sessions)}")
    return sorted(list(all_sessions))

def discover_security_links(securities_html: str, base_url: str) -> List[str]:
    """
    Extract security detail URLs (e.g. /security/banks-dih-holdings-inc/) from page HTML.
    """
    soup = BeautifulSoup(securities_html, "html.parser")
    security_links = set()
    
    for a in soup.find_all("a", href=True):
        href = a["href"]
        full_url = urljoin(base_url, href)
        if "/security/" in full_url:
            security_links.add(full_url.rstrip("/") + "/")
            
    return sorted(security_links)

def discover_all_securities(raw_dir=None, force_refresh=False) -> List[str]:
    """
    Fetch the /securities/ page and discover all listed security details pages.
    """
    securities_url = urljoin(EXCHANGE_WEBSITE, "/securities/")
    html, _, _ = fetch_url(securities_url, raw_dir=raw_dir, force_refresh=force_refresh)
    if not html:
        logger.error("Could not fetch the securities list page.")
        return []
        
    security_urls = discover_security_links(html, securities_url)
    logger.info(f"Discovered {len(security_urls)} listed security links on securities page.")
    return sorted(security_urls)
