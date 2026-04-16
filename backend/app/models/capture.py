from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
from .prospect import Priority, Segment


class LeadCaptureBase(SQLModel):
    event_id: int = Field(foreign_key="event.id")
    prospect_id: Optional[int] = Field(default=None, foreign_key="prospect.id")
    captured_by: Optional[str] = None
    # Contact fields (may duplicate prospect if linked, but needed for offline)
    name: str
    company: Optional[str] = None
    title: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    linkedin: Optional[str] = None
    # Classification
    priority: Priority = Field(default=Priority.P2)
    segment: Segment = Field(default=Segment.cold)
    # Capture details
    notes: Optional[str] = None
    product_interest: Optional[str] = None
    next_step: Optional[str] = None
    commitment_made: Optional[str] = None
    # Offline sync
    offline_id: Optional[str] = Field(default=None, index=True)  # UUID from client


class LeadCapture(LeadCaptureBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    captured_at: datetime = Field(default_factory=datetime.utcnow)
    synced_at: Optional[datetime] = None


class LeadCaptureCreate(LeadCaptureBase):
    captured_at: Optional[datetime] = None


class LeadCaptureRead(LeadCaptureBase):
    id: int
    captured_at: datetime
    synced_at: Optional[datetime] = None


class CaptureSyncRequest(SQLModel):
    captures: list[LeadCaptureCreate]


class CaptureImage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    capture_id: int = Field(foreign_key="leadcapture.id", index=True)
    filename: str
    image_type: str = Field(default="photo")  # "business_card" or "photo"
    file_path: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CaptureImageRead(SQLModel):
    id: int
    capture_id: int
    filename: str
    image_type: str
    created_at: datetime
