import os
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from sqlmodel import Session, select

from ..database import get_session
from ..models.capture import LeadCapture, LeadCaptureCreate, LeadCaptureRead, CaptureSyncRequest, CaptureImage, CaptureImageRead

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "captures")
os.makedirs(UPLOAD_DIR, exist_ok=True)

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
    capture = session.get(LeadCapture, capture_id)
    if not capture:
        raise HTTPException(status_code=404, detail="Capture not found")
    return capture


@router.post("/{capture_id}/images", response_model=CaptureImageRead)
async def upload_capture_image(
    capture_id: int,
    file: UploadFile = File(...),
    image_type: str = "photo",
    session: Session = Depends(get_session),
):
    capture = session.get(LeadCapture, capture_id)
    if not capture:
        raise HTTPException(status_code=404, detail="Capture not found")

    ext = os.path.splitext(file.filename or "image.jpg")[1] or ".jpg"
    filename = f"{capture_id}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    img = CaptureImage(
        capture_id=capture_id,
        filename=filename,
        image_type=image_type,
        file_path=file_path,
    )
    session.add(img)
    session.commit()
    session.refresh(img)
    return img


@router.get("/{capture_id}/images", response_model=List[CaptureImageRead])
def list_capture_images(capture_id: int, session: Session = Depends(get_session)):
    return session.exec(
        select(CaptureImage).where(CaptureImage.capture_id == capture_id)
    ).all()


@router.get("/images/file/{filename}")
def serve_image(filename: str):
    path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path)
