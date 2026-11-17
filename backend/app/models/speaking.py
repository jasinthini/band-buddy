from sqlalchemy import JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SpeakingTopic(Base):
    __tablename__ = "speaking_topics"
    __table_args__ = (
        UniqueConstraint("part", "slug", name="uq_speaking_topic_part_slug"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    part: Mapped[str] = mapped_column(String(10), nullable=False)
    slug: Mapped[str] = mapped_column(String(180), nullable=False)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    points: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    position: Mapped[int] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(
        String(12), nullable=False, default="draft", server_default="draft"
    )