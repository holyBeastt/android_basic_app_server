"""
Pytest configuration and fixtures for API security testing.
"""
import pytest
from dotenv import load_dotenv

from utils import (
    env,
    maybe_env,
    login,
    fetch_lesson,
    extract_signed_video_url,
    strip_query,
    guess_sleep_until_expired,
    http_get,
)


# ============================================================
# CONFIGURATION FIXTURE
# ============================================================

@pytest.fixture(scope="session")
def cfg():
    """
    Load test configuration from environment variables.
    Returns a dict with all necessary config for tests.
    """
    load_dotenv(override=True)
    base_url = env("BASE_URL").rstrip("/")
    timeout = float(env("HTTP_TIMEOUT_SECONDS", "15"))

    return {
        # Server
        "base_url": base_url,
        "timeout": timeout,
        
        # Login config
        "login_path": env("LOGIN_PATH"),
        "login_email_field": env("LOGIN_EMAIL_FIELD", "username"),
        "login_password_field": env("LOGIN_PASSWORD_FIELD", "password"),
        "token_json_field": env("TOKEN_JSON_FIELD", "accessToken"),
        
        # Lesson config
        "lesson_path": env("LESSON_PATH"),
        "lesson_id": env("LESSON_ID"),
        "video_url_json_field": maybe_env("VIDEO_URL_JSON_FIELD"),
        
        # Expiry config
        "expiry_fallback_sleep": int(env("EXPIRY_FALLBACK_SLEEP_SECONDS", "70")),
    }


# ============================================================
# USER TOKEN FIXTURES
# ============================================================

@pytest.fixture(scope="session")
def token_user_a(cfg):
    """
    Get access token for User A.
    User A should have access to the test lesson.
    """
    email = env("USER_A_EMAIL")
    password = env("USER_A_PW")
    return login(cfg, email, password)


@pytest.fixture(scope="session")
def token_user_b(cfg):
    """
    Get access token for User B.
    User B should NOT have access to User A's lessons (for IDOR testing).
    """
    email = env("USER_B_EMAIL")
    password = env("USER_B_PW")
    return login(cfg, email, password)


# ============================================================
# RE-EXPORT HELPER FUNCTIONS FOR TESTS
# ============================================================

# These are re-exported so tests can import directly from conftest
__all__ = [
    "fetch_lesson",
    "extract_signed_video_url",
    "strip_query",
    "guess_sleep_until_expired",
    "http_get",
]
