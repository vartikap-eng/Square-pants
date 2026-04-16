from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from ..database import get_session
from ..models.followup import FollowUp, FollowUpRead, FollowUpUpdate, FollowUpStatus
from ..models.prospect import Prospect
from ..models.capture import LeadCapture
from ..services.followup_service import trigger_followup_sequence
from ..services.ai_service import draft_followup

router = APIRouter(prefix="/followups", tags=["followups"])


@router.post("/trigger/{event_id}")
def trigger_sequence(event_id: int, session: Session = Depends(get_session)):
    result = trigger_followup_sequence(event_id, session)
    return result


@router.get("", response_model=List[FollowUpRead])
def list_followups(
    event_id: Optional[int] = None,
    owner: Optional[str] = None,
    status: Optional[FollowUpStatus] = None,
    overdue_only: bool = False,
    due_today: bool = False,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, le=500),
    session: Session = Depends(get_session),
):
    query = select(FollowUp)
    if event_id:
        query = query.where(FollowUp.event_id == event_id)
    if owner:
        query = query.where(FollowUp.owner == owner)
    if status:
        query = query.where(FollowUp.status == status)
    if overdue_only:
        query = query.where(
            FollowUp.due_at < datetime.utcnow(),
            FollowUp.status == FollowUpStatus.pending,
        )
    if due_today:
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        query = query.where(
            FollowUp.due_at >= today_start,
            FollowUp.due_at < today_end,
            FollowUp.status == FollowUpStatus.pending,
        )
    query = query.order_by(FollowUp.due_at).offset(skip).limit(limit)
    return session.exec(query).all()


@router.get("/{followup_id}", response_model=FollowUpRead)
def get_followup(followup_id: int, session: Session = Depends(get_session)):
    fu = session.get(FollowUp, followup_id)
    if not fu:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    return fu


@router.patch("/{followup_id}", response_model=FollowUpRead)
def update_followup(
    followup_id: int,
    updates: FollowUpUpdate,
    session: Session = Depends(get_session),
):
    fu = session.get(FollowUp, followup_id)
    if not fu:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(fu, field, value)
    session.add(fu)
    session.commit()
    session.refresh(fu)
    return fu


@router.post("/{followup_id}/complete", response_model=FollowUpRead)
def complete_followup(followup_id: int, session: Session = Depends(get_session)):
    fu = session.get(FollowUp, followup_id)
    if not fu:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    fu.status = FollowUpStatus.completed
    fu.completed_at = datetime.utcnow()
    session.add(fu)
    session.commit()
    session.refresh(fu)
    return fu


@router.post("/{followup_id}/snooze", response_model=FollowUpRead)
def snooze_followup(
    followup_id: int,
    days: int = Query(default=2, ge=1, le=30),
    session: Session = Depends(get_session),
):
    fu = session.get(FollowUp, followup_id)
    if not fu:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    fu.status = FollowUpStatus.snoozed
    fu.due_at = fu.due_at + timedelta(days=days)
    session.add(fu)
    session.commit()
    session.refresh(fu)
    return fu


@router.get("/{followup_id}/draft")
async def get_ai_draft(followup_id: int, session: Session = Depends(get_session)):
    fu = session.get(FollowUp, followup_id)
    if not fu:
        raise HTTPException(status_code=404, detail="Follow-up not found")

    prospect = session.get(Prospect, fu.prospect_id)
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    # Pull capture notes if linked
    capture_notes = ""
    product_interest = ""
    next_step = ""
    if fu.capture_notes_ref:
        capture = session.get(LeadCapture, fu.capture_notes_ref)
        if capture:
            capture_notes = capture.notes or ""
            product_interest = capture.product_interest or ""
            next_step = capture.next_step or ""

    draft = await draft_followup(
        prospect_name=f"{prospect.first_name} {prospect.last_name}",
        company=str(prospect.company_id),
        title=prospect.title,
        capture_notes=capture_notes,
        meeting_notes=prospect.notes or "",
        product_interest=product_interest,
        next_step=next_step,
        sequence_step=fu.sequence_step,
    )

    # Cache the draft on the record
    fu.ai_draft = draft
    session.add(fu)
    session.commit()

    return {"draft": draft, "followup_id": followup_id}
