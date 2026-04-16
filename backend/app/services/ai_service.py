"""
OpenAI integrations: hook generation, message drafting, transcription, card scan, follow-up copy.
"""

import base64
import json
from openai import AsyncOpenAI
from ..config import get_settings

settings = get_settings()
client = AsyncOpenAI(api_key=settings.openai_api_key)

HOOK_SYSTEM_PROMPT = """You are an expert B2B sales researcher helping a fintech/credit intelligence company
craft highly personalized outreach hooks for conference prospects.

Based on all provided LinkedIn and company data, return a JSON object with exactly two keys:

"summary": A 2-3 sentence synthesis of what's most interesting or relevant about this prospect
right now — their focus areas, challenges, recent moves, or context that makes them worth reaching out to.
Write it as internal sales intel, not as a message to them.

"hooks": An array of exactly 3 distinct opening lines for outreach messages. Each hook should:
- Reference ONE specific, concrete detail from the data (funding round amount, specific post topic,
  role change timing, mutual connection name, specific company news)
- Be 1-2 sentences max, ready to drop into a message
- Sound natural and human — not sales-y or flattering
- Be relevant to credit risk, lending, financial operations, or fintech challenges
- Each hook should use a DIFFERENT data point (don't repeat the same signal)

Return ONLY valid JSON in this exact shape:
{"summary": "...", "hooks": ["...", "...", "..."]}
No markdown, no explanation."""

MESSAGE_SYSTEM_PROMPT = """You are a B2B sales copywriter for a credit intelligence / fintech company attending a financial services conference.

Write a concise, personalized outreach message based on:
- The selected hook
- The template/channel guidelines
- The prospect's profile

Rules:
- Keep it under 120 words
- No generic opening lines ("Hope this finds you well")
- Reference the specific hook naturally
- End with a clear, low-friction CTA (brief chat at the conference, not a sales call)
- Match the channel's tone (LinkedIn = slightly formal, WhatsApp = conversational, email = balanced)

Return ONLY the message text."""

FOLLOWUP_SYSTEM_PROMPT = """You are helping a B2B sales rep write a post-conference follow-up message.

Based on the meeting notes, capture notes, and prospect details provided, write a concise follow-up.

Rules:
- Reference a specific detail from your conversation
- Be warm but professional
- Under 100 words
- Include a concrete next step
- Do NOT reference "our conversation" generically — use a specific detail

Return ONLY the follow-up message text."""

CARD_SCAN_PROMPT = """Extract contact information from this business card image.
Return ONLY a JSON object with these fields (use null for missing):
{
  "name": "full name",
  "first_name": "first name",
  "last_name": "last name",
  "title": "job title",
  "company": "company name",
  "email": "email address",
  "phone": "phone number",
  "linkedin": "linkedin URL if visible",
  "website": "company website if visible"
}"""


async def generate_hooks(
    linkedin_bio: str = "",
    recent_posts: str = "",
    recent_funding: str = "",
    job_change: str = "",
    mutual_connections: str = "",
    company_news: str = "",
    prospect_name: str = "",
    company: str = "",
    title: str = "",
) -> dict:
    """Returns {"summary": str, "hooks": [str, str, str]}"""
    context_parts = []
    if linkedin_bio:
        context_parts.append(f"LinkedIn Bio:\n{linkedin_bio}")
    if recent_posts:
        context_parts.append(f"Recent LinkedIn Posts/Activity:\n{recent_posts}")
    if recent_funding:
        context_parts.append(f"Recent Funding/News:\n{recent_funding}")
    if job_change:
        context_parts.append(f"Recent Job Change:\n{job_change}")
    if mutual_connections:
        context_parts.append(f"Mutual LinkedIn Connections:\n{mutual_connections}")
    if company_news:
        context_parts.append(f"Recent Company News:\n{company_news}")

    user_content = (
        f"Prospect: {prospect_name}, {title} at {company}\n\n"
        + "\n\n".join(context_parts)
    )

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": HOOK_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        temperature=0.7,
        max_tokens=600,
    )

    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)


async def draft_message(
    hook: str,
    channel: str,
    template: str,
    prospect_name: str,
    company: str,
    title: str,
    segment: str,
) -> str:
    user_content = f"""Prospect: {prospect_name}, {title} at {company}
Segment: {segment}
Channel: {channel}
Hook to use: {hook}
Template/Context: {template}"""

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": MESSAGE_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        temperature=0.6,
        max_tokens=300,
    )
    return response.choices[0].message.content.strip()


async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    import io
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = filename

    transcript = await client.audio.transcriptions.create(
        model="whisper-1",
        file=audio_file,
        response_format="text",
    )
    return transcript


async def scan_business_card(image_bytes: bytes) -> dict:
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    # Detect image type from magic bytes
    if image_bytes[:4] == b'\x89PNG':
        mime = "image/png"
    elif image_bytes[:2] == b'\xff\xd8':
        mime = "image/jpeg"
    else:
        mime = "image/jpeg"

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime};base64,{image_b64}"},
                    },
                    {"type": "text", "text": CARD_SCAN_PROMPT},
                ],
            }
        ],
        max_tokens=300,
    )

    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)


async def draft_followup(
    prospect_name: str,
    company: str,
    title: str,
    capture_notes: str = "",
    meeting_notes: str = "",
    product_interest: str = "",
    next_step: str = "",
    sequence_step: int = 1,
) -> str:
    step_context = {
        1: "This is the first follow-up (Day 1 after event). Keep it warm and reference the conversation.",
        2: "This is the second follow-up (Day 3). They haven't responded. Be brief, add value, easy opt-out.",
        3: "This is the third and final follow-up (Day 7). Last attempt. Very short, no pressure.",
    }.get(sequence_step, "Standard follow-up.")

    user_content = f"""Prospect: {prospect_name}, {title} at {company}
{step_context}
Meeting/Capture Notes: {capture_notes or meeting_notes or 'Brief conversation at conference'}
Product Interest: {product_interest or 'general interest'}
Agreed Next Step: {next_step or 'none specified'}"""

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": FOLLOWUP_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        temperature=0.5,
        max_tokens=250,
    )
    return response.choices[0].message.content.strip()
