import os
from pathlib import Path

from fastapi.testclient import TestClient

os.environ["AUREA_DB_URL"] = f"sqlite:///{Path(__file__).resolve().parent / 'test_moderation.db'}"

from src.app import app
from src.db import Base, SessionLocal, engine
from src.services.messages_service import reset_runtime_state


client = TestClient(app)


def setup_function() -> None:
    reset_runtime_state()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def teardown_function() -> None:
    reset_runtime_state()
    Base.metadata.drop_all(bind=engine)


def register_and_login(username: str, *, admin: bool = False) -> dict[str, str]:
    password = "Password123!"
    payload = {
        "username": username,
        "email": f"{username}@example.com",
        "date_of_birth": "2008-05-01",
        "password": password,
    }
    if admin:
        payload["admin_setup_key"] = "Charizard"

    register_res = client.post("/auth/register", json=payload)
    assert register_res.status_code == 201, register_res.text

    login_res = client.post(
        "/auth/login",
        json={"username": username, "password": password},
    )
    assert login_res.status_code == 200, login_res.text
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_group(headers: dict[str, str], name: str = "Test Group") -> int:
    response = client.post("/groups", json={"name": name}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def get_group_invite_code(group_id: int, headers: dict[str, str]) -> str:
    response = client.get(f"/groups/{group_id}", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["invite_code"]


def join_group(group_id: int, headers: dict[str, str], owner_headers: dict[str, str]) -> None:
    invite_code = get_group_invite_code(group_id, owner_headers)
    response = client.post("/groups/join", json={"invite_code": invite_code}, headers=headers)
    assert response.status_code == 200, response.text


def post_message(group_id: int, headers: dict[str, str], content: str):
    response = client.post(
        f"/groups/{group_id}/messages",
        json={"content": content},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response


def list_group_messages(group_id: int, headers: dict[str, str]) -> list[dict]:
    response = client.get(f"/groups/{group_id}/messages", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def list_group_alerts(group_id: int, headers: dict[str, str]) -> list[dict]:
    response = client.get(f"/alerts?group_id={group_id}", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def latest_bot_message(messages: list[dict]) -> dict:
    return [item for item in messages if item["username"] == "__aurea_bot__"][-1]


def test_single_location_message_creates_location_alert_and_bot_advice():
    headers = register_and_login("location_user")
    group_id = create_group(headers)

    post_message(group_id, headers, "Where do you live? Send me your location.")

    alerts = list_group_alerts(group_id, headers)
    assert alerts[0]["category"] == "location risk"
    assert alerts[0]["severity"] == "medium"

    bot_message = latest_bot_message(list_group_messages(group_id, headers))
    assert "do not share your address, school, or live location" in bot_message["content"].lower()


def test_secrecy_message_creates_secrecy_alert_and_bot_advice():
    headers = register_and_login("secret_user")
    group_id = create_group(headers)

    post_message(group_id, headers, "Keep this between us and don't tell your parents.")

    alerts = list_group_alerts(group_id, headers)
    assert alerts[0]["category"] == "secrecy risk"

    bot_message = latest_bot_message(list_group_messages(group_id, headers))
    assert "hide a conversation" in bot_message["content"].lower()


def test_photo_request_creates_photo_alert_and_bot_advice():
    headers = register_and_login("photo_user")
    group_id = create_group(headers)

    post_message(group_id, headers, "Send pics and turn on your camera.")

    alerts = list_group_alerts(group_id, headers)
    assert alerts[0]["category"] == "photo/image risk"

    bot_message = latest_bot_message(list_group_messages(group_id, headers))
    assert "do not send private images or personal photos" in bot_message["content"].lower()


def test_cumulative_risk_escalates_to_high_severity_when_threshold_is_reached():
    headers = register_and_login("pattern_user")
    group_id = create_group(headers)

    post_message(group_id, headers, "How old are you?")
    post_message(group_id, headers, "Where do you live?")
    post_message(group_id, headers, "Keep this between us.")

    alerts = list_group_alerts(group_id, headers)
    assert any(alert["category"] == "repeated pattern risk" for alert in alerts)
    assert any(alert["severity"] == "high" for alert in alerts)

    bot_message = latest_bot_message(list_group_messages(group_id, headers))
    assert "repeated unsafe patterns" in bot_message["content"].lower()


def test_bot_cooldown_prevents_repeated_spam_messages_in_same_group():
    headers = register_and_login("cooldown_user")
    group_id = create_group(headers)

    post_message(group_id, headers, "Where do you live?")
    post_message(group_id, headers, "Keep it secret.")

    messages = list_group_messages(group_id, headers)
    bot_messages = [item for item in messages if item["username"] == "__aurea_bot__"]
    assert len(bot_messages) == 1


def test_high_severity_alert_bypasses_bot_cooldown():
    headers = register_and_login("high_user")
    group_id = create_group(headers)

    post_message(group_id, headers, "Where do you live?")
    post_message(group_id, headers, "Go kill yourself.")

    messages = list_group_messages(group_id, headers)
    bot_messages = [item for item in messages if item["username"] == "__aurea_bot__"]
    assert len(bot_messages) == 2
    assert "encourage self-harm" in bot_messages[-1]["content"].lower()


def test_admin_dashboard_summary_counts_alerts_correctly():
    user_headers = register_and_login("summary_user")
    admin_headers = register_and_login("summary_admin", admin=True)
    group_id = create_group(user_headers)

    post_message(group_id, user_headers, "Where do you live?")
    post_message(group_id, user_headers, "Send pics.")

    alerts = list_group_alerts(group_id, user_headers)
    first_alert_id = alerts[-1]["id"]

    review_res = client.patch(
        f"/admin/alerts/{first_alert_id}/review",
        json={"admin_note": "Reviewed in test"},
        headers=admin_headers,
    )
    assert review_res.status_code == 200, review_res.text

    dashboard_res = client.get("/admin/dashboard", headers=admin_headers)
    assert dashboard_res.status_code == 200, dashboard_res.text
    dashboard = dashboard_res.json()

    assert dashboard["total_messages"] >= 4
    assert dashboard["total_flagged_messages"] == 2
    assert dashboard["total_alerts"] == 2
    assert dashboard["alerts_by_severity"]["medium"] >= 2
    assert dashboard["alerts_by_category"]["location risk"] == 1
    assert dashboard["alerts_by_category"]["photo/image risk"] == 1
    assert dashboard["review_status_counts"]["reviewed"] == 1
    assert dashboard["review_status_counts"]["pending_review"] == 1
    assert dashboard["average_response_time_seconds"] is not None


def test_personal_mute_only_hides_messages_for_muting_user_in_same_group():
    user_a_headers = register_and_login("mute_owner")
    user_b_headers = register_and_login("mute_target")
    group_id = create_group(user_a_headers)
    join_group(group_id, user_b_headers, user_a_headers)

    post_message(group_id, user_b_headers, "Hello from user B")

    mute_res = client.post(
        f"/groups/{group_id}/mutes",
        json={"muted_user_id": 2},
        headers=user_a_headers,
    )
    assert mute_res.status_code == 201, mute_res.text

    mutes_res = client.get(f"/groups/{group_id}/mutes", headers=user_a_headers)
    assert mutes_res.status_code == 200, mutes_res.text
    assert mutes_res.json()[0]["muted_user_id"] == 2

    other_view_res = client.get(f"/groups/{group_id}/mutes", headers=user_b_headers)
    assert other_view_res.status_code == 200, other_view_res.text
    assert other_view_res.json() == []


def test_group_restriction_blocks_only_group_sending_and_reports_are_visible_to_admin():
    reporter_headers = register_and_login("reporter_user")
    target_headers = register_and_login("report_target")
    admin_headers = register_and_login("report_admin", admin=True)
    group_id = create_group(reporter_headers)
    join_group(group_id, target_headers, reporter_headers)

    target_message = post_message(group_id, target_headers, "Keep this a secret.")
    message_id = target_message.json()["id"]

    report_res = client.post(
        "/reports",
        json={
            "reported_user_id": 2,
            "group_id": group_id,
            "message_id": message_id,
            "reason": "Asking to keep secrets",
            "details": "Felt unsafe",
        },
        headers=reporter_headers,
    )
    assert report_res.status_code == 201, report_res.text

    admin_reports = client.get("/admin/reports", headers=admin_headers)
    assert admin_reports.status_code == 200, admin_reports.text
    assert admin_reports.json()[0]["reported_username"] == "report_target"

    restrict_res = client.patch(
        f"/admin/groups/{group_id}/members/2/restrict",
        json={"reason": "Test restriction"},
        headers=admin_headers,
    )
    assert restrict_res.status_code == 200, restrict_res.text

    blocked_res = client.post(
        f"/groups/{group_id}/messages",
        json={"content": "I should be blocked"},
        headers=target_headers,
    )
    assert blocked_res.status_code == 403, blocked_res.text
    assert blocked_res.json()["detail"] == "You are restricted from sending messages in this group."
