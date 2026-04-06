import re

RULES: dict[str, dict[str, object]] = {
    "ask_age": {
        "weight": 0.28,
        "patterns": [
            r"\bhow old are you\b",
            r"\bwhat(?:'s| is) your age\b",
            r"\bare you (?:under|over) \d{1,2}\b",
        ],
    },
    "secrecy": {
        "weight": 0.38,
        "patterns": [
            r"\bkeep this between us\b",
            r"\bkeep it secret\b",
            r"\bdon't tell (?:your )?(?:parents|mum|mom|dad|teacher|guardian)\b",
            r"\bour little secret\b",
        ],
    },
    "ask_pics": {
        "weight": 0.52,
        "patterns": [
            r"\bsend (?:pics?|photos?|pictures?|images?)\b",
            r"\bshow me your body\b",
            r"\bsend nudes?\b",
            r"\bturn on your camera\b",
        ],
    },
    "meet_alone": {
        "weight": 0.48,
        "patterns": [
            r"\bmeet (?:alone|me alone|in secret)\b",
            r"\bcome alone\b",
            r"\bsneak out\b",
            r"\blet's meet up\b",
        ],
    },
    "location": {
        "weight": 0.42,
        "patterns": [
            r"\bwhere do you live\b",
            r"\bwhat school do you go to\b",
            r"\bwhere are you from\b",
            r"\bwhat(?:'s| is) your address\b",
            r"\bsend me your location\b",
        ],
    },
    "sexual_terms": {
        "weight": 0.34,
        "patterns": [
            r"\bnude|nudes|naked\b",
            r"\bsex(?:ual)?\b",
            r"\bhot pics?\b",
            r"\bturn me on\b",
        ],
    },
    "self_harm_encouragement": {
        "weight": 0.9,
        "patterns": [
            r"\bkill yourself\b",
            r"\bgo kill yourself\b",
            r"\bgo die\b",
            r"\byou should die\b",
            r"\bend your life\b",
        ],
    },
    "violent_threat": {
        "weight": 0.85,
        "patterns": [
            r"\bi(?:'| a)?ll kill you\b",
            r"\bi want to kill you\b",
            r"\bi(?:'| a)?ll hurt you\b",
            r"\bi(?:'| a)?ll beat you\b",
            r"\bi(?:'| a)?ll find you\b",
        ],
    },
    "harassment": {
        "weight": 0.44,
        "patterns": [
            r"\bfuck you\b",
            r"\bi hate you\b",
            r"\byou(?:'re| are) (?:stupid|ugly|worthless|pathetic|disgusting|annoying)\b",
            r"\bidiot\b",
            r"\bdumbass\b",
            r"\basshole\b",
            r"\bbitch\b",
            r"\bslut\b",
            r"\bloser\b",
        ],
    },
    "hate_speech": {
        "weight": 0.82,
        "patterns": [
            r"\b(?:racist|terrorist) pig\b",
            r"\b(?:go back to your country)\b",
            r"\byou people are\b",
            r"\b(?:fag|retard)\b",
        ],
    },
}

RX = {
    key: [re.compile(pattern, re.I) for pattern in value["patterns"]]
    for key, value in RULES.items()
}

TOKEN_MAP = {
    "u": "you",
    "ur": "your",
    "r": "are",
    "yrs": "years",
    "yo": "years old",
    "yrsold": "years old",
    "w": "where",
    "abt": "about",
    "addr": "address",
    "loc": "location",
}

FUZZY_PATTERNS: dict[str, list[re.Pattern[str]]] = {
    "ask_age": [
        re.compile(r"\bage\b", re.I),
        re.compile(r"\basl\b", re.I),
        re.compile(r"\bhow old (?:are|r) you\b", re.I),
    ],
    "location": [
        re.compile(r"\bwhere do you live\b", re.I),
        re.compile(r"\bwhere you live\b", re.I),
        re.compile(r"\bwhat is your address\b", re.I),
        re.compile(r"\bsend me your location\b", re.I),
    ],
    "self_harm_encouragement": [
        re.compile(r"\bk\s*[i1!\*]?\s*l+\s*l+\s*(?:yourself|urself|u?rself)\b", re.I),
        re.compile(r"\bkys\b", re.I),
    ],
    "harassment": [
        re.compile(r"\bf\s*u\s*c\s*k+\s+you\b", re.I),
        re.compile(r"\bi\s+hate\s+you\b", re.I),
    ],
}


def _normalize_text(text: str) -> str:
    lowered = (text or "").strip().lower()
    if not lowered:
        return ""

    lowered = lowered.replace("*", "i")
    lowered = lowered.replace("0", "o").replace("1", "i").replace("3", "e").replace("@", "a")
    lowered = re.sub(r"[^\w\s]", " ", lowered)
    tokens = [TOKEN_MAP.get(token, token) for token in lowered.split()]
    return re.sub(r"\s+", " ", " ".join(tokens)).strip()


def analyze(text: str) -> tuple[float, list[str]]:
    normalized = _normalize_text(text)
    if not normalized:
        return 0.0, []

    hits: list[str] = []
    total = 0.0

    for key, matchers in RX.items():
        if any(matcher.search(normalized) for matcher in matchers):
            hits.append(key)
            total += float(RULES[key]["weight"])

    for key, matchers in FUZZY_PATTERNS.items():
        if key in hits:
            continue
        if any(matcher.search(normalized) for matcher in matchers):
            hits.append(key)
            total += float(RULES[key]["weight"])

    score = min(1.0, total)
    return score, hits
