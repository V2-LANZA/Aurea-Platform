from typing import Sequence

REASON_LABELS = {
    "ask_age": "Asked for age",
    "secrecy": "Encouraged secrecy",
    "ask_pics": "Requested photos or nudes",
    "meet_alone": "Suggested meeting alone",
    "location": "Asked for location or school",
    "sexual_terms": "Used sexual language",
}


def humanize_reasons(reasons: Sequence[str]) -> list[str]:
    return [REASON_LABELS.get(r, r.replace("_", " ").title()) for r in reasons]


def build_alert_detail(reasons: Sequence[str]) -> str:
    labels = humanize_reasons(reasons)
    if not labels:
        return "Potential safety risk detected."
    return "This message was flagged because it may involve: " + ", ".join(labels) + "."


def build_bot_reply(content: str, score: float, reasons: Sequence[str]) -> str | None:
    text = (content or "").strip().lower()
    reason_set = set(reasons or [])

    if text == "/help":
        return (
            "Hello, I am Aurea Bot. Commands: /help. "
            "This chat is safety monitored. If a message looks suspicious, I may step in."
        )

    if score < 0.3:
        return None

    if "ask_pics" in reason_set and "sexual_terms" in reason_set:
        return (
            "Aurea Bot: This message may be asking for sexual or explicit images. "
            "Please do not share personal or unsafe content."
        )

    if "location" in reason_set:
        return (
            "Aurea Bot: This message may be asking for personal location or school details. "
            "Be careful with private information."
        )

    if "secrecy" in reason_set:
        return (
            "Aurea Bot: This message may be encouraging secrecy from trusted adults. "
            "Please stay safe and seek support if needed."
        )

    if "meet_alone" in reason_set:
        return (
            "Aurea Bot: This message may suggest an unsafe private meeting. "
            "Please avoid arrangements that put you at risk."
        )

    if "ask_age" in reason_set:
        return (
            "Aurea Bot: This message may involve unnecessary personal questioning. "
            "Be careful with private details."
        )

    if "sexual_terms" in reason_set:
        return (
            "Aurea Bot: This message may contain inappropriate sexual language. "
            "Please keep the conversation respectful and safe."
        )

    return (
        "Aurea Bot: This message was flagged as a possible safety concern. "
        "Please use caution and keep the conversation safe."
    )