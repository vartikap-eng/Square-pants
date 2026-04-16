from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    openai_api_key: str = ""
    database_url: str = "sqlite:///./conference_leads.db"
    frontend_url: str = "http://localhost:5173"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
