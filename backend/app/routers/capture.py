from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from ..database import get_session
from ..models.capture import LeadCapture, LeadCaptureCreate, LeadCaptureRead, CaptureSyncRequest

router = APIRouter(prefix="/capture", tags=["capture"])


@router.post("/sync")
def sync_captures(
    data: CaptureSyncRequest,
    session: Session = Depends(get_session),
):
    """
    Batch sync offline captures. Idempotent via offline_id.
    """
    synced = []
    skipped = []

    for capture_data in data.captures:
        # Dedup check via offline_id
        if capture_data.offline_id:
            existing = session.exec(
                select(LeadCapture).where(LeadCapture.offline_id == capture_data.offline_id)
            ).first()
            if existing:
                skipped.append(capture_data.offline_id)
                continue

        capture = LeadCapture(
            **capture_data.model_dump(),
            synced_at=datetime.utcnow(),
            captured_at=capture_data.captured_at or datetime.utcnow(),
        )
        session.add(capture)
        synced.append(capture_data.offline_id or "no-id")

    session.commit()
    return {"synced": len(synced), "skipped_duplicate": len(skipped)}


@router.post("", response_model=LeadCaptureRead)
def create_capture(
    data: LeadCaptureCreate,
    session: Session = Depends(get_session),
):
    """Single online capture."""
    capture = LeadCapture(
        **data.model_dump(),
        synced_at=datetime.utcnow(),
        captured_at=data.captured_at or datetime.utcnow(),
    )
    session.add(capture)
    session.commit()
    session.refresh(capture)
    return capture


@router.get("", response_model=List[LeadCaptureRead])
def list_captures(
    event_id: Optional[int] = None,
    captured_by: Optional[str] = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, le=500),
    session: Session = Depends(get_session),
):
    query = select(LeadCapture)
    if event_id:
        query = query.where(LeadCapture.event_id == event_id)
    if captured_by:
        query = query.where(LeadCapture.captured_by == captured_by)
    query = query.order_by(LeadCapture.captured_at.desc()).offset(skip).limit(limit)
    return session.exec(query).all()


@router.get("/{capture_id}", response_model=LeadCaptureRead)
def get_capture(capture_id: int, session: Session = Depends(get_session)):
    from fastapi import HTTPException
    capture = session.get(LeadCapture, capture_id)
    if not capture:
        raise HTTPException(status_code=404, detail="Capture not found")
    return capture
