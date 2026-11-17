from datetime import date, datetime, timedelta
from math import ceil
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.learning import LearningProfile
from app.models.user import User
from app.models.writing import WritingAttempt, WritingQuestion
from app.routers.auth import get_current_user


router = APIRouter(prefix="/dashboard", tags=["Dashboard"])
TRIAL_DAYS = 14


class GoalInput(BaseModel):
    target_band: float = Field(ge=1, le=9)
    test_type: Literal["academic", "general"]
    exam_date: date | None = None
    daily_minutes: int = Field(ge=5, le=180)
    focus_skill: Literal["writing", "speaking", "reading", "listening"]

    @field_validator("target_band")
    @classmethod
    def validate_band(cls, value):
        if value * 2 != int(value * 2):
            raise ValueError("Choose a whole or half band, such as 6 or 6.5.")
        return value


class SettingsInput(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)

    @field_validator("full_name")
    @classmethod
    def clean_name(cls, value):
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Enter at least two characters.")
        return value


def database_now(db: Session) -> datetime:
    return db.scalar(select(func.now()))


def goal_response(profile):
    if profile is None or any(
        getattr(profile, field) is None
        for field in ("target_band", "test_type", "daily_minutes", "focus_skill")
    ):
        return None

    return {
        "target_band": profile.target_band,
        "test_type": profile.test_type,
        "exam_date": profile.exam_date,
        "daily_minutes": profile.daily_minutes,
        "focus_skill": profile.focus_skill,
    }


def access_details(db: Session, user: User):
    now = database_now(db)
    trial_end = user.created_at + timedelta(days=TRIAL_DAYS)
    profile = db.get(LearningProfile, user.id)
    paid_until = profile.paid_until if profile else None
    paid_active = paid_until is not None and paid_until > now
    remaining = max(0, ceil((trial_end - now).total_seconds()))

    return {
        "trial_days": TRIAL_DAYS,
        "trial_active": remaining > 0,
        "remaining_seconds": remaining,
        "trial_ends_at": trial_end.isoformat(),
        "paid_active": paid_active,
        "can_practice": remaining > 0 or paid_active,
    }


def attempt_response(attempt, question):
    return {
        "id": attempt.id,
        "question_id": attempt.question_id,
        "title": question.title,
        "category": question.category,
        "status": attempt.status,
        "word_count": attempt.word_count,
        "updated_at": attempt.updated_at,
        "has_feedback": attempt.feedback is not None,
    }


@router.get("/goal")
def get_goal(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"goal": goal_response(db.get(LearningProfile, user.id))}


@router.get("/overview")
def get_overview(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    statements = (
        select(WritingAttempt, WritingQuestion)
        .join(WritingQuestion, WritingQuestion.id == WritingAttempt.question_id)
        .where(WritingAttempt.user_id == user.id)
        .order_by(WritingAttempt.updated_at.desc(), WritingAttempt.id.desc())
    )

    recent = db.execute(statements.limit(5)).all()
    drafts = db.execute(
        statements.where(WritingAttempt.status == "draft").limit(3)
    ).all()

    return {
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
        },
        "access": access_details(db, user),
        "goal": goal_response(db.get(LearningProfile, user.id)),
        "recent_attempts": [attempt_response(a, q) for a, q in recent],
        "drafts": [attempt_response(a, q) for a, q in drafts],
    }


@router.put("/goal")
def save_goal(
    data: GoalInput,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = user.id

    try:
        # Lock the existing user row even when the profile does not exist yet.
        db.execute(select(User.id).where(User.id == user_id).with_for_update()).scalar_one()

        profile = db.scalar(
            select(LearningProfile)
            .where(LearningProfile.user_id == user_id)
            .with_for_update()
        )

        if goal_response(profile) is not None:
            raise HTTPException(
                status_code=409,
                detail="Your goal is already saved and cannot be changed.",
            )

        if data.exam_date and data.exam_date < database_now(db).date():
            raise HTTPException(
                status_code=422,
                detail="Choose today or a future exam date.",
            )

        if profile is None:
            profile = LearningProfile(user_id=user_id)
            db.add(profile)

        for key, value in data.model_dump().items():
            setattr(profile, key, value)

        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Your goal could not be saved. Reload and check your saved goal.",
        ) from None
    except Exception:
        db.rollback()
        raise

    db.refresh(profile)
    return goal_response(profile)


@router.put("/settings")
def save_settings(
    data: SettingsInput,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user.full_name = data.full_name

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(user)
    return {"id": user.id, "full_name": user.full_name, "email": user.email}


def require_writing_access(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    needs_access = (
        request.url.path.rstrip("/").endswith("/questions")
        or request.method in {"POST", "PUT", "PATCH", "DELETE"}
    )

    if not needs_access:
        return

    if user.role == "student" and goal_response(db.get(LearningProfile, user.id)) is None:
        raise HTTPException(
            status_code=403,
            detail="Save your IELTS goal before practising.",
        )

    if not access_details(db, user)["can_practice"]:
        raise HTTPException(
            status_code=403,
            detail="Your free trial has ended. Open Plans & Billing.",
        )


@router.put("/goal/settings")
def update_goal_settings(
    data: GoalInput,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        profile = db.scalar(
            select(LearningProfile)
            .where(LearningProfile.user_id == user.id)
            .with_for_update()
        )

        if profile is None or goal_response(profile) is None:
            raise HTTPException(
                status_code=409,
                detail="Set up your IELTS goal before editing it.",
            )

        if (
            data.exam_date is not None
            and data.exam_date != profile.exam_date
            and data.exam_date < database_now(db).date()
        ):
            raise HTTPException(
                status_code=422,
                detail="Choose today or a future exam date.",
            )

        for key, value in data.model_dump().items():
            setattr(profile, key, value)

        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(profile)
    return goal_response(profile)