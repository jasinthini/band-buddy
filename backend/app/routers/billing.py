import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import uuid4

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.billing import BillingOrder, StudentPlanAccess
from app.models.learning import LearningProfile
from app.models.user import User
from app.routers.auth import get_current_user


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/billing",
    tags=["Billing"],
)

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


class OrderHistoryItem(OrderResponse):
    created_at: datetime


class MyPlanResponse(BaseModel):
    plan_id: str | None = None
    status: Literal["inactive", "active", "expired"]
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class CheckoutResponse(BaseModel):
    order_id: str
    checkout_url: str


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
    # MySQL DateTime values are stored as naive UTC.
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

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return OrderResponse(
        order_id=order.id,
        plan_id=order.plan_id,
        amount_lkr=order.amount_lkr,
        status=order.status,
    )


@router.post(
    "/orders/{order_id}/checkout",
    response_model=CheckoutResponse,
)
def create_checkout(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CheckoutResponse:
    secret_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
    frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")

    if not secret_key or not frontend_url:
        raise HTTPException(
            status_code=503,
            detail="Payment configuration is incomplete.",
        )

    try:
        # Serialize checkout requests for this order.
        order = db.scalar(
            select(BillingOrder)
            .where(
                BillingOrder.id == order_id,
                BillingOrder.user_id == current_user.id,
            )
            .with_for_update()
        )

        if order is None:
            raise HTTPException(
                status_code=404,
                detail="Order not found.",
            )

        if order.status != "pending":
            raise HTTPException(
                status_code=409,
                detail="This order is no longer awaiting payment.",
            )

        if order.plan_id not in PLAN_PRICES_LKR:
            raise HTTPException(
                status_code=409,
                detail="This order has an unavailable plan.",
            )

        if order.provider_reference:
            if not order.provider_reference.startswith("cs_"):
                raise HTTPException(
                    status_code=409,
                    detail="Please create a new order for Stripe checkout.",
                )

            checkout = stripe.checkout.Session.retrieve(
                order.provider_reference,
                api_key=secret_key,
            )

            if checkout.status != "open" or not checkout.url:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "This checkout has already completed or expired. "
                        "Check My Plan before creating a new order."
                    ),
                )

        else:
            checkout = stripe.checkout.Session.create(
                api_key=secret_key,
                idempotency_key=f"band-buddy-checkout-{order.id}",
                mode="payment",
                client_reference_id=order.id,
                customer_email=current_user.email,
                metadata={
                    "order_id": order.id,
                    "user_id": str(current_user.id),
                    "plan_id": order.plan_id,
                },
                line_items=[
                    {
                        "quantity": 1,
                        "price_data": {
                            "currency": "lkr",
                            "unit_amount": order.amount_lkr * 100,
                            "product_data": {
                                "name": (
                                    f"Band Buddy "
                                    f"{order.plan_id.title()} — 30 days"
                                ),
                                "description": (
                                    "One-time payment for 30 days "
                                    "of IELTS practice access."
                                ),
                            },
                        },
                    }
                ],
                success_url=(
                    f"{frontend_url}/checkout"
                    f"?plan={order.plan_id}"
                    f"&order_id={order.id}"
                    "&payment=success"
                    "&session_id={CHECKOUT_SESSION_ID}"
                ),
                cancel_url=(
                    f"{frontend_url}/checkout"
                    f"?plan={order.plan_id}"
                    f"&order_id={order.id}"
                    "&payment=cancelled"
                ),
            )

            if not checkout.url:
                raise HTTPException(
                    status_code=502,
                    detail="Could not create the payment page.",
                )

            order.provider_reference = checkout.id

        response = CheckoutResponse(
            order_id=order.id,
            checkout_url=checkout.url,
        )

        db.commit()
        return response

    except stripe.StripeError as error:
        db.rollback()

        logger.error(
            "Stripe checkout failed: type=%s code=%s "
            "request_id=%s message=%s",
            type(error).__name__,
            getattr(error, "code", None),
            getattr(error, "request_id", None),
            getattr(error, "user_message", None)
            or "Check Stripe Dashboard request logs for details.",
        )

        raise HTTPException(
            status_code=502,
            detail="Could not open Stripe checkout. Please try again.",
        ) from None

    except Exception:
        db.rollback()
        raise


@router.get(
    "/my-plan",
    response_model=MyPlanResponse,
)
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


@router.get(
    "/my-orders",
    response_model=list[OrderHistoryItem],
)
def get_my_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[OrderHistoryItem]:
    orders = db.scalars(
        select(BillingOrder)
        .where(BillingOrder.user_id == current_user.id)
        .order_by(
            BillingOrder.created_at.desc(),
            BillingOrder.id.desc(),
        )
        .limit(20)
    ).all()

    return [
        OrderHistoryItem(
            order_id=order.id,
            plan_id=order.plan_id,
            amount_lkr=order.amount_lkr,
            status=order.status,
            created_at=order.created_at.replace(tzinfo=timezone.utc),
        )
        for order in orders
    ]


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()

    if not webhook_secret:
        raise HTTPException(
            status_code=503,
            detail="Webhook configuration is incomplete.",
        )

    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload,
            signature,
            webhook_secret,
        )
    except (ValueError, stripe.SignatureVerificationError):
        raise HTTPException(
            status_code=400,
            detail="Invalid webhook payload or signature.",
        ) from None

    supported_events = {
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "checkout.session.async_payment_failed",
        "checkout.session.expired",
    }

    event_type = event["type"]

    if event_type not in supported_events:
        return {"received": True}

    # Convert the Stripe Session and nested metadata to dictionaries.
    checkout = event["data"]["object"].to_dict()
    metadata = checkout.get("metadata") or {}
    order_id = metadata.get("order_id")

    # Ignore sessions without a Band Buddy order.
    if not order_id:
        return {"received": True}

    try:
        user_id = db.scalar(
            select(BillingOrder.user_id)
            .where(BillingOrder.id == order_id)
        )

        if user_id is None:
            return {"received": True}

        # Serialize plan updates for the same student.
        db.execute(
            select(User.id)
            .where(User.id == user_id)
            .with_for_update()
        ).scalar_one()

        order = db.scalar(
            select(BillingOrder)
            .where(BillingOrder.id == order_id)
            .with_for_update()
        )

        # A webhook can arrive while checkout creation is still saving.
        if not order.provider_reference:
            raise HTTPException(
                status_code=503,
                detail="Order checkout is still being saved. Retry delivery.",
            )

        valid_session = (
            checkout.get("id") == order.provider_reference
            and checkout.get("client_reference_id") == order.id
            and metadata.get("user_id") == str(order.user_id)
            and metadata.get("plan_id") == order.plan_id
            and checkout.get("mode") == "payment"
        )

        if not valid_session:
            logger.error(
                "Stripe webhook session mismatch: order_id=%s event_id=%s",
                order.id,
                event["id"],
            )

            raise HTTPException(
                status_code=400,
                detail="Checkout does not match this order.",
            )

        # Repeated delivery must not grant access twice.
        if order.status == "paid":
            db.commit()
            return {"received": True}

        if checkout.get("payment_status") != "paid":
            if event_type == "checkout.session.expired":
                if order.status == "pending":
                    order.status = "expired"

            elif event_type == "checkout.session.async_payment_failed":
                if order.status == "pending":
                    order.status = "failed"

            db.commit()
            return {"received": True}

        valid_payment = (
            order.plan_id in PLAN_PRICES_LKR
            and checkout.get("currency") == "lkr"
            and checkout.get("amount_total") == order.amount_lkr * 100
        )

        if not valid_payment:
            logger.error(
                "Stripe webhook amount or currency mismatch: order_id=%s",
                order.id,
            )

            raise HTTPException(
                status_code=400,
                detail="Payment amount or currency does not match.",
            )

        now = datetime.now(timezone.utc).replace(tzinfo=None)

        access = db.scalar(
            select(StudentPlanAccess)
            .where(StudentPlanAccess.user_id == order.user_id)
            .with_for_update()
        )

        profile = db.scalar(
            select(LearningProfile)
            .where(LearningProfile.user_id == order.user_id)
            .with_for_update()
        )

        # Extend the expiry when renewing the same active plan.
        same_active_plan = (
            access is not None
            and access.plan_id == order.plan_id
            and access.starts_at <= now < access.ends_at
        )

        starts_at = access.starts_at if same_active_plan else now
        expiry_base = access.ends_at if same_active_plan else now
        ends_at = expiry_base + timedelta(days=30)

        if access is None:
            access = StudentPlanAccess(
                user_id=order.user_id,
                plan_id=order.plan_id,
                order_id=order.id,
                starts_at=starts_at,
                ends_at=ends_at,
            )
            db.add(access)
        else:
            access.plan_id = order.plan_id
            access.order_id = order.id
            access.starts_at = starts_at
            access.ends_at = ends_at

        if profile is None:
            profile = LearningProfile(user_id=order.user_id)
            db.add(profile)

        # Synchronize the dashboard's paid-access expiry.
        profile.paid_until = ends_at

        order.status = "paid"
        order.paid_at = datetime.fromtimestamp(
            event["created"],
            tz=timezone.utc,
        ).replace(tzinfo=None)

        # Save the payment and access changes in one transaction.
        db.commit()

        logger.info(
            "Stripe payment activated: order_id=%s plan=%s",
            order.id,
            order.plan_id,
        )

        return {"received": True}

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()

        logger.exception(
            "Stripe webhook processing failed: event_id=%s",
            event["id"],
        )
        raise