from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..database import get_session
from ..models.event import Event, EventCreate, EventRead

router = APIRouter(prefix="/events", tags=["events"])


@router.post("", response_model=EventRead)
def create_event(event: EventCreate, session: Session = Depends(get_session)):
    db_event = Event.model_validate(event)
    session.add(db_event)
    session.commit()
    session.refresh(db_event)
    return db_event


@router.get("", response_model=List[EventRead])
def list_events(session: Session = Depends(get_session)):
    return session.exec(select(Event).order_by(Event.date_start.desc())).all()


@router.get("/{event_id}", response_model=EventRead)
def get_event(event_id: int, session: Session = Depends(get_session)):
    event = session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event
