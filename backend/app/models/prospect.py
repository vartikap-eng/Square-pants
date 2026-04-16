from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
from enum import Enum


class CompanyType(str, Enum):
    banking = "banking"
    fintech = "fintech"
    financial_services = "financial_services"
    nbfc = "nbfc"
    insurance = "insurance"
    other = "other"


class Priority(str, Enum):
    P0 = "P0"
    P1 = "P1"
    P2 = "P2"
    irrelevant = "Irrelevant"


class Segment(str, Enum):
    existing_client = "existing_client"
    pipeline = "pipeline"
    cold = "cold"


class ProspectStatus(str, Enum):
    new = "new"
    contacted = "contacted"
    replied = "replied"
    meeting_booked = "meeting_booked"
    met = "met"
    followed_up = "followed_up"
    closed = "closed"


class Company(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    type: CompanyType = Field(default=CompanyType.other)
    size_band: Optional[str] = None  # e.g. "1-50", "51-200", "201-1000", "1000+"
    funding_stage: Optional[str] = None
    hq_country: Optional[str] = None
    linkedin_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ProspectBase(SQLModel):
    event_id: int = Field(foreign_key="event.id")
    company_id: Optional[int] = Field(default=None, foreign_key="company.id")
    first_name: str
    last_name: str
    title: str
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    segment: Segment = Field(default=Segment.cold)
    priority: Priority = Field(default=Priority.P2)
    score_reason: Optional[str] = None
    source: Optional[str] = None  # "event_app", "linkedin", "historical"
    attended_previous: bool = Field(default=False)
    status: ProspectStatus = Field(default=ProspectStatus.new)
    owner: Optional[str] = None
    linkedin_bio: Optional[str] = None
    linkedin_recent_posts: Optional[str] = None
    recent_funding: Optional[str] = None
    recent_job_change: Optional[str] = None
    notes: Optional[str] = None


class Prospect(ProspectBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ProspectCreate(ProspectBase):
    pass


class ProspectUpdate(SQLModel):
    segment: Optional[Segment] = None
    priority: Optional[Priority] = None
    status: Optional[ProspectStatus] = None
    owner: Optional[str] = None
    notes: Optional[str] = None
    linkedin_bio: Optional[str] = None
    linkedin_recent_posts: Optional[str] = None
    recent_funding: Optional[str] = None
    recent_job_change: Optional[str] = None
    company_id: Optional[int] = None


class ProspectRead(ProspectBase):
    id: int
    created_at: datetime
    updated_at: datetime
