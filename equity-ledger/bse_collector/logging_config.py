import logging
import json
import sys
from datetime import datetime

class StructuredFormatter(logging.Formatter):
    """
    Custom formatter that outputs log records as structured JSON or clean text.
    """
    def __init__(self, use_json=False):
        super().__init__()
        self.use_json = use_json

    def format(self, record):
        log_data = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        # Include exception info if available
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
            
        if self.use_json:
            return json.dumps(log_data)
        
        # Clean text format for CLI visibility
        prefix = ""
        if record.levelno >= logging.ERROR:
            prefix = "[ERROR] "
        elif record.levelno >= logging.WARNING:
            prefix = "[WARNING] "
        elif record.levelno >= logging.INFO:
            prefix = "" # Suppress info prefix to keep output clean
            
        return f"{prefix}{log_data['message']}"

def setup_logging(verbose=False, use_json=False):
    """
    Configures the root logger with the structured formatter.
    """
    root_logger = logging.getLogger()
    
    # Avoid duplicate handlers if setup_logging is called twice
    if root_logger.handlers:
        for handler in list(root_logger.handlers):
            root_logger.removeHandler(handler)
            
    level = logging.DEBUG if verbose else logging.INFO
    root_logger.setLevel(level)

    handler = logging.StreamHandler(sys.stderr)
    formatter = StructuredFormatter(use_json=use_json)
    handler.setFormatter(formatter)
    root_logger.addHandler(handler)
