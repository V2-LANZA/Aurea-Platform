from typing import Sequence

REASON_LABELS = {
    "ask_age": "Asked for age",
    "secrecy": "Encouraged secrecy",
    "ask_pics": "Requested photos or nudes",
    "meet_alone": "Suggested meeting alone",
    "location": "Asked for location or school",
    "sexual_terms": "Used sexual language",
    "self_harm_encouragement": "Encouraged self-harm",
    "violent_threat": "Made a violent threat",
    "harassment": "Used abusive harassment",
    "hate_speech": "Used hateful language",
}


def humanize_reasons(reasons: Sequence[str]) -> list[str]:
    return [REASON_LABELS.get(reason, reason.replace("_", " ").title()) for reason in reasons]


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
            "Aurea Bot: This chat is safety monitored. I can explain warning signs, tell you how to report someone, and step in when a message looks unsafe."
        )

    if score < 0.3:
        return None

    if "self_harm_encouragement" in reason_set:
        return (
            "Aurea Bot: This message appears to encourage self-harm. "
            "Please stop. If someone is in immediate danger, contact a trusted adult or emergency support now."
        )

    if "violent_threat" in reason_set:
        return (
            "Aurea Bot: This message appears threatening or violent. "
            "Threats are not allowed here and this conversation may need moderator review."
        )

    if "hate_speech" in reason_set:
        return (
            "Aurea Bot: This message may contain hateful or discriminatory language. "
            "Please keep this space respectful and safe for everyone."
        )

    if "harassment" in reason_set:
        return (
            "Aurea Bot: This message may be abusive or bullying. "
            "Please stop and keep the conversation respectful."
        )

    if "ask_pics" in reason_set and "sexual_terms" in reason_set:
        return (
            "Aurea Bot: This message may be asking for sexual or explicit images. "
            "Do not share personal or unsafe content."
        )

    if "location" in reason_set:
        return (
            "Aurea Bot: This message may be asking for private location or school details. "
            "Be careful with personal information."
        )

    if "secrecy" in reason_set:
        return (
            "Aurea Bot: This message may be encouraging secrecy from trusted adults. "
            "That can be a warning sign, so please stay cautious."
        )

    if "meet_alone" in reason_set:
        return (
            "Aurea Bot: This message may suggest an unsafe private meeting. "
            "Avoid offline plans that put you at risk."
        )

    if "ask_age" in reason_set:
        return (
            "Aurea Bot: This message may involve unnecessary personal questioning. "
            "You do not have to share private details."
        )

    if "sexual_terms" in reason_set:
        return (
            "Aurea Bot: This message may contain inappropriate sexual language. "
            "Please keep this conversation safe and respectful."
        )

    return (
        "Aurea Bot: This message was flagged as a possible safety concern. "
        "Please slow down and keep the conversation safe."
    )
