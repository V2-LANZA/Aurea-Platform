# src/services/detect.py
import re



PATTERNS = {
    "ask_age":      r"\bhow old are you\b",
    "secrecy":      r"\b(keep this between us|don't tell (?:your )?(?:parents|mom|dad))\b",
    "ask_pics":     r"\bsend (?:pics?|photos?|pictures?)\b",
    "meet_alone":   r"\bmeet (?:alone|in secret)\b",
    "location":     r"\b(where do you live|what school do you go to)\b",
    "sexual_terms": r"\b(nude|naked|sex|naughty)\b",
}
RX = {k: re.compile(v, re.I) for k, v in PATTERNS.items()}

def analyze(text: str) -> tuple[float, list[str]]:
    """Return (score 0..1, list_of_reason_keys) for a message."""
    hits = [k for k, rx in RX.items() if rx.search(text or "")]
    score = min(1.0, len(hits) / 3.0)
    return score, hits
