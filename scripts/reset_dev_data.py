from sqlalchemy import delete

from src.db import SessionLocal
from src.models import (
    Alert,
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


def main() -> None:
    db = SessionLocal()
    try:
        db.execute(delete(Alert))
        db.execute(delete(UserReport))
        db.execute(delete(Message))
        db.execute(delete(GroupRestriction))
        db.execute(delete(UserMute))
        db.execute(delete(UserGroupState))
        db.execute(delete(GroupMember))
        db.execute(delete(Group))
        db.execute(delete(Friendship))
        db.execute(delete(User).where(User.role != "admin"))
        db.commit()
        print("Development data reset complete.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
