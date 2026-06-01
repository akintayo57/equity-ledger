import re
from gasci_collector.config import SYMBOL_CLEAN_MAPPING

def normalize_company_name(name: str) -> str:
    """
    Clean and normalize company names:
    - Trim whitespace
    - Collapse repeated spaces
    - Standardize punctuation and suffixes (e.g., & -> and, Ltd -> Limited)
    """
    if not name:
        return ""
        
    # Standardize casing to lowercase for cleaning
    cleaned = name.lower().strip()
    
    # Collapse multiple spaces
    cleaned = re.sub(r'\s+', ' ', cleaned)
    
    # Standardize abbreviations and punctuation
    cleaned = cleaned.replace(" & ", " and ")
    
    # Standardize common suffixes
    # Use word boundary checks
    cleaned = re.sub(r'\bltd\b\.?', 'limited', cleaned)
    cleaned = re.sub(r'\binc\b\.?', 'incorporated', cleaned)
    cleaned = re.sub(r'\bcorp\b\.?', 'corporation', cleaned)
    cleaned = re.sub(r'\bco\b\.?', 'company', cleaned)
    
    # Remove any stray punctuation (like trailing periods or double spacing)
    cleaned = cleaned.strip()
    return cleaned

def generate_symbol_slug(normalized_name: str) -> str:
    """
    Derive a stable 3-4 character symbol slug from a normalized company name.
    Checks the mapping config first.
    """
    # 1. Check if mapping exists
    if normalized_name in SYMBOL_CLEAN_MAPPING:
        return SYMBOL_CLEAN_MAPPING[normalized_name].upper()
        
    # Also check if original name mapped (reverse lookup helper)
    # 2. Extract initials
    words = [w for w in normalized_name.split() if w not in ("and", "the", "of", "limited", "incorporated", "corporation")]
    
    if len(words) >= 3:
        slug = "".join(w[0] for w in words[:4])
    elif len(words) == 2:
        slug = words[0][:2] + words[1][:2]
    elif len(words) == 1:
        slug = words[0][:4]
    else:
        slug = "UNK"
        
    return slug.upper()
