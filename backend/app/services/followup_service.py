"""
Follow-up cadence generation based on prospect priority.
"""

from datetime import datetime, timedelta
from sqlmodel import Session, select
from typing import List

from ..models.prospect import Prospect, Priority
from ..models.followup import FollowUp, FollowUpStatus
from ..models.outreach import OutreachChannel
from ..models.event import Event


# Cadence: (sequence_step, days_after_event_end, channel)
CADENCE: dict[str, list[tuple[int, int, OutreachChannel]]] = {
    Priority.P0: [
        (1, 1, OutreachChannel.email),
        (2, 3, OutreachChannel.linkedin),
        (3, 7, OutreachChannel.whatsapp),
    ],
    Priority.P1: [
        (1, 2, OutreachChannel.email),
        (2, 5, OutreachChannel.linkedin),
    ],
    Priority.P2: [
        (1, 3, OutreachChannel.email),
    ],
    Priority.irrelevant: [
        (1, 1, OutreachChannel.email),  # thank-you email only
    ],
}


def trigger_followup_sequence(event_id: int, session: Session) -> dict:
    """
    Generate FollowUp records for all prospects in an event.
    Idempotent — skips prospects that already have follow-ups.
    """
    event = session.get(Event, event_id)
    if not event:
        raise ValueError(f"Event {event_id} not found")

    base_date = datetime.combine(event.date_end, datetime.min.time())

    prospects = session.exec(
        select(Prospect).where(Prospect.event_id == event_id)
    ).all()

    existing_prospect_ids = set(
        session.exec(
            select(FollowUp.prospect_id).where(FollowUp.event_id == event_id)
        ).all()
    )

    created = 0
    skipped = 0

    for prospect in prospects:
        if prospect.id in existing_prospect_ids:
            skipped += 1
            continue

        cadence_steps = CADENCE.get(prospect.priority, CADENCE[Priority.P2])

        for step_num, days_offset, channel in cadence_steps:
            followup = FollowUp(
                prospect_id=prospect.id,
                event_id=event_id,
                sequence_step=step_num,
                due_at=base_date + timedelta(days=days_offset),
                channel=channel,
                status=FollowUpStatus.pending,
                owner=prospect.owner,
            )
            session.add(followup)
            created += 1

    session.commit()

    return {
        "event_id": event_id,
        "prospects_processed": len(prospects),
        "followups_created": created,
        "prospects_skipped": skipped,
    }
