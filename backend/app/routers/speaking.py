import os
import re
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from groq import APIConnectionError, APIStatusError, Groq, RateLimitError
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.speaking import SpeakingTopic
from app.routers.auth import get_current_user


router = APIRouter(prefix="/speaking", tags=["Speaking Practice"])

MAX_AUDIO_BYTES = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".webm", ".mp4", ".m4a", ".mp3", ".wav", ".ogg"}

VERIFIED_EXAMPLES = {
    "she go to school every day": (
        "She goes to school every day.",
        "In the simple present, use 'goes' with 'she': 'she goes'.",
    ),
    "my sister go to school at eight": (
        "My sister goes to school at eight.",
        "'My sister' is third person singular, like 'she'. "
        "In the simple present, use 'goes': 'my sister goes'.",
    ),
}


class TopicResponse(BaseModel):
    id: int
    slug: str
    title: str
    prompt: str
    points: list[str]


class PartResponse(BaseModel):
    label: str
    title: str
    tip: str
    preparation_seconds: int
    practice_seconds: int
    topics: list[TopicResponse]


class TranscriptResponse(BaseModel):
    transcript: str


class FeedbackRequest(BaseModel):
    transcript: str = Field(min_length=1, max_length=6000)
    prompt: str | None = Field(default=None, max_length=500)


class GrammarCorrection(BaseModel):
    original: str
    corrected: str
    explanation: str


class FeedbackResponse(BaseModel):
    summary: str
    strengths: list[str]
    grammar_corrections: list[GrammarCorrection]
    next_step: str


PART_SETTINGS = {
    "part1": {
        "label": "Part 1",
        "title": "Familiar topics",
        "tip": "Answer naturally. Add a reason or a short example.",
        "preparation_seconds": 0,
        "practice_seconds": 300,
    },
    "part2": {
        "label": "Part 2",
        "title": "Long turn",
        "tip": "Take one minute to plan. Try speaking for one to two minutes.",
        "preparation_seconds": 60,
        "practice_seconds": 120,
    },
    "part3": {
        "label": "Part 3",
        "title": "Discussion",
        "tip": "Explain your views and support them with reasons or examples.",
        "preparation_seconds": 0,
        "practice_seconds": 300,
    },
}


@router.get("/topics", response_model=dict[str, PartResponse])
def list_speaking_topics(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    parts = {
        key: PartResponse(**settings, topics=[])
        for key, settings in PART_SETTINGS.items()
    }

    rows = db.scalars(
        select(SpeakingTopic)
        .where(
            SpeakingTopic.status == "published",
            SpeakingTopic.part.in_(tuple(PART_SETTINGS)),
        )
        .order_by(
            SpeakingTopic.part,
            SpeakingTopic.position,
            SpeakingTopic.id,
        )
    ).all()

    for row in rows:
        parts[row.part].topics.append(
            TopicResponse(
                id=row.id,
                slug=row.slug,
                title=row.title,
                prompt=row.prompt,
                points=row.points,
            )
        )

    return parts


@router.post("/transcribe", response_model=TranscriptResponse)
def transcribe_audio(
    audio: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    extension = Path(audio.filename or "").suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail="Please upload a WebM, MP4, M4A, MP3, WAV or OGG file.",
        )

    audio_bytes = audio.file.read(MAX_AUDIO_BYTES + 1)

    if not audio_bytes:
        raise HTTPException(status_code=422, detail="The audio file is empty.")

    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Audio must be 10 MB or smaller.",
        )

    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Speaking transcription is not configured.",
        )

    try:
        with Groq(api_key=api_key, timeout=45.0, max_retries=0) as client:
            result = client.audio.transcriptions.create(
                file=(f"recording{extension}", audio_bytes),
                model="whisper-large-v3-turbo",
                language="en",
                response_format="json",
                temperature=0.0,
            )
    except RateLimitError:
        raise HTTPException(
            status_code=429,
            detail="Transcription is busy. Please try again shortly.",
        ) from None
    except APIConnectionError:
        raise HTTPException(
            status_code=502,
            detail="Could not reach the transcription service. Please try again.",
        ) from None
    except APIStatusError as exc:
        if exc.status_code in {400, 415, 422}:
            raise HTTPException(
                status_code=422,
                detail="Could not read this audio. Please try another recording.",
            ) from None

        raise HTTPException(
            status_code=502,
            detail="The transcription service could not complete the request.",
        ) from None

    transcript = (result.text or "").strip()

    if not transcript:
        raise HTTPException(
            status_code=422,
            detail="No speech was transcribed. Please record again.",
        )

    return TranscriptResponse(transcript=transcript)


@router.post("/feedback", response_model=FeedbackResponse)
def get_speaking_feedback(
    body: FeedbackRequest,
    current_user=Depends(get_current_user),
):
    transcript = body.transcript.strip()

    if not transcript:
        raise HTTPException(
            status_code=422,
            detail="Please provide a transcript.",
        )

    corrections: list[GrammarCorrection] = []
    seen: set[str] = set()

    for sentence in re.split(r"(?<=[.!?])\s+", transcript):
        original = sentence.strip()
        key = " ".join(original.rstrip(".!").casefold().split())
        example = VERIFIED_EXAMPLES.get(key)

        if example is None or key in seen:
            continue

        corrected, explanation = example
        corrections.append(
            GrammarCorrection(
                original=original,
                corrected=corrected,
                explanation=explanation,
            )
        )
        seen.add(key)

    return FeedbackResponse(
        summary=(
            "Review the grammar tip below."
            if len(corrections) == 1
            else "Review the grammar tips below."
            if corrections
            else "No verified grammar tips for this answer."
        ),
        strengths=[],
        grammar_corrections=corrections,
        next_step="Try answering again. Add one reason or a short example.",
    )