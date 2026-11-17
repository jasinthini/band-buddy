from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.billing import BillingOrder, StudentPlanAccess
from app.models.user import User
from app.routers.auth import require_admin


router = APIRouter(
    prefix="/admin/billing",
    tags=["Admin Billing"],
    dependencies=[Depends(require_admin)],
)


@router.get("/overview")
def get_billing_overview(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    total_students = db.scalar(
        select(func.count()).select_from(User).where(User.role == "student")
    )
    active_plans = db.scalar(
        select(func.count())
        .select_from(StudentPlanAccess)
        .where(
            StudentPlanAccess.starts_at <= now,
            StudentPlanAccess.ends_at > now,
        )
    )
    pending_orders = db.scalar(
        select(func.count())
        .select_from(BillingOrder)
        .where(BillingOrder.status == "pending")
    )
    paid_total = db.scalar(
        select(func.coalesce(func.sum(BillingOrder.amount_lkr), 0))
        .where(BillingOrder.status == "paid")
    )

    return {
        "total_students": total_students,
        "active_plans": active_plans,
        "pending_orders": pending_orders,
        "paid_total_lkr": paid_total,
    }


@router.get("/orders")
def list_billing_orders(
    db: Session = Depends(get_db),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
):
    total = db.scalar(select(func.count()).select_from(BillingOrder))
    rows = db.execute(
        select(BillingOrder, User.full_name, User.email)
        .join(User, User.id == BillingOrder.user_id)
        .order_by(BillingOrder.created_at.desc(), BillingOrder.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()

    return {
        "total": total,
        "orders": [
            {
                "order_id": order.id,
                "student_name": full_name,
                "student_email": email,
                "plan_id": order.plan_id,
                "amount_lkr": order.amount_lkr,
                "status": order.status,
                "created_at": order.created_at.replace(tzinfo=timezone.utc),
                "paid_at": (
                    order.paid_at.replace(tzinfo=timezone.utc)
                    if order.paid_at is not None
                    else None
                ),
            }
            for order, full_name, email in rows
        ],
    }

@router.get("/students")
def list_students(
    db: Session = Depends(get_db),
    search: str = Query(default="", max_length=254),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
):
    filters = [User.role == "student"]
    term = search.strip()

    if term:
        filters.append(
            User.full_name.icontains(term, autoescape=True)
            | User.email.icontains(term, autoescape=True)
        )

    total = db.scalar(
        select(func.count()).select_from(User).where(*filters)
    )

    rows = db.execute(
        select(
            User.id,
            User.full_name,
            User.email,
            StudentPlanAccess.plan_id,
            StudentPlanAccess.starts_at,
            StudentPlanAccess.ends_at,
        )
        .outerjoin(StudentPlanAccess, StudentPlanAccess.user_id == User.id)
        .where(*filters)
        .order_by(User.full_name, User.id)
        .offset(offset)
        .limit(limit)
    ).all()

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    students = []

    for user_id, full_name, email, plan_id, starts_at, ends_at in rows:
        plan_status = "inactive"
        if ends_at is not None and ends_at <= now:
            plan_status = "expired"
        elif starts_at is not None and starts_at <= now:
            plan_status = "active"

        students.append({
            "id": user_id,
            "full_name": full_name,
            "email": email,
            "plan_id": plan_id,
            "plan_status": plan_status,
            "ends_at": (
                ends_at.replace(tzinfo=timezone.utc)
                if ends_at is not None
                else None
            ),
        })

    return {"total": total, "students": students}