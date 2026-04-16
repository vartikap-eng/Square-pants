from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel

from ..services.ai_service import generate_hooks, draft_message, transcribe_audio, scan_business_card

router = APIRouter(prefix="/ai", tags=["ai"])


class HookRequest(BaseModel):
    linkedin_bio: str = ""
    recent_posts: str = ""
    recent_funding: str = ""
    job_change: str = ""
    prospect_name: str = ""
    company: str = ""


class MessageDraftRequest(BaseModel):
    hook: str
    channel: str
    template: str = ""
    prospect_name: str
    company: str
    title: str
    segment: str = "cold"


@router.post("/hooks")
async def get_hooks(request: HookRequest):
    if not any([request.linkedin_bio, request.recent_posts, request.recent_funding, request.job_change]):
        raise HTTPException(
            status_code=400,
            detail="At least one LinkedIn data field must be provided"
        )
    hooks = await generate_hooks(
        linkedin_bio=request.linkedin_bio,
        recent_posts=request.recent_posts,
        recent_funding=request.recent_funding,
        job_change=request.job_change,
        prospect_name=request.prospect_name,
        company=request.company,
    )
    return {"hooks": hooks}


@router.post("/draft-message")
async def get_message_draft(request: MessageDraftRequest):
    message = await draft_message(
        hook=request.hook,
        channel=request.channel,
        template=request.template,
        prospect_name=request.prospect_name,
        company=request.company,
        title=request.title,
        segment=request.segment,
    )
    return {"message": message}


@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    content = await file.read()
    if len(content) > 25 * 1024 * 1024:  # 25MB Whisper limit
        raise HTTPException(status_code=413, detail="Audio file too large (max 25MB)")
    text = await transcribe_audio(content, filename=file.filename or "audio.webm")
    return {"transcript": text}


@router.post("/scan-card")
async def scan_card(file: UploadFile = File(...)):
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image too large (max 10MB)")
    result = await scan_business_card(content)
    return result
