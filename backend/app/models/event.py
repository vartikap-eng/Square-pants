from datetime import datetime, date
from typing import Optional
from sqlmodel import SQLModel, Field


class EventBase(SQLModel):
    name: str
    date_start: date
    date_end: date
    location: str
    description: Optional[str] = None


class Event(EventBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class EventCreate(EventBase):
    pass


class EventRead(EventBase):
    id: int
    created_at: datetime
