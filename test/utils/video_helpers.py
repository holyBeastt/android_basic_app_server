"""
Video URL extraction helpers.
"""
from .json_helpers import json_get, find_first_url_like


def extract_signed_video_url(cfg: dict, lesson_json: dict) -> str:
    """
    Extract signed video URL from lesson JSON response.
    
    First tries the configured VIDEO_URL_JSON_FIELD.
    Falls back to auto-detecting URL-like strings in JSON.
    """
    # Try configured field first
    video_field = cfg.get("video_url_json_field")
    if video_field:
        if "." in video_field:
            val = json_get(lesson_json, video_field)
        else:
            val = lesson_json.get(video_field)
        
        if isinstance(val, str) and _is_url(val):
            return val

    # Auto-detect URL in JSON
    val = find_first_url_like(lesson_json)
    assert val, "Could not find any URL-like field in lesson JSON. Set VIDEO_URL_JSON_FIELD in .env."
    return val


def _is_url(s: str) -> bool:
    """Check if string looks like a URL."""
    return s.startswith("http://") or s.startswith("https://")
