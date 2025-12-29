"""
URL parsing and expiry time helpers for signed URLs.
"""
import re
import time
import datetime as dt
from urllib.parse import urlparse, parse_qs


def parse_expiry_sleep_seconds(signed_url: str) -> int | None:
    """
    Parse expiry from signed URL query params.
    
    Supports formats:
    - Unix timestamp: Expires, exp, expiry, expireAt, expire_at
    - AWS style: X-Amz-Date + X-Amz-Expires (TTL)
    
    Returns seconds to sleep until URL expires (+2s buffer), or None if unparseable.
    """
    try:
        qs = parse_qs(urlparse(signed_url).query)
        
        # Try Unix timestamp fields
        timestamp_fields = ["expires", "Expires", "exp", "expiry", "expireAt", "expire_at"]
        for k in timestamp_fields:
            if k in qs and qs[k]:
                val = qs[k][0]
                if re.fullmatch(r"\d{10}", val):
                    exp_ts = int(val)
                    now = int(time.time())
                    return max(0, (exp_ts - now) + 2)

        # Try AWS style: X-Amz-Date + X-Amz-Expires
        amz_date = _get_query_param(qs, ["X-Amz-Date", "x-amz-date"])
        amz_expires = _get_query_param(qs, ["X-Amz-Expires", "x-amz-expires"])

        if amz_date and amz_expires and re.fullmatch(r"\d+", amz_expires):
            start = dt.datetime.strptime(amz_date, "%Y%m%dT%H%M%SZ")
            start = start.replace(tzinfo=dt.timezone.utc)
            start_ts = int(start.timestamp())
            ttl = int(amz_expires)
            exp_ts = start_ts + ttl
            now = int(time.time())
            return max(0, (exp_ts - now) + 2)

    except Exception:
        return None

    return None


def _get_query_param(qs: dict, keys: list[str]) -> str | None:
    """Get first matching query param from list of possible keys."""
    for k in keys:
        if k in qs and qs[k]:
            return qs[k][0]
    return None


def strip_query(url: str) -> str:
    """Remove query string from URL."""
    p = urlparse(url)
    return p._replace(query="").geturl()


def guess_sleep_until_expired(fallback_seconds: int, signed_url: str) -> int:
    """
    Estimate sleep time until signed URL expires.
    Uses parsed expiry if available, otherwise falls back to default.
    """
    s = parse_expiry_sleep_seconds(signed_url)
    return s if (s is not None and s <= 180) else fallback_seconds
