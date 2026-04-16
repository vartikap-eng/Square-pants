from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    openai_api_key: str = ""
    database_url: str = "sqlite:///./conference_leads.db"
    # Comma-separated list of allowed frontend origins
    frontend_url: str = "http://localhost:5173,http://localhost:3000"
    # Gmail SMTP — for sending outreach emails
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""           # your-email@gmail.com
    smtp_password: str = ""       # Gmail App Password (not your login password)
    smtp_from: str = ""           # display name + address, e.g. "Sales Team <you@gmail.com>"
    # Gmail IMAP — for reply detection
    imap_host: str = "imap.gmail.com"
    imap_user: str = ""           # same Gmail address
    imap_password: str = ""       # same App Password
    # LinkedIn automation credentials (Apify - most reliable)
    apify_api_token: str = ""
    # Legacy RapidAPI
    rapidapi_key: str = ""
    # Legacy Proxycurl (no longer used)
    proxycurl_api_key: str = ""
    # Legacy PhantomBuster fields (kept for backward compatibility)
    phantombuster_api_key: str = ""
    linkedin_cookie: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
