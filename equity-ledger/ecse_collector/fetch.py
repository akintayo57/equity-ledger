import os
import time
import logging
from pathlib import Path
from typing import Optional, Tuple
from urllib.parse import urlparse
import requests

from ecse_collector.config import HTTP_HEADERS, REQUEST_DELAY_SEC, DEFAULT_RAW_DIR

logger = logging.getLogger(__name__)

def get_cache_filename(url: str) -> str:
    """Generate a cache filename based on the URL path."""
    parsed = urlparse(url)
    path = parsed.path.strip("/")
    if not path:
        return "ecse_market_news.html"
    clean_path = path.replace("/", "_").replace("-", "_")
    return f"{clean_path}.html"

def fetch_url(url: str, raw_dir: Path = DEFAULT_RAW_DIR, force_refresh: bool = False) -> Tuple[Optional[str], Optional[Path]]:
    """
    Fetch a URL, using local disk cache if available.
    Returns:
        tuple (content, local_path)
    """
    os.makedirs(raw_dir, exist_ok=True)
    filename = get_cache_filename(url)
    local_path = Path(raw_dir) / filename
    
    # Check disk cache first (if not forcing refresh)
    if not force_refresh and local_path.is_file():
        try:
            with open(local_path, "r", encoding="utf-8") as f:
                content = f.read()
            logger.debug(f"Loaded from cache: {url} -> {local_path}")
            return content, local_path
        except Exception as e:
            logger.warning(f"Failed to read cache for {url} at {local_path}: {e}")

    # Not cached or force refreshed, fetch live page
    logger.info(f"Fetching live: {url}")
    # Polite scraping delay
    time.sleep(REQUEST_DELAY_SEC)
    
    try:
        response = requests.get(url, headers=HTTP_HEADERS, timeout=15)
        response.raise_for_status()
        content = response.text
        
        # Write to disk cache
        with open(local_path, "w", encoding="utf-8") as f:
            f.write(content)
            
        logger.debug(f"Cached fetched URL to: {local_path}")
        return content, local_path
        
    except Exception as e:
        logger.error(f"Error fetching URL {url}: {e}")
        return None, None
