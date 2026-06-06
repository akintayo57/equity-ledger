import os
from unittest.mock import patch, MagicMock
from pathlib import Path
import pytest

from gasci_collector.fetch import get_cache_filename as gasci_get_cache_filename, fetch_url as gasci_fetch_url
from bse_collector.fetch import get_cache_filename as bse_get_cache_filename, fetch_url as bse_fetch_url

def test_gasci_get_cache_filename():
    assert gasci_get_cache_filename("https://guyanastockexchangeinc.com/trade_session/1174/") == "trade_session_1174.html"
    assert gasci_get_cache_filename("https://guyanastockexchangeinc.com/security/banks-dih/") == "security_banks_dih.html"
    assert gasci_get_cache_filename("https://guyanastockexchangeinc.com/") == "homepage.html"

def test_bse_get_cache_filename():
    assert bse_get_cache_filename("http://bse.com.bb/report?tradeDate=2026-05-28") == "bse_report_2026-05-28.csv"
    assert bse_get_cache_filename("http://bse.com.bb/report") == "bse_report_unknown.csv"

@patch("gasci_collector.fetch.requests.get")
@patch("gasci_collector.fetch.time.sleep") # mock sleep to avoid delay in tests
def test_gasci_fetch_url_uncached_and_cached(mock_sleep, mock_get, tmp_path):
    # Setup mock response for uncached fetch
    mock_response = MagicMock()
    mock_response.text = "<html>GASCI Content</html>"
    mock_response.status_code = 200
    mock_get.return_value = mock_response

    url = "https://guyanastockexchangeinc.com/trade_session/1174/"
    
    # 1. Fetch uncached (should make HTTP call and write to cache)
    content, content_hash, local_path = gasci_fetch_url(url, raw_dir=tmp_path)
    
    assert content == "<html>GASCI Content</html>"
    assert content_hash is not None
    assert local_path.is_file()
    mock_get.assert_called_once()
    
    # Reset mock_get call count
    mock_get.reset_mock()
    
    # 2. Fetch cached (should load from file without HTTP call)
    content_cached, content_hash_cached, local_path_cached = gasci_fetch_url(url, raw_dir=tmp_path)
    
    assert content_cached == "<html>GASCI Content</html>"
    assert content_hash_cached == content_hash
    assert local_path_cached == local_path
    mock_get.assert_not_called()

@patch("bse_collector.fetch.requests.get")
@patch("bse_collector.fetch.time.sleep")
def test_bse_fetch_url_uncached_and_cached(mock_sleep, mock_get, tmp_path):
    mock_response = MagicMock()
    mock_response.text = "Main\nSecurity,Trade Date\nGEL,2026-05-28"
    mock_response.status_code = 200
    mock_get.return_value = mock_response

    url = "http://bse.com.bb/report?tradeDate=2026-05-28"
    
    # 1. Uncached fetch
    content, local_path = bse_fetch_url(url, raw_dir=tmp_path)
    
    assert "GEL,2026-05-28" in content
    assert local_path.is_file()
    mock_get.assert_called_once()
    
    mock_get.reset_mock()
    
    # 2. Cached fetch
    content_cached, local_path_cached = bse_fetch_url(url, raw_dir=tmp_path)
    
    assert "GEL,2026-05-28" in content_cached
    assert local_path_cached == local_path
    mock_get.assert_not_called()
