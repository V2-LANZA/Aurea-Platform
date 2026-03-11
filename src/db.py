from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from .settings import AUREA_DB_URL

connect_args = {"check_same_thread": False} if AUREA_DB_URL.startswith("sqlite") else {}
engine = create_engine(AUREA_DB_URL, echo=False, future=True, connect_args=connect_args)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()
