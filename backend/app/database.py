from sqlmodel import SQLModel, create_engine, Session
from .config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
    echo=False,
)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    _run_migrations()


def _run_migrations():
    """Apply additive SQLite column migrations that SQLModel won't auto-create."""
    migrations = [
        "ALTER TABLE outreachactivity ADD COLUMN message_id TEXT",
        "ALTER TABLE outreachactivity ADD COLUMN recipient_email TEXT",
        "ALTER TABLE prospect ADD COLUMN outreach_mode TEXT",
    ]
    from sqlalchemy import text
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # Column already exists — safe to ignore


def get_session():
    with Session(engine) as session:
        yield session
