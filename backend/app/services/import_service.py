"""
CSV import + deduplication + auto-scoring for prospect ingestion.
"""

import io
import pandas as pd
from rapidfuzz import fuzz
from sqlmodel import Session, select
from typing import List, Optional

from ..models.prospect import Prospect, Company, CompanyType, Priority, Segment
from ..services.scoring_service import score_prospect, classify_company_type


REQUIRED_COLUMNS = {"first_name", "last_name", "title"}
OPTIONAL_COLUMNS = {
    "email", "phone", "linkedin_url", "company", "company_type",
    "segment", "source", "attended_previous", "owner", "notes"
}

SEGMENT_EXISTING_KEYWORDS = ["client", "customer", "existing"]
SEGMENT_PIPELINE_KEYWORDS = ["pipeline", "opportunity", "prospect", "engaged"]


def _infer_segment(segment_raw: str) -> Segment:
    s = str(segment_raw).lower()
    if any(k in s for k in SEGMENT_EXISTING_KEYWORDS):
        return Segment.existing_client
    if any(k in s for k in SEGMENT_PIPELINE_KEYWORDS):
        return Segment.pipeline
    return Segment.cold


def _find_or_create_company(session: Session, company_name: str, company_type_str: Optional[str]) -> Company:
    """Find existing company by fuzzy name match, or create new."""
    companies = session.exec(select(Company)).all()
    for company in companies:
        ratio = fuzz.token_sort_ratio(company.name.lower(), company_name.lower())
        if ratio >= 85:
            return company

    # Determine company type
    if company_type_str:
        try:
            ctype = CompanyType(company_type_str.lower().replace(" ", "_"))
        except ValueError:
            ctype = classify_company_type(company_name)
    else:
        ctype = classify_company_type(company_name)

    new_company = Company(name=company_name, type=ctype)
    session.add(new_company)
    session.flush()
    return new_company


def _is_duplicate(session: Session, event_id: int, first_name: str, last_name: str, company_id: Optional[int]) -> bool:
    """Check if this prospect already exists in the event."""
    existing = session.exec(
        select(Prospect).where(Prospect.event_id == event_id)
    ).all()
    for p in existing:
        name_ratio = fuzz.token_sort_ratio(
            f"{p.first_name} {p.last_name}".lower(),
            f"{first_name} {last_name}".lower()
        )
        same_company = (p.company_id == company_id) if company_id else True
        if name_ratio >= 90 and same_company:
            return True
    return False


def parse_and_import_csv(
    csv_content: bytes,
    event_id: int,
    session: Session,
) -> dict:
    """
    Parse CSV, deduplicate, score, and persist prospects.
    Returns summary stats.
    """
    df = pd.read_csv(io.BytesIO(csv_content))
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"CSV missing required columns: {missing}. Found: {list(df.columns)}")

    df = df.where(pd.notna(df), None)

    created = 0
    skipped_duplicate = 0
    skipped_error = 0
    priority_counts: dict[str, int] = {"P0": 0, "P1": 0, "P2": 0, "Irrelevant": 0}

    for _, row in df.iterrows():
        try:
            first_name = str(row["first_name"]).strip()
            last_name = str(row["last_name"]).strip()
            title = str(row.get("title", "")).strip()
            company_name = str(row.get("company", "Unknown")).strip() if row.get("company") else "Unknown"

            company = _find_or_create_company(
                session, company_name, row.get("company_type")
            )

            if _is_duplicate(session, event_id, first_name, last_name, company.id):
                skipped_duplicate += 1
                continue

            priority, reason = score_prospect(title, company.type)

            segment_raw = row.get("segment", "cold") or "cold"
            segment = _infer_segment(str(segment_raw))

            prospect = Prospect(
                event_id=event_id,
                company_id=company.id,
                first_name=first_name,
                last_name=last_name,
                title=title,
                email=str(row["email"]).strip() if row.get("email") else None,
                phone=str(row["phone"]).strip() if row.get("phone") else None,
                linkedin_url=str(row["linkedin_url"]).strip() if row.get("linkedin_url") else None,
                segment=segment,
                priority=priority,
                score_reason=reason,
                source=str(row.get("source", "csv_import")).strip() if row.get("source") else "csv_import",
                attended_previous=bool(row.get("attended_previous", False)),
                owner=str(row["owner"]).strip() if row.get("owner") else None,
                notes=str(row["notes"]).strip() if row.get("notes") else None,
            )
            session.add(prospect)
            created += 1
            priority_counts[priority.value] += 1

        except Exception:
            skipped_error += 1
            continue

    session.commit()

    return {
        "total_rows": len(df),
        "created": created,
        "skipped_duplicate": skipped_duplicate,
        "skipped_error": skipped_error,
        "priority_breakdown": priority_counts,
    }
