from datetime import datetime
from typing import Optional, List, Any
from sqlmodel import SQLModel, Field
from enum import Enum
import json


# ─── Template model ──────────────────────────────────────────────────────────

class OutreachTemplate(SQLModel, table=True):
    """Persistent message templates with {{merge_field}} placeholders."""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    channel: str                          # email | linkedin | whatsapp | call
    segment: str = Field(default="all")   # cold | pipeline | existing_client | all
    subject: Optional[str] = None         # email only
    body: str                             # template body with {{merge_fields}}
    tags: Optional[str] = None            # comma-separated tags e.g. "conference,cold"
    is_default: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class OutreachTemplateCreate(SQLModel):
    name: str
    channel: str
    segment: str = "all"
    subject: Optional[str] = None
    body: str
    tags: Optional[str] = None


class OutreachTemplateUpdate(SQLModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    tags: Optional[str] = None
    segment: Optional[str] = None


class OutreachTemplateRead(SQLModel):
    id: int
    name: str
    channel: str
    segment: str
    subject: Optional[str] = None
    body: str
    tags: Optional[str] = None
    is_default: bool
    created_at: datetime


# ─── Prospect research model ──────────────────────────────────────────────────

class ProspectResearch(SQLModel, table=True):
    """Cached LinkedIn + company research per prospect."""
    id: Optional[int] = Field(default=None, primary_key=True)
    prospect_id: int = Field(foreign_key="prospect.id", index=True, unique=True)
    linkedin_bio: Optional[str] = None
    recent_posts: Optional[str] = None
    recent_funding: Optional[str] = None
    job_change: Optional[str] = None
    mutual_connections: Optional[str] = None
    company_news: Optional[str] = None
    ai_summary: Optional[str] = None      # cached GPT summary of above
    hooks_json: Optional[str] = None      # cached hooks array as JSON
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    @property
    def hooks(self) -> List[str]:
        return json.loads(self.hooks_json) if self.hooks_json else []

    @hooks.setter
    def hooks(self, value: List[str]):
        self.hooks_json = json.dumps(value)


class ProspectResearchUpsert(SQLModel):
    linkedin_bio: Optional[str] = None
    recent_posts: Optional[str] = None
    recent_funding: Optional[str] = None
    job_change: Optional[str] = None
    mutual_connections: Optional[str] = None
    company_news: Optional[str] = None


class ProspectResearchRead(SQLModel):
    id: int
    prospect_id: int
    linkedin_bio: Optional[str] = None
    recent_posts: Optional[str] = None
    recent_funding: Optional[str] = None
    job_change: Optional[str] = None
    mutual_connections: Optional[str] = None
    company_news: Optional[str] = None
    ai_summary: Optional[str] = None
    hooks: List[str] = []
    updated_at: datetime


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
    message_id: Optional[str] = None  # SMTP Message-ID header for reply tracking
    recipient_email: Optional[str] = None  # email address it was sent to
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
