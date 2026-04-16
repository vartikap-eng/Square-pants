import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..database import get_session
from ..models.outreach import (
    OutreachSequence, OutreachActivity,
    OutreachActivityCreate, OutreachSequenceCreate, OutreachSequenceRead,
    ActivityStatus, OutreachChannel,
    OutreachTemplate, OutreachTemplateCreate, OutreachTemplateUpdate, OutreachTemplateRead,
    ProspectResearch, ProspectResearchUpsert, ProspectResearchRead,
)

router = APIRouter(prefix="/outreach", tags=["outreach"])

# ─── Seed data ────────────────────────────────────────────────────────────────

DEFAULT_TEMPLATES = [
    # ── Email templates ──
    {
        "name": "Cold Email — Conference intro",
        "channel": "email", "segment": "cold", "is_default": True,
        "subject": "Quick chat at {{event_name}}?",
        "body": (
            "Hi {{first_name}},\n\n"
            "{{hook}}\n\n"
            "We help credit and risk teams at companies like {{company}} reduce decision time "
            "and catch early delinquency signals. Given what you're working on, I thought it'd "
            "be worth a 15-min chat at {{event_name}}.\n\n"
            "Would you have a slot on {{event_date}}?\n\n"
            "Best,\n{{sender_name}}"
        ),
        "tags": "conference,cold,email",
    },
    {
        "name": "Pipeline Re-engage — Conference",
        "channel": "email", "segment": "pipeline", "is_default": True,
        "subject": "Continuing our conversation at {{event_name}}",
        "body": (
            "Hi {{first_name}},\n\n"
            "{{hook}}\n\n"
            "Since we're both heading to {{event_name}}, it feels like a natural moment to "
            "continue where we left off. Happy to grab 20 mins — I have some updates on "
            "{{product_area}} that I think are directly relevant to {{company}}.\n\n"
            "Let me know what works for you.\n\n"
            "Best,\n{{sender_name}}"
        ),
        "tags": "conference,pipeline,email",
    },
    {
        "name": "Existing Client — Event check-in",
        "channel": "email", "segment": "existing_client", "is_default": True,
        "subject": "See you at {{event_name}}?",
        "body": (
            "Hi {{first_name}},\n\n"
            "Noticed you'll be at {{event_name}} too — would love to catch up and share "
            "what we've been building since we last spoke. Happy to work around your schedule.\n\n"
            "Coffee on Day 1?\n\n"
            "Best,\n{{sender_name}}"
        ),
        "tags": "conference,existing_client,email",
    },
    # ── LinkedIn templates ──
    {
        "name": "LinkedIn — Cold connect",
        "channel": "linkedin", "segment": "cold", "is_default": True,
        "subject": None,
        "body": (
            "Hi {{first_name}}, {{hook}} — would love to connect ahead of {{event_name}}."
        ),
        "tags": "conference,cold,linkedin",
    },
    {
        "name": "LinkedIn — Post-connect follow-up",
        "channel": "linkedin", "segment": "cold", "is_default": True,
        "subject": None,
        "body": (
            "Thanks for connecting, {{first_name}}! "
            "We're at {{event_name}} this week — would love 15 mins if you have a window. "
            "We work with several {{company_type}} teams on credit decisioning. "
            "Happy to share what's relevant for {{company}}."
        ),
        "tags": "conference,follow-up,linkedin",
    },
    {
        "name": "LinkedIn — Pipeline re-engage",
        "channel": "linkedin", "segment": "pipeline", "is_default": True,
        "subject": None,
        "body": (
            "Hi {{first_name}}, reaching out ahead of {{event_name}}. "
            "{{hook}} — feels like a good moment to reconnect. Free for a quick chat at the conference?"
        ),
        "tags": "conference,pipeline,linkedin",
    },
    # ── WhatsApp templates ──
    {
        "name": "WhatsApp — Warm intro",
        "channel": "whatsapp", "segment": "cold", "is_default": True,
        "subject": None,
        "body": (
            "Hi {{first_name}}, this is {{sender_name}} from {{sender_company}}. "
            "We're both at {{event_name}} — {{hook}} Would love to catch up briefly. "
            "When works for you?"
        ),
        "tags": "conference,cold,whatsapp",
    },
    {
        "name": "WhatsApp — Existing client",
        "channel": "whatsapp", "segment": "existing_client", "is_default": True,
        "subject": None,
        "body": (
            "Hey {{first_name}}! {{sender_name}} here. Saw you're at {{event_name}} too 🎉 "
            "Would love to catch up — coffee on Day 1?"
        ),
        "tags": "conference,existing_client,whatsapp",
    },
    # ── Call templates (talk tracks) ──
    {
        "name": "Call — Cold intro talk track",
        "channel": "call", "segment": "cold", "is_default": True,
        "subject": None,
        "body": (
            "Opening: \"Hi {{first_name}}, this is {{sender_name}} from {{sender_company}}. "
            "I know you're heading to {{event_name}} — I wanted to reach out beforehand.\"\n\n"
            "Hook: {{hook}}\n\n"
            "Bridge: \"We work with {{company_type}} teams specifically on credit risk and "
            "collections automation. I thought there might be a fit.\"\n\n"
            "Ask: \"Would you have 15 minutes at the conference to explore this?\"\n\n"
            "Objection — no time: \"Totally understand. Could we schedule something for the "
            "week after {{event_name}}?\""
        ),
        "tags": "conference,cold,call,talk-track",
    },
]

MERGE_FIELDS = [
    {"field": "{{first_name}}", "description": "Prospect's first name"},
    {"field": "{{last_name}}", "description": "Prospect's last name"},
    {"field": "{{company}}", "description": "Prospect's company name"},
    {"field": "{{title}}", "description": "Prospect's job title"},
    {"field": "{{event_name}}", "description": "Conference / event name"},
    {"field": "{{event_date}}", "description": "Event date or date range"},
    {"field": "{{sender_name}}", "description": "Sender's full name"},
    {"field": "{{sender_company}}", "description": "Your company name"},
    {"field": "{{hook}}", "description": "AI-generated personalization hook"},
    {"field": "{{recent_funding}}", "description": "Recent funding round or news"},
    {"field": "{{job_change}}", "description": "Recent role or job change"},
    {"field": "{{mutual_connection}}", "description": "Shared LinkedIn connection"},
    {"field": "{{company_news}}", "description": "Recent company news or announcement"},
    {"field": "{{company_type}}", "description": "Company category (bank, fintech, etc.)"},
    {"field": "{{product_area}}", "description": "Specific product area relevant to prospect"},
]


def _seed_default_templates(session: Session):
    """Insert default templates once if none exist."""
    existing = session.exec(select(OutreachTemplate).where(OutreachTemplate.is_default == True)).first()
    if existing:
        return
    for t in DEFAULT_TEMPLATES:
        session.add(OutreachTemplate(
            name=t["name"], channel=t["channel"], segment=t["segment"],
            subject=t.get("subject"), body=t["body"],
            tags=t.get("tags"), is_default=True,
        ))
    session.commit()


# ─── Merge field reference ────────────────────────────────────────────────────

@router.get("/merge-fields")
def get_merge_fields():
    return MERGE_FIELDS


# ─── Template CRUD ────────────────────────────────────────────────────────────

@router.get("/templates", response_model=List[OutreachTemplateRead])
def list_templates(
    channel: Optional[str] = None,
    segment: Optional[str] = None,
    session: Session = Depends(get_session),
):
    _seed_default_templates(session)
    query = select(OutreachTemplate)
    if channel:
        query = query.where(OutreachTemplate.channel == channel)
    if segment and segment != "all":
        query = query.where(
            (OutreachTemplate.segment == segment) | (OutreachTemplate.segment == "all")
        )
    return session.exec(query.order_by(OutreachTemplate.is_default.desc(), OutreachTemplate.name)).all()


@router.post("/templates", response_model=OutreachTemplateRead)
def create_template(
    data: OutreachTemplateCreate,
    session: Session = Depends(get_session),
):
    tmpl = OutreachTemplate(**data.model_dump(), is_default=False)
    session.add(tmpl)
    session.commit()
    session.refresh(tmpl)
    return tmpl


@router.patch("/templates/{template_id}", response_model=OutreachTemplateRead)
def update_template(
    template_id: int,
    data: OutreachTemplateUpdate,
    session: Session = Depends(get_session),
):
    tmpl = session.get(OutreachTemplate, template_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(tmpl, field, value)
    tmpl.updated_at = datetime.utcnow()
    session.add(tmpl)
    session.commit()
    session.refresh(tmpl)
    return tmpl


@router.delete("/templates/{template_id}")
def delete_template(
    template_id: int,
    session: Session = Depends(get_session),
):
    tmpl = session.get(OutreachTemplate, template_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    if tmpl.is_default:
        raise HTTPException(status_code=403, detail="Cannot delete default templates")
    session.delete(tmpl)
    session.commit()
    return {"ok": True}


@router.post("/templates/{template_id}/preview")
def preview_template(
    template_id: int,
    merge_values: dict,
    session: Session = Depends(get_session),
):
    """Render a template with provided merge values."""
    tmpl = session.get(OutreachTemplate, template_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")

    body = tmpl.body
    subject = tmpl.subject or ""
    for field, value in merge_values.items():
        key = f"{{{{{field}}}}}"
        body = body.replace(key, str(value))
        subject = subject.replace(key, str(value))

    return {"subject": subject or None, "body": body, "channel": tmpl.channel}


# ─── Prospect research CRUD ───────────────────────────────────────────────────

@router.get("/research/{prospect_id}", response_model=ProspectResearchRead)
def get_research(prospect_id: int, session: Session = Depends(get_session)):
    research = session.exec(
        select(ProspectResearch).where(ProspectResearch.prospect_id == prospect_id)
    ).first()
    if not research:
        raise HTTPException(status_code=404, detail="No research saved for this prospect")
    return ProspectResearchRead(
        **research.model_dump(exclude={"hooks_json"}),
        hooks=research.hooks,
    )


@router.put("/research/{prospect_id}", response_model=ProspectResearchRead)
def upsert_research(
    prospect_id: int,
    data: ProspectResearchUpsert,
    session: Session = Depends(get_session),
):
    research = session.exec(
        select(ProspectResearch).where(ProspectResearch.prospect_id == prospect_id)
    ).first()

    if research:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(research, field, value)
        research.updated_at = datetime.utcnow()
    else:
        research = ProspectResearch(prospect_id=prospect_id, **data.model_dump())

    session.add(research)
    session.commit()
    session.refresh(research)
    return ProspectResearchRead(
        **research.model_dump(exclude={"hooks_json"}),
        hooks=research.hooks,
    )


@router.post("/research/{prospect_id}/cache-hooks")
def cache_hooks(
    prospect_id: int,
    payload: dict,
    session: Session = Depends(get_session),
):
    """Cache generated hooks + summary back onto the research record."""
    research = session.exec(
        select(ProspectResearch).where(ProspectResearch.prospect_id == prospect_id)
    ).first()
    if not research:
        research = ProspectResearch(prospect_id=prospect_id)
        session.add(research)

    research.hooks = payload.get("hooks", [])
    research.ai_summary = payload.get("summary", "")
    research.updated_at = datetime.utcnow()
    session.add(research)
    session.commit()
    return {"ok": True}


# ─── Sequences ────────────────────────────────────────────────────────────────

@router.post("/sequences", response_model=OutreachSequenceRead)
def create_sequence(
    data: OutreachSequenceCreate,
    session: Session = Depends(get_session),
):
    seq = OutreachSequence(
        name=data.name, segment=data.segment,
        description=data.description, steps_json=json.dumps(data.steps),
    )
    session.add(seq)
    session.commit()
    session.refresh(seq)
    return OutreachSequenceRead(
        id=seq.id, name=seq.name, segment=seq.segment,
        description=seq.description, steps=seq.steps, created_at=seq.created_at,
    )


@router.get("/sequences", response_model=List[OutreachSequenceRead])
def list_sequences(session: Session = Depends(get_session)):
    sequences = session.exec(select(OutreachSequence)).all()
    return [
        OutreachSequenceRead(
            id=s.id, name=s.name, segment=s.segment,
            description=s.description, steps=s.steps, created_at=s.created_at,
        )
        for s in sequences
    ]


# ─── Activities ───────────────────────────────────────────────────────────────

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
