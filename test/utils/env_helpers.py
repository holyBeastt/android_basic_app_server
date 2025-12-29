"""
Environment variable helpers for test configuration.
"""
import os


def env(name: str, default: str | None = None) -> str:
    """
    Get required environment variable.
    Raises RuntimeError if not found.
    """
    v = os.getenv(name, default)
    if v is None or v == "":
        raise RuntimeError(f"Missing env var: {name}")
    return v


def maybe_env(name: str, default: str | None = None) -> str | None:
    """
    Get optional environment variable.
    Returns None if not found or empty.
    """
    v = os.getenv(name, default)
    return v if v not in (None, "") else None
