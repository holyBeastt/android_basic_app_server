"""
JSON parsing and URL extraction helpers.
"""


def json_get(obj, keypath: str):
    """
    Access nested JSON using dot notation.
    Example: json_get(data, "user.profile.name")
    """
    cur = obj
    for k in keypath.split("."):
        if isinstance(cur, dict) and k in cur:
            cur = cur[k]
        else:
            return None
    return cur


def find_first_url_like(obj) -> str | None:
    """
    Recursively search JSON to find URL-like strings (http/https).
    Prioritizes URLs with signed query params (sig/expires/token).
    """
    urls = []

    def walk(x):
        if isinstance(x, dict):
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)
        elif isinstance(x, str):
            if x.startswith("http://") or x.startswith("https://"):
                urls.append(x)

    walk(obj)

    if not urls:
        return None

    def score(u: str) -> int:
        q = u.lower()
        s = 0
        signed_keywords = [
            "sig", "signature", "expires", "exp", 
            "token", "x-amz-signature", "x-amz-expires"
        ]
        for kw in signed_keywords:
            if kw in q:
                s += 5
        if ".m3u8" in q:
            s += 2
        if ".mp4" in q:
            s += 1
        return s

    urls.sort(key=score, reverse=True)
    return urls[0]
