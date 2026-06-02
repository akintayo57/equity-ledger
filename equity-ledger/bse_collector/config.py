import os
from pathlib import Path

# Base Paths (defaulting to directories relative to the equity-ledger subdirectory)
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent

DEFAULT_DB_PATH = PROJECT_ROOT / "data" / "gasci.sqlite"
DEFAULT_RAW_DIR = PROJECT_ROOT / "data" / "raw_bse"
DEFAULT_EXPORT_DIR = PROJECT_ROOT / "exports"

# Exchange Defaults
EXCHANGE_CODE = "BSE"
EXCHANGE_NAME = "Barbados Stock Exchange Inc."
EXCHANGE_COUNTRY = "Barbados"
EXCHANGE_WEBSITE = "https://bse.com.bb/"
EXCHANGE_CURRENCY = "BBD"

# Fetching Configurations
HTTP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}
REQUEST_DELAY_SEC = 0.5  # Polite delay between live web requests
