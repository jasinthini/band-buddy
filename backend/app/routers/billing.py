from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.billing import BillingOrder, StudentPlanAccess
from app.models.user import User
from app.routers.auth import get_current_user


router = APIRouter(prefix="/billing", tags=["Billing"])

PaidPlan = Literal["starter", "plus", "premium"]

PLAN_PRICES_LKR = {
    "starter": 990,
    "plus": 1490,
    "premium": 1990,
}


class CreateOrderRequest(BaseModel):
    plan_id: PaidPlan


class OrderResponse(BaseModel):
    order_id: str
    plan_id: str
    amount_lkr: int
    status: str


class MyPlanResponse(BaseModel):
    plan_id: str | None = None
    status: Literal["inactive", "active", "expired"]
    starts_at: datetime | None = None
    ends_at: datetime | None = None


@router.post(
    "/orders",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_order(
    data: CreateOrderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrderResponse:
    # The MySQL DateTime columns store UTC without a timezone offset.
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    order = BillingOrder(
        id=str(uuid4()),
        user_id=current_user.id,
        plan_id=data.plan_id,
        amount_lkr=PLAN_PRICES_LKR[data.plan_id],
        status="pending",
        created_at=now,
    )

    db.add(order)
    db.commit()

    return OrderResponse(
        order_id=order.id,
        plan_id=order.plan_id,
        amount_lkr=order.amount_lkr,
        status=order.status,
    )


@router.get("/my-plan", response_model=MyPlanResponse)
def get_my_plan(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MyPlanResponse:
    access = db.get(StudentPlanAccess, current_user.id)

    if access is None:
        return MyPlanResponse(status="inactive")

    now = datetime.now(timezone.utc)
    starts_at = access.starts_at.replace(tzinfo=timezone.utc)
    ends_at = access.ends_at.replace(tzinfo=timezone.utc)

    if now >= ends_at:
        plan_status = "expired"
    elif now >= starts_at:
        plan_status = "active"
    else:
        plan_status = "inactive"

    return MyPlanResponse(
        plan_id=access.plan_id,
        status=plan_status,
        starts_at=starts_at,
        ends_at=ends_at,
    )