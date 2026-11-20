from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class BillingOrder(Base):
    __tablename__ = "billing_orders"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    plan_id: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    amount_lkr: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
        server_default="pending",
    )

    provider_reference: Mapped[str | None] = mapped_column(
        String(100),
        unique=True,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
    )

    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )


class StudentPlanAccess(Base):
    __tablename__ = "student_plan_access"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        primary_key=True,
    )

    plan_id: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    order_id: Mapped[str] = mapped_column(
        ForeignKey("billing_orders.id"),
        nullable=False,
        unique=True,
    )

    starts_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
    )

    ends_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
    )