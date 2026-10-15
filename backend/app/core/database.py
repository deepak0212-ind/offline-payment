from urllib.parse import unquote, urlparse

import pymysql
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings


def get_mysql_url() -> str:
    """Ensure SQLAlchemy uses the PyMySQL driver."""
    database_url = settings.DATABASE_URL

    if database_url.startswith("sqlite"):
        return database_url

    if database_url.startswith("mysql://"):
        database_url = database_url.replace(
            "mysql://", "mysql+pymysql://", 1
        )
    elif database_url.startswith("mysql+mysqldb://"):
        database_url = database_url.replace(
            "mysql+mysqldb://", "mysql+pymysql://", 1
        )

    if not database_url.startswith("mysql+pymysql://"):
        raise RuntimeError(
            "DATABASE_URL must use mysql+pymysql:// or sqlite."
        )

    return database_url


def ensure_database_exists(database_url: str) -> None:
    """Create the database if the MySQL account permits it."""
    if database_url.startswith("sqlite"):
        return

    parsed = urlparse(database_url)
    database_name = unquote(parsed.path.lstrip("/"))

    if not database_name:
        raise RuntimeError(
            "DATABASE_URL must include a database name."
        )

    connection = pymysql.connect(
        host=parsed.hostname or "127.0.0.1",
        port=parsed.port or 3306,
        user=unquote(parsed.username or ""),
        password=unquote(parsed.password or ""),
        connect_timeout=10,
        charset="utf8mb4",
    )

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{database_name}` "
                "CHARACTER SET utf8mb4 "
                "COLLATE utf8mb4_unicode_ci"
            )
        connection.commit()
    finally:
        connection.close()


DATABASE_URL = get_mysql_url()

ensure_database_exists(DATABASE_URL)

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=3600,
        pool_size=5,
        max_overflow=5,
    )

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()




