import os
import hashlib
import time
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional, Tuple
import requests
from urllib.parse import urlparse

from gasci_collector.config import HTTP_HEADERS, REQUEST_DELAY_SEC, DEFAULT_RAW_DIR

logger = logging.getLogger(__name__)

def get_cache_filename(url: str) -> str:
    """
    Generate a clean, readable filename for caching a URL's HTML content.
    """
    parsed = urlparse(url)
    path = parsed.path.strip("/")
    
    if not path:
        return "homepage.html"
        
    # Replace slashes and problematic characters with underscores
    clean_path = path.replace("/", "_").replace("-", "_")
    
    # Handle pagination or specific trade sessions
    if "trade_session" in clean_path:
        return f"{clean_path}.html"
    elif "security" in clean_path:
        return f"{clean_path}.html"
    elif "trades" in clean_path:
        return f"trades_{clean_path.replace('trades_', '')}.html"
        
    # Fallback to md5 hash of URL
    url_hash = hashlib.md5(url.encode("utf-8")).hexdigest()
    return f"cache_{url_hash[:16]}.html"

def fetch_url(url: str, raw_dir: Path = DEFAULT_RAW_DIR, force_refresh: bool = False) -> Tuple[Optional[str], Optional[str], Optional[Path]]:
    """
    Fetch a URL, using local disk cache if available.
    Returns:
        tuple (content, content_hash, local_path)
    """
    os.makedirs(raw_dir, exist_ok=True)
    filename = get_cache_filename(url)
    local_path = Path(raw_dir) / filename
    
    # Check disk cache first (if not forcing refresh)
    if not force_refresh and local_path.is_file():
        try:
            with open(local_path, "r", encoding="utf-8") as f:
                content = f.read()
            content_hash = hashlib.md5(content.encode("utf-8")).hexdigest()
            logger.debug(f"Loaded from cache: {url} -> {local_path}")
            return content, content_hash, local_path
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
        
        # Verify it's not a Sucuri security block page (which might return 200 on some challenges)
        if "sucuri" in content.lower() and "block" in content.lower():
            logger.error(f"Sucuri firewall block detected for URL: {url}")
            return None, None, None

        content_hash = hashlib.md5(content.encode("utf-8")).hexdigest()
        
        # Write to disk cache
        with open(local_path, "w", encoding="utf-8") as f:
            f.write(content)
            
        logger.debug(f"Cached fetched URL to: {local_path}")
        return content, content_hash, local_path
        
    except Exception as e:
        logger.error(f"Error fetching URL {url}: {e}")
        return None, None, None
