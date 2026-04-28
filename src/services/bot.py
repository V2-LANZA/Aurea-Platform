from typing import Sequence

BOT_USERNAME = "__aurea_bot__"
BOT_DISPLAY_NAME = "Aurea Safety Bot"
BOT_AVATAR_FALLBACK = None

REASON_LABELS = {
    "ask_age": "Asked for age",
    "secrecy": "Encouraged secrecy",
    "ask_pics": "Requested photos or nudes",
    "meet_alone": "Suggested meeting alone",
    "location": "Asked for location or school",
    "sexual_terms": "Used sexual language",
    "self_harm_encouragement": "Encouraged self-harm",
    "self_harm_distress": "Expressed self-harm distress",
    "violent_threat": "Made a violent threat",
    "harassment": "Used abusive harassment",
    "hate_speech": "Used hateful language",
    "repeated_pattern": "Repeated unsafe patterns detected",
}

REASON_CATEGORIES = {
    "ask_age": "age risk",
    "location": "location risk",
    "secrecy": "secrecy risk",
    "ask_pics": "photo/image risk",
    "meet_alone": "meeting risk",
    "harassment": "bullying or harassment",
    "hate_speech": "hate speech or discrimination",
    "violent_threat": "threat or intimidation",
    "self_harm_distress": "self-harm support",
    "repeated_pattern": "repeated pattern risk",
}

CATEGORY_ADVICE = {
    "age risk": "Please avoid sharing personal details such as your age, school, address, or live location.",
    "location risk": "Please avoid sharing personal details such as your age, school, address, or live location.",
    "secrecy risk": "Be cautious if someone asks you to keep the conversation secret from trusted adults.",
    "photo/image risk": "Do not send private images. You can report or mute anyone pressuring you.",
    "meeting risk": "Do not agree to meet someone privately or alone.",
    "bullying or harassment": "Aurea Bot noticed hurtful or bullying language. You do not have to reply to messages that make you uncomfortable.",
    "hate speech or discrimination": "Aurea Bot noticed discriminatory language. This conversation may be unsafe or harmful.",
    "threat or intimidation": "Aurea Bot noticed threatening language. If you feel unsafe, leave the chat and speak to a trusted adult or moderator.",
    "self-harm support": "You are not in trouble. If you might hurt yourself, contact emergency services or speak to a trusted adult immediately.",
    "repeated pattern risk": "Aurea has detected repeated unsafe patterns in this conversation. Please be careful and consider reporting the conversation.",
    "other/general risk": "Safety reminder: this conversation may be crossing a safety boundary. Pause, stay cautious, and ask for help if needed.",
}

STRONGER_CATEGORY_PREFIXES = {
    "age risk",
    "location risk",
    "secrecy risk",
    "photo/image risk",
    "meeting risk",
    "repeated pattern risk",
}

KNOWN_ALERT_CATEGORIES = [
    "age risk",
    "location risk",
    "secrecy risk",
    "photo/image risk",
    "meeting risk",
    "bullying or harassment",
    "hate speech or discrimination",
    "threat or intimidation",
    "self-harm support",
    "repeated pattern risk",
    "other/general risk",
]


def humanize_reasons(reasons: Sequence[str]) -> list[str]:
    return [REASON_LABELS.get(reason, reason.replace("_", " ").title()) for reason in reasons]


def primary_category_for_reasons(reasons: Sequence[str]) -> list[str]:
    categories: list[str] = []
    for reason in reasons:
        category = REASON_CATEGORIES.get(reason)
        if category and category not in categories:
            categories.append(category)

    if categories:
        return categories

    if reasons:
        return ["other/general risk"]

    return []


def build_alert_detail(reasons: Sequence[str], *, categories: Sequence[str] | None = None) -> str:
    labels = humanize_reasons(reasons)
    if not labels:
        return "Potential safety risk detected."
    category_text = ""
    if categories:
        category_text = " Categories: " + ", ".join(categories) + "."
    return "This message was flagged because it may involve: " + ", ".join(labels) + "." + category_text


def build_cumulative_alert_detail(reasons: Sequence[str]) -> str:
    labels = humanize_reasons(reasons)
    if labels:
        return (
            "Aurea detected repeated unsafe patterns across recent messages in this group. "
            "Recent signals included: " + ", ".join(labels) + "."
        )
    return "Aurea detected repeated unsafe patterns across recent messages in this group."


def categories_from_alert_text(*values: str | None) -> list[str]:
    haystack = " ".join(value.lower() for value in values if value).strip()
    if not haystack:
        return ["other/general risk"]

    categories = [category for category in KNOWN_ALERT_CATEGORIES if category in haystack]
    if categories:
        return categories

    return ["other/general risk"]

def build_bot_reply(
    content: str,
    score: float,
    reasons: Sequence[str],
    *,
    severity: str | None = None,
    cumulative_triggered: bool = False,
    categories: Sequence[str] | None = None,
) -> str | None:
    text = (content or "").strip().lower()
    reason_set = set(reasons or [])
    category_list = list(categories or primary_category_for_reasons(reasons))
    primary_category = category_list[0] if category_list else "other/general risk"

    if text == "/help":
        return (
            f"{BOT_DISPLAY_NAME}: This chat is safety monitored. I can explain warning signs, tell you how to report someone, and step in when a message looks unsafe."
        )

    if cumulative_triggered:
        return f"{BOT_DISPLAY_NAME}: {CATEGORY_ADVICE['repeated pattern risk']}"

    if score < 0.3:
        return None

    if "self_harm_encouragement" in reason_set:
        return (
            f"{BOT_DISPLAY_NAME}: This message appears to encourage self-harm. "
            "Please stop. If someone is in immediate danger, contact a trusted adult or emergency support now."
        )

    if "self_harm_distress" in reason_set:
        return (
            f"{BOT_DISPLAY_NAME}: I’m really sorry you’re feeling this way. "
            "You are not in trouble. Please reach out to someone nearby now."
        )

    if "violent_threat" in reason_set:
        return f"{BOT_DISPLAY_NAME}: {CATEGORY_ADVICE['threat or intimidation']}"

    if "hate_speech" in reason_set:
        return f"{BOT_DISPLAY_NAME}: {CATEGORY_ADVICE['hate speech or discrimination']}"

    if "harassment" in reason_set:
        return f"{BOT_DISPLAY_NAME}: {CATEGORY_ADVICE['bullying or harassment']}"

    if "sexual_terms" in reason_set:
        return (
            f"{BOT_DISPLAY_NAME}: This message may contain inappropriate sexual language. "
            "Please keep this conversation safe and respectful."
        )

    advice = CATEGORY_ADVICE.get(primary_category, CATEGORY_ADVICE["other/general risk"])
    if primary_category in STRONGER_CATEGORY_PREFIXES or severity == "high":
        return f"{BOT_DISPLAY_NAME}: Please pause and take care. {advice}"

    return f"{BOT_DISPLAY_NAME}: {advice}"
