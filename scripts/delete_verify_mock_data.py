from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import delete, or_, select

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.db import SessionLocal
from src.models import (
    Alert,
    FriendRequest,
    Friendship,
    Group,
    GroupMember,
    GroupRestriction,
    Message,
    User,
    UserGroupState,
    UserMute,
    UserReport,
)


VERIFY_GROUP_NAME = "Verify Group"
VERIFY_USERNAME = "verify_user"
VERIFY_MESSAGE_TEXT = "Send pics and turn on your camera."


def main() -> None:
    db = SessionLocal()
    try:
        verify_user = db.execute(
            select(User).where(User.username == VERIFY_USERNAME)
        ).scalar_one_or_none()
        verify_group = db.execute(
            select(Group).where(Group.name == VERIFY_GROUP_NAME)
        ).scalar_one_or_none()

        verify_user_id = verify_user.id if verify_user else None
        verify_group_id = verify_group.id if verify_group else None

        message_ids = []
        if verify_group_id is not None or verify_user_id is not None:
            message_ids = list(
                db.execute(
                    select(Message.id).where(
                        or_(
                            Message.group_id == verify_group_id if verify_group_id is not None else False,
                            Message.user_id == verify_user_id if verify_user_id is not None else False,
                            Message.content == VERIFY_MESSAGE_TEXT,
                        )
                    )
                ).scalars()
            )

        if message_ids:
            db.execute(delete(UserReport).where(UserReport.message_id.in_(message_ids)))
            db.execute(delete(Alert).where(Alert.message_id.in_(message_ids)))

        if verify_group_id is not None:
            db.execute(delete(Alert).where(Alert.group_id == verify_group_id))
            db.execute(delete(UserReport).where(UserReport.group_id == verify_group_id))
            db.execute(delete(UserMute).where(UserMute.group_id == verify_group_id))
            db.execute(delete(UserGroupState).where(UserGroupState.group_id == verify_group_id))
            db.execute(delete(GroupRestriction).where(GroupRestriction.group_id == verify_group_id))
            db.execute(delete(GroupMember).where(GroupMember.group_id == verify_group_id))
            db.execute(delete(Message).where(Message.group_id == verify_group_id))
            db.execute(delete(Group).where(Group.id == verify_group_id))

        if verify_user_id is not None:
            db.execute(delete(Alert).where(Alert.sender_username == VERIFY_USERNAME))
            db.execute(
                delete(UserReport).where(
                    or_(
                        UserReport.reporter_id == verify_user_id,
                        UserReport.reported_user_id == verify_user_id,
                    )
                )
            )
            db.execute(
                delete(UserMute).where(
                    or_(
                        UserMute.muter_id == verify_user_id,
                        UserMute.muted_user_id == verify_user_id,
                    )
                )
            )
            db.execute(delete(UserGroupState).where(UserGroupState.user_id == verify_user_id))
            db.execute(delete(GroupRestriction).where(GroupRestriction.user_id == verify_user_id))
            db.execute(delete(GroupMember).where(GroupMember.user_id == verify_user_id))
            db.execute(delete(Message).where(Message.user_id == verify_user_id))
            db.execute(
                delete(FriendRequest).where(
                    or_(
                        FriendRequest.requester_id == verify_user_id,
                        FriendRequest.receiver_id == verify_user_id,
                    )
                )
            )
            db.execute(
                delete(Friendship).where(
                    or_(
                        Friendship.user_id == verify_user_id,
                        Friendship.friend_id == verify_user_id,
                    )
                )
            )
            db.execute(delete(User).where(User.id == verify_user_id))

        db.commit()
        print("Verify mock data cleanup complete.")
        print(f"Removed group: {bool(verify_group_id)}")
        print(f"Removed user: {bool(verify_user_id)}")
        print(f"Matched message ids: {message_ids}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
