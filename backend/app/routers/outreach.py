import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..database import get_session
from ..models.outreach import (
    OutreachSequence, OutreachActivity,
    OutreachActivityCreate, OutreachSequenceCreate, OutreachSequenceRead,
    ActivityStatus, OutreachChannel
)

router = APIRouter(prefix="/outreach", tags=["outreach"])

# Pre-seeded sequence templates
DEFAULT_TEMPLATES = [
    {
        "name": "Cold Lead — Conference",
        "segment": "cold",
        "description": "3-step cold outreach for conference prospects",
        "steps": [
            {
                "step": 1, "channel": "email", "delay_days": 0,
                "subject": "Meeting at {{event_name}}?",
                "template": "Hi {{first_name}},\n\n{{hook}}\n\nWould love to connect briefly at {{event_name}} — happy to work around your schedule.\n\nBest,\n{{sender_name}}"
            },
            {
                "step": 2, "channel": "linkedin", "delay_days": 2,
                "template": "Hi {{first_name}}, sent you a quick note over email — would love to connect here too. See you at {{event_name}}?"
            },
            {
                "step": 3, "channel": "whatsapp", "delay_days": 5,
                "template": "Hi {{first_name}}, this is {{sender_name}} from {{company}}. Heading to {{event_name}} this week — would be great to catch up briefly. Let me know!"
            },
        ]
    },
    {
        "name": "Existing Client — Conference Check-in",
        "segment": "existing_client",
        "description": "Warm outreach for existing clients attending the same event",
        "steps": [
            {
                "step": 1, "channel": "whatsapp", "delay_days": 0,
                "template": "Hi {{first_name}}! Saw you'll be at {{event_name}} too — would love to catch up and show you what's new on our end. Free for a coffee?"
            },
            {
                "step": 2, "channel": "email", "delay_days": 3,
                "subject": "Quick catch-up at {{event_name}}",
                "template": "Hi {{first_name}},\n\nJust following up on my earlier message — would love 15 mins at {{event_name}} to share some updates that I think are relevant for {{company}}.\n\nBest,\n{{sender_name}}"
            },
        ]
    },
    {
        "name": "Pipeline Prospect — Conference",
        "segment": "pipeline",
        "description": "Re-engage pipeline prospects at conference",
        "steps": [
            {
                "step": 1, "channel": "email", "delay_days": 0,
                "subject": "See you at {{event_name}}?",
                "template": "Hi {{first_name}},\n\n{{hook}}\n\nSince we're both at {{event_name}}, it'd be a great opportunity to continue our conversation. Happy to grab 20 mins?\n\nBest,\n{{sender_name}}"
            },
            {
                "step": 2, "channel": "linkedin", "delay_days": 3,
                "template": "Hi {{first_name}}, reaching out ahead of {{event_name}}. Would love to reconnect — let me know if you're free for a quick chat."
            },
        ]
    },
]


@router.get("/templates")
def get_templates():
    return DEFAULT_TEMPLATES


@router.post("/sequences", response_model=OutreachSequenceRead)
def create_sequence(
    data: OutreachSequenceCreate,
    session: Session = Depends(get_session),
):
    seq = OutreachSequence(
        name=data.name,
        segment=data.segment,
        description=data.description,
        steps_json=json.dumps(data.steps),
    )
    session.add(seq)
    session.commit()
    session.refresh(seq)
    return OutreachSequenceRead(
        id=seq.id,
        name=seq.name,
        segment=seq.segment,
        description=seq.description,
        steps=seq.steps,
        created_at=seq.created_at,
    )


@router.get("/sequences", response_model=List[OutreachSequenceRead])
def list_sequences(session: Session = Depends(get_session)):
    sequences = session.exec(select(OutreachSequence)).all()
    return [
        OutreachSequenceRead(
            id=s.id, name=s.name, segment=s.segment,
            description=s.description, steps=s.steps, created_at=s.created_at
        )
        for s in sequences
    ]


@router.post("/send")
def log_outreach_activity(
    data: OutreachActivityCreate,
    session: Session = Depends(get_session),
):
    activity = OutreachActivity(
        **data.model_dump(),
        status=ActivityStatus.sent,
        sent_at=datetime.utcnow(),
    )
    session.add(activity)
    session.commit()
    session.refresh(activity)
    return activity


@router.get("/activities/{prospect_id}")
def get_prospect_activities(
    prospect_id: int,
    session: Session = Depends(get_session),
):
    return session.exec(
        select(OutreachActivity)
        .where(OutreachActivity.prospect_id == prospect_id)
        .order_by(OutreachActivity.created_at.desc())
    ).all()


@router.patch("/activities/{activity_id}/status")
def update_activity_status(
    activity_id: int,
    status: ActivityStatus,
    session: Session = Depends(get_session),
):
    activity = session.get(OutreachActivity, activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    activity.status = status
    if status == ActivityStatus.opened:
        activity.opened_at = datetime.utcnow()
    elif status == ActivityStatus.replied:
        activity.replied_at = datetime.utcnow()
    session.add(activity)
    session.commit()
    session.refresh(activity)
    return activity
