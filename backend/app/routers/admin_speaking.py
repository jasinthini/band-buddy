import re
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.speaking import SpeakingTopic
from app.routers.auth import require_admin


router = APIRouter(
    prefix="/admin/speaking",
    tags=["Admin Speaking"],
    dependencies=[Depends(require_admin)],
)

Part = Literal["part1", "part2", "part3"]
TopicStatus = Literal["draft", "published"]
Point = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)
]
EXPECTED_POINTS = {"part1": 4, "part2": 4, "part3": 3}


class TopicInput(BaseModel):
    part: Part
    title: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=180)
    ]
    prompt: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)
    ]
    points: list[Point] = Field(min_length=3, max_length=4)

    @model_validator(mode="after")
    def check_points(self):
        expected = EXPECTED_POINTS[self.part]
        if len(self.points) != expected:
            raise ValueError(f"{self.part} needs exactly {expected} points.")
        return self


class TopicStatusInput(BaseModel):
    status: TopicStatus


class TopicResponse(TopicInput):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    position: int
    status: TopicStatus


def get_topic(db: Session, topic_id: int) -> SpeakingTopic:
    topic = db.get(SpeakingTopic, topic_id)
    if topic is None:
        raise HTTPException(status_code=404, detail="Speaking topic not found.")
    return topic


def next_position(db: Session, part: Part) -> int:
    highest = db.scalar(
        select(func.max(SpeakingTopic.position)).where(SpeakingTopic.part == part)
    )
    return (highest or 0) + 1


def save_topic(db: Session, topic: SpeakingTopic) -> SpeakingTopic:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A topic with the same slug already exists in this part.",
        ) from None

    db.refresh(topic)
    return topic


@router.get("/topics", response_model=list[TopicResponse])
def list_topics(
    part: Part | None = None,
    db: Session = Depends(get_db),
):
    query = select(SpeakingTopic)
    if part is not None:
        query = query.where(SpeakingTopic.part == part)

    return db.scalars(
        query.order_by(SpeakingTopic.part, SpeakingTopic.position, SpeakingTopic.id)
    ).all()


@router.post("/topics", response_model=TopicResponse, status_code=201)
def create_topic(data: TopicInput, db: Session = Depends(get_db)):
    slug = re.sub(r"[^a-z0-9]+", "-", data.title.lower()).strip("-")
    if not slug:
        raise HTTPException(
            status_code=422,
            detail="Use at least one English letter or number in the title.",
        )

    topic = SpeakingTopic(
        **data.model_dump(),
        slug=slug,
        position=next_position(db, data.part),
        status="draft",
    )
    db.add(topic)
    return save_topic(db, topic)


@router.put("/topics/{topic_id}", response_model=TopicResponse)
def update_topic(topic_id: int, data: TopicInput, db: Session = Depends(get_db)):
    topic = get_topic(db, topic_id)

    if topic.part != data.part:
        topic.position = next_position(db, data.part)

    topic.part = data.part
    topic.title = data.title
    topic.prompt = data.prompt
    topic.points = data.points
    return save_topic(db, topic)


@router.patch("/topics/{topic_id}/status", response_model=TopicResponse)
def update_status(
    topic_id: int,
    data: TopicStatusInput,
    db: Session = Depends(get_db),
):
    topic = get_topic(db, topic_id)
    topic.status = data.status
    return save_topic(db, topic)