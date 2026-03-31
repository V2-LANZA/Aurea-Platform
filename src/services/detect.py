import re

PATTERNS = {
    "ask_age": r"\b(how old are you|what is your age)\b",
    "secrecy": r"\b(keep this between us|don't tell (?:your )?(?:parents|mom|dad)|keep it secret)\b",
    "ask_pics": r"\b(send (?:pics?|photos?|pictures?|nudes?|images?))\b",
    "meet_alone": r"\b(meet (?:alone|in secret)|come alone)\b",
    "location": r"\b(where do you live|what school do you go to|where are you from|what is your address)\b",
    "sexual_terms": r"\b(nude|nudes|naked|sex|sexual|naughty)\b",
}

RX = {k: re.compile(v, re.I) for k, v in PATTERNS.items()}


def analyze(text: str) -> tuple[float, list[str]]:
    """Return (score 0..1, list_of_reason_keys) for a message."""
    hits = [k for k, rx in RX.items() if rx.search(text or "")]
    score = min(1.0, len(hits) / 3.0)
    return score, hits