"""
Authentication and HTTP request helpers.
"""
import requests

from .env_helpers import env
from .json_helpers import json_get


def build_auth_header(token: str) -> dict:
    """Build Authorization header dict."""
    header_name = env("AUTH_HEADER", "Authorization")
    scheme = env("AUTH_SCHEME", "Bearer")
    return {header_name: f"{scheme} {token}"}


def login(cfg: dict, email: str, password: str) -> str:
    """
    Perform login and return access token.
    Raises AssertionError if login fails.
    """
    url = cfg["base_url"] + cfg["login_path"]
    payload = {
        cfg["login_email_field"]: email,
        cfg["login_password_field"]: password,
    }
    
    r = requests.post(url, json=payload, timeout=cfg["timeout"])
    assert r.status_code in (200, 201), f"Login failed: {r.status_code} {r.text[:300]}"
    
    data = r.json()
    token_field = cfg["token_json_field"]
    
    if "." in token_field:
        token = json_get(data, token_field)
    else:
        token = data.get(token_field)
    
    assert token, f"Token not found in response. Field={token_field} body={str(data)[:400]}"
    return token


def fetch_lesson(cfg: dict, token: str | None) -> requests.Response:
    """
    Fetch lesson data from API.
    Token is optional - allows testing unauthenticated access.
    """
    path = cfg["lesson_path"].replace("{LESSON_ID}", cfg["lesson_id"])
    url = cfg["base_url"] + path
    headers = build_auth_header(token) if token else {}
    return requests.get(url, headers=headers, timeout=cfg["timeout"])


def http_get(url: str, timeout: float) -> requests.Response:
    """Simple HTTP GET request."""
    return requests.get(url, timeout=timeout)
