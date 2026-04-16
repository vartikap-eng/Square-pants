from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from datetime import datetime, date

from ..database import get_session
from ..models.followup import Meeting, MeetingCreate, MeetingRead, MeetingStatus

router = APIRouter(prefix="/schedule", tags=["schedule"])


@router.post("", response_model=MeetingRead)
def create_meeting(data: MeetingCreate, session: Session = Depends(get_session)):
    meeting = Meeting.model_validate(data)
    session.add(meeting)
    session.commit()
    session.refresh(meeting)
    return meeting


@router.get("", response_model=List[MeetingRead])
def list_meetings(
    event_id: Optional[int] = None,
    owner: Optional[str] = None,
    day: Optional[date] = None,
    session: Session = Depends(get_session),
):
    query = select(Meeting)
    if event_id:
        query = query.where(Meeting.event_id == event_id)
    if owner:
        query = query.where(Meeting.owner == owner)
    if day:
        day_start = datetime.combine(day, datetime.min.time())
        day_end = datetime.combine(day, datetime.max.time())
        query = query.where(Meeting.start_time >= day_start, Meeting.start_time <= day_end)
    query = query.order_by(Meeting.start_time)
    return session.exec(query).all()


@router.patch("/{meeting_id}", response_model=MeetingRead)
def update_meeting(
    meeting_id: int,
    status: Optional[MeetingStatus] = None,
    notes: Optional[str] = None,
    session: Session = Depends(get_session),
):
    meeting = session.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if status:
        meeting.status = status
    if notes is not None:
        meeting.notes = notes
    session.add(meeting)
    session.commit()
    session.refresh(meeting)
    return meeting


@router.delete("/{meeting_id}")
def delete_meeting(meeting_id: int, session: Session = Depends(get_session)):
    meeting = session.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    session.delete(meeting)
    session.commit()
    return {"ok": True}
