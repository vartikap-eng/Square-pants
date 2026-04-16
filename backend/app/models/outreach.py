from datetime import datetime
from typing import Optional, List, Any
from sqlmodel import SQLModel, Field
from enum import Enum
import json


class OutreachChannel(str, Enum):
    email = "email"
    linkedin = "linkedin"
    whatsapp = "whatsapp"
    call = "call"


class ActivityStatus(str, Enum):
    pending = "pending"
    sent = "sent"
    opened = "opened"
    replied = "replied"
    bounced = "bounced"
    skipped = "skipped"


class OutreachSequence(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    segment: str  # existing_client / pipeline / cold
    description: Optional[str] = None
    steps_json: str = Field(default="[]")  # JSON array of step configs
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @property
    def steps(self) -> List[dict]:
        return json.loads(self.steps_json)

    @steps.setter
    def steps(self, value: List[dict]):
        self.steps_json = json.dumps(value)


class OutreachActivity(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    prospect_id: int = Field(foreign_key="prospect.id", index=True)
    sequence_id: Optional[int] = Field(default=None, foreign_key="outreachsequence.id")
    channel: OutreachChannel
    step_number: int = Field(default=1)
    subject: Optional[str] = None
    body: Optional[str] = None
    status: ActivityStatus = Field(default=ActivityStatus.pending)
    sent_at: Optional[datetime] = None
    opened_at: Optional[datetime] = None
    replied_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class OutreachActivityCreate(SQLModel):
    prospect_id: int
    sequence_id: Optional[int] = None
    channel: OutreachChannel
    step_number: int = 1
    subject: Optional[str] = None
    body: Optional[str] = None
    notes: Optional[str] = None


class OutreachSequenceCreate(SQLModel):
    name: str
    segment: str
    description: Optional[str] = None
    steps: List[Any] = []


class OutreachSequenceRead(SQLModel):
    id: int
    name: str
    segment: str
    description: Optional[str] = None
    steps: List[Any] = []
    created_at: datetime
