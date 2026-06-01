import os
from pathlib import Path

# Base Paths (defaulting to directories relative to the equity-ledger subdirectory)
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent

DEFAULT_DB_PATH = PROJECT_ROOT / "data" / "gasci.sqlite"
DEFAULT_RAW_DIR = PROJECT_ROOT / "data" / "raw"
DEFAULT_EXPORT_DIR = PROJECT_ROOT / "exports"

# Exchange Defaults
EXCHANGE_CODE = "GASCI"
EXCHANGE_NAME = "Guyana Association of Securities Companies and Intermediaries Inc."
EXCHANGE_COUNTRY = "Guyana"
EXCHANGE_WEBSITE = "https://guyanastockexchangeinc.com/"
EXCHANGE_CURRENCY = "GYD"

# Fetching Configurations
HTTP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}
REQUEST_DELAY_SEC = 0.5  # Polite delay between live web requests

# Stable Internal Security Slugs/Mnemonics fallback mapping (if name matching or ticker mapping is needed)
SYMBOL_CLEAN_MAPPING = {
    "banks dih holdings inc.": "BDH",
    "banks dih limited": "DIH",
    "caribbean container incorporated": "CCI",
    "citizens bank guyana incorporated": "CBI",
    "city jewelers and pawnbrokers limited": "CJL",
    "demerara bank limited": "DBL",
    "demerara distillers limited": "DDL",
    "demerara tobacco company limited": "DTC",
    "globe trust & investment company limited": "GTI",
    "globe trust investment company limited": "GTI",
    "guyana bank for trade and industry limited": "BTI",
    "guyana national cooperative bank": "GNC",
    "guyana stockfeeds incorporated": "GSI",
    "humphrey & company limited": "HCL",
    "humphrey company limited": "HCL",
    "j.p. santos & company limited": "JPS",
    "j.p. santos company limited": "JPS",
    "national bank of industry & commerce ltd": "NBI",
    "national bank of industry commerce ltd": "NBI",
    "property holdings incorporated": "PHI",
    "republic bank (guyana) limited": "RBL",
    "republic bank guyana limited": "RBL",
    "rupununi development company limited": "RDL",
    "sterling products limited": "SPL",
    "trinidad cement limited": "TCL",
}
