from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlmodel import Session, select, or_

from ..database import get_session
from ..models.prospect import (
    Prospect, ProspectCreate, ProspectUpdate, ProspectRead,
    Company, CompanyType, Priority, Segment, ProspectStatus
)
from ..services.import_service import parse_and_import_csv
from ..services.scoring_service import score_prospect

router = APIRouter(prefix="/prospects", tags=["prospects"])


@router.post("/import")
async def import_prospects(
    event_id: int = Form(...),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    try:
        result = parse_and_import_csv(content, event_id, session)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return result


@router.get("", response_model=List[ProspectRead])
def list_prospects(
    event_id: Optional[int] = None,
    priority: Optional[Priority] = None,
    segment: Optional[Segment] = None,
    status: Optional[ProspectStatus] = None,
    owner: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, le=500),
    session: Session = Depends(get_session),
):
    query = select(Prospect)

    if event_id:
        query = query.where(Prospect.event_id == event_id)
    if priority:
        query = query.where(Prospect.priority == priority)
    if segment:
        query = query.where(Prospect.segment == segment)
    if status:
        query = query.where(Prospect.status == status)
    if owner:
        query = query.where(Prospect.owner == owner)
    if search:
        s = f"%{search}%"
        query = query.where(
            or_(
                Prospect.first_name.ilike(s),
                Prospect.last_name.ilike(s),
                Prospect.title.ilike(s),
                Prospect.email.ilike(s),
            )
        )

    query = query.order_by(Prospect.priority, Prospect.created_at).offset(skip).limit(limit)
    return session.exec(query).all()


@router.get("/{prospect_id}", response_model=ProspectRead)
def get_prospect(prospect_id: int, session: Session = Depends(get_session)):
    prospect = session.get(Prospect, prospect_id)
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    return prospect


@router.patch("/{prospect_id}", response_model=ProspectRead)
def update_prospect(
    prospect_id: int,
    updates: ProspectUpdate,
    session: Session = Depends(get_session),
):
    prospect = session.get(Prospect, prospect_id)
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(prospect, field, value)

    prospect.updated_at = datetime.utcnow()
    session.add(prospect)
    session.commit()
    session.refresh(prospect)
    return prospect


@router.post("/{prospect_id}/rescore", response_model=ProspectRead)
def rescore_prospect(prospect_id: int, session: Session = Depends(get_session)):
    prospect = session.get(Prospect, prospect_id)
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    company = session.get(Company, prospect.company_id) if prospect.company_id else None
    company_type = company.type if company else CompanyType.other

    priority, reason = score_prospect(prospect.title, company_type)
    prospect.priority = priority
    prospect.score_reason = reason
    prospect.updated_at = datetime.utcnow()

    session.add(prospect)
    session.commit()
    session.refresh(prospect)
    return prospect


@router.get("/{prospect_id}/company")
def get_prospect_company(prospect_id: int, session: Session = Depends(get_session)):
    prospect = session.get(Prospect, prospect_id)
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    if not prospect.company_id:
        return None
    return session.get(Company, prospect.company_id)
