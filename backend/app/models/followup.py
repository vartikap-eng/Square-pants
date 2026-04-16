from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
from enum import Enum
from .outreach import OutreachChannel


class FollowUpStatus(str, Enum):
    pending = "pending"
    sent = "sent"
    snoozed = "snoozed"
    skipped = "skipped"
    completed = "completed"


class MeetingStatus(str, Enum):
    scheduled = "scheduled"
    completed = "completed"
    no_show = "no_show"
    cancelled = "cancelled"


class FollowUp(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    prospect_id: int = Field(foreign_key="prospect.id", index=True)
    event_id: int = Field(foreign_key="event.id", index=True)
    sequence_step: int = Field(default=1)
    due_at: datetime
    completed_at: Optional[datetime] = None
    channel: OutreachChannel = Field(default=OutreachChannel.email)
    status: FollowUpStatus = Field(default=FollowUpStatus.pending)
    owner: Optional[str] = None
    ai_draft: Optional[str] = None
    capture_notes_ref: Optional[int] = Field(default=None, foreign_key="leadcapture.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class FollowUpRead(SQLModel):
    id: int
    prospect_id: int
    event_id: int
    sequence_step: int
    due_at: datetime
    completed_at: Optional[datetime] = None
    channel: OutreachChannel
    status: FollowUpStatus
    owner: Optional[str] = None
    ai_draft: Optional[str] = None
    created_at: datetime


class FollowUpUpdate(SQLModel):
    status: Optional[FollowUpStatus] = None
    completed_at: Optional[datetime] = None
    ai_draft: Optional[str] = None
    owner: Optional[str] = None


class Meeting(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    event_id: int = Field(foreign_key="event.id", index=True)
    prospect_id: Optional[int] = Field(default=None, foreign_key="prospect.id")
    owner: Optional[str] = None
    title: Optional[str] = None
    start_time: datetime
    end_time: datetime
    location: Optional[str] = None
    status: MeetingStatus = Field(default=MeetingStatus.scheduled)
    notes: Optional[str] = None
    is_pre_booked: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MeetingCreate(SQLModel):
    event_id: int
    prospect_id: Optional[int] = None
    owner: Optional[str] = None
    title: Optional[str] = None
    start_time: datetime
    end_time: datetime
    location: Optional[str] = None
    is_pre_booked: bool = False
    notes: Optional[str] = None


class MeetingRead(SQLModel):
    id: int
    event_id: int
    prospect_id: Optional[int] = None
    owner: Optional[str] = None
    title: Optional[str] = None
    start_time: datetime
    end_time: datetime
    location: Optional[str] = None
    status: MeetingStatus
    is_pre_booked: bool
    notes: Optional[str] = None
    created_at: datetime
