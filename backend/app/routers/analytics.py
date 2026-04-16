from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, func

from ..database import get_session
from ..models.prospect import Prospect, Priority, ProspectStatus
from ..models.capture import LeadCapture
from ..models.followup import FollowUp, FollowUpStatus
from ..models.outreach import OutreachActivity, ActivityStatus

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
def get_summary(
    event_id: Optional[int] = None,
    session: Session = Depends(get_session),
):
    # Prospect funnel
    prospect_query = select(Prospect)
    if event_id:
        prospect_query = prospect_query.where(Prospect.event_id == event_id)
    prospects = session.exec(prospect_query).all()

    total_prospects = len(prospects)
    priority_breakdown = {"P0": 0, "P1": 0, "P2": 0, "Irrelevant": 0}
    segment_breakdown = {"existing_client": 0, "pipeline": 0, "cold": 0}
    status_breakdown: dict[str, int] = {}

    for p in prospects:
        priority_breakdown[p.priority.value] = priority_breakdown.get(p.priority.value, 0) + 1
        segment_breakdown[p.segment.value] = segment_breakdown.get(p.segment.value, 0) + 1
        status_breakdown[p.status.value] = status_breakdown.get(p.status.value, 0) + 1

    # Captures
    capture_query = select(LeadCapture)
    if event_id:
        capture_query = capture_query.where(LeadCapture.event_id == event_id)
    captures = session.exec(capture_query).all()
    total_captures = len(captures)

    # Follow-ups
    fu_query = select(FollowUp)
    if event_id:
        fu_query = fu_query.where(FollowUp.event_id == event_id)
    followups = session.exec(fu_query).all()

    fu_total = len(followups)
    fu_completed = sum(1 for f in followups if f.status == FollowUpStatus.completed)
    fu_pending = sum(1 for f in followups if f.status == FollowUpStatus.pending)
    fu_overdue = sum(1 for f in followups if f.status == FollowUpStatus.pending and
                     f.due_at.timestamp() < __import__("datetime").datetime.utcnow().timestamp())
    fu_completion_rate = round((fu_completed / fu_total * 100) if fu_total > 0 else 0, 1)

    # Outreach activities
    activity_query = select(OutreachActivity)
    activities = session.exec(activity_query).all()
    # Filter by event if possible (via prospect linkage)
    if event_id:
        event_prospect_ids = {p.id for p in prospects}
        activities = [a for a in activities if a.prospect_id in event_prospect_ids]

    total_activities = len(activities)
    replied = sum(1 for a in activities if a.status == ActivityStatus.replied)
    reply_rate = round((replied / total_activities * 100) if total_activities > 0 else 0, 1)

    # Meeting booked count
    meetings_booked = status_breakdown.get(ProspectStatus.meeting_booked.value, 0) + \
                      status_breakdown.get(ProspectStatus.met.value, 0)

    return {
        "total_prospects": total_prospects,
        "priority_breakdown": priority_breakdown,
        "segment_breakdown": segment_breakdown,
        "status_breakdown": status_breakdown,
        "total_captures": total_captures,
        "meetings_booked": meetings_booked,
        "outreach": {
            "total_sent": total_activities,
            "replied": replied,
            "reply_rate_pct": reply_rate,
        },
        "followups": {
            "total": fu_total,
            "completed": fu_completed,
            "pending": fu_pending,
            "overdue": fu_overdue,
            "completion_rate_pct": fu_completion_rate,
        },
        "funnel": [
            {"stage": "Attendees Reviewed", "count": total_prospects},
            {"stage": "Prioritized (P0+P1)", "count": priority_breakdown["P0"] + priority_breakdown["P1"]},
            {"stage": "Contacted", "count": total_activities},
            {"stage": "Replied", "count": replied},
            {"stage": "Meetings Booked", "count": meetings_booked},
        ]
    }
