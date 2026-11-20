import hashlib
import hmac
import logging
import os
import secrets
import smtplib
import ssl

from google.auth.exceptions import GoogleAuthError, TransportError
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token

from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from urllib.parse import urlencode, urlsplit

import jwt

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.user import LoginResponse, UserLogin, UserRegister, UserResponse
from app.services.security import (
    JWT_ALGORITHM,
    JWT_SECRET_KEY,
    create_access_token,
    hash_password,
    verify_password,
)


router = APIRouter(prefix="/auth", tags=["Authentication"])
bearer_scheme = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)

RESET_RESPONSE = {
    "message": "If an account exists for that email, we’ll send a reset link."
}


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=1, max_length=4096)
    password: str = Field(min_length=12, max_length=128)


def password_fingerprint(password_hash: str, reset_secret: str) -> str:
    return hmac.new(
        reset_secret.encode("utf-8"),
        password_hash.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def get_reset_secret() -> str:
    secret = os.getenv("PASSWORD_RESET_SECRET", "")
    if len(secret) < 32:
        raise HTTPException(
            status_code=503,
            detail="Password reset is temporarily unavailable.",
        )
    return secret


def send_reset_email(
    recipient: str,
    reset_url: str,
    sender: str,
    smtp_password: str,
) -> None:
    message = EmailMessage()
    message["Subject"] = "Reset your Band Buddy password"
    message["From"] = sender
    message["To"] = recipient
    message.set_content(
        "Use this link to set a new Band Buddy password:\n\n"
        f"{reset_url}\n\n"
        "This link expires in 20 minutes. "
        "If you didn’t request a reset, you can ignore this email."
    )

    try:
        with smtplib.SMTP_SSL(
            "smtp.gmail.com",
            465,
            context=ssl.create_default_context(),
            timeout=15,
        ) as smtp:
            smtp.login(sender, smtp_password)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        logger.warning("Password reset email failed: %s", type(exc).__name__)


@router.post("/forgot-password")
def forgot_password(
    data: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    secret = get_reset_secret()
    sender = os.getenv("RESET_SMTP_EMAIL", "").strip()
    smtp_password = os.getenv("RESET_SMTP_APP_PASSWORD", "").replace(" ", "")
    frontend = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    origin = urlsplit(frontend)

    if (
        not sender
        or not smtp_password
        or not origin.hostname
        or (
            origin.scheme != "https"
            and not (
                origin.scheme == "http"
                and origin.hostname in {"localhost", "127.0.0.1"}
            )
        )
        or origin.username
        or origin.password
        or origin.path
        or origin.query
        or origin.fragment
    ):
        raise HTTPException(
            status_code=503,
            detail="Password reset is temporarily unavailable.",
        )

    user = db.scalar(select(User).where(User.email == str(data.email).lower()))

    if user is None or user.password_hash is None:
        return RESET_RESPONSE

    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": str(user.id),
            "type": "password_reset",
            "iat": now,
            "exp": now + timedelta(minutes=20),
            "jti": secrets.token_urlsafe(16),
            "fingerprint": password_fingerprint(user.password_hash, secret),
        },
        secret,
        algorithm="HS256",
    )

    reset_url = f"{frontend}/login#{urlencode({'reset_token': token})}"
    background_tasks.add_task(
        send_reset_email, user.email, reset_url, sender, smtp_password
    )
    return RESET_RESPONSE


@router.post("/reset-password")
def reset_password(
    data: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    secret = get_reset_secret()
    invalid = HTTPException(
        status_code=400,
        detail="This reset link is invalid or expired. Please request a new link.",
    )

    try:
        payload = jwt.decode(
            data.token,
            secret,
            algorithms=["HS256"],
            options={"require": ["sub", "exp", "iat", "jti", "fingerprint"]},
        )
        if payload.get("type") != "password_reset":
            raise invalid
        user_id = int(payload["sub"])
        fingerprint = payload["fingerprint"]
        if user_id <= 0 or not isinstance(fingerprint, str):
            raise invalid
    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise invalid

    user = db.get(User, user_id)
    if user is None or user.password_hash is None:
        raise invalid

    old_hash = user.password_hash
    if not hmac.compare_digest(
        password_fingerprint(old_hash, secret), fingerprint
    ):
        raise invalid

    result = db.execute(
        update(User)
        .where(User.id == user_id, User.password_hash == old_hash)
        .values(password_hash=hash_password(data.password))
    )

    if result.rowcount != 1:
        db.rollback()
        raise invalid

    db.commit()
    return {"message": "Password updated. You can now log in."}


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_user(data: UserRegister, db: Session = Depends(get_db)):
    email = str(data.email).lower()
    existing_user = db.scalar(select(User).where(User.email == email))

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        full_name=data.full_name,
        email=email,
        password_hash=hash_password(data.password),
        role="student",
    )
    db.add(user)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    db.refresh(user)
    return user


@router.post("/login", response_model=LoginResponse)
def login_user(data: UserLogin, db: Session = Depends(get_db)):
    email = str(data.email).lower()
    user = db.scalar(select(User).where(User.email == email))

    if (
        user is None
        or user.password_hash is None
        or not verify_password(data.password, user.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return LoginResponse(
        access_token=create_access_token(user.id),
        user=UserResponse.model_validate(user),
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    auth_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise auth_error

    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "exp", "iat"]},
        )
        if payload.get("type") != "access":
            raise auth_error
        user_id = int(payload["sub"])
        if user_id <= 0:
            raise auth_error
    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise auth_error

    user = db.get(User, user_id)
    if user is None:
        raise auth_error

    return user


@router.get("/me", response_model=UserResponse)
def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access is required.",
        )
    return current_user


@router.get("/admin-check", response_model=UserResponse)
def check_admin_access(current_user: User = Depends(require_admin)):
    return current_user


class GoogleLoginRequest(BaseModel):
    credential: str = Field(min_length=1, max_length=8192)


@router.post("/google", response_model=LoginResponse)
def login_with_google(
    data: GoogleLoginRequest,
    db: Session = Depends(get_db),
):
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    if not client_id:
        raise HTTPException(503, "Google sign-in is not configured.")

    try:
        claims = id_token.verify_oauth2_token(
            data.credential,
            GoogleRequest(),
            audience=client_id,
        )
    except TransportError:
        raise HTTPException(503, "Google verification is unavailable. Try again.") from None
    except (ValueError, GoogleAuthError):
        raise HTTPException(401, "Google sign-in could not be verified.") from None

    google_sub = claims.get("sub")
    email = str(claims.get("email") or "").strip().lower()

    if (
        not isinstance(google_sub, str)
        or not 1 <= len(google_sub) <= 255
        or not email
        or len(email) > 254
        or claims.get("email_verified") is not True
    ):
        raise HTTPException(401, "A verified Google account is required.")

    user = db.scalar(select(User).where(User.google_sub == google_sub))

    if user is None:
        existing_user = db.scalar(select(User).where(User.email == email))
        if existing_user is not None:
            raise HTTPException(
                409,
                "An account already uses this email. Log in with your Band Buddy password.",
            )

        full_name = (str(claims.get("name") or "").strip() or "Band Buddy Student")[:100]
        user = User(
            full_name=full_name,
            email=email,
            password_hash=None,
            google_sub=google_sub,
            role="student",
        )
        db.add(user)

        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            user = db.scalar(select(User).where(User.google_sub == google_sub))
            if user is None:
                raise HTTPException(
                    409,
                    "Could not create the account. Use your usual sign-in method.",
                ) from None

    return LoginResponse(
        access_token=create_access_token(user.id),
        user=UserResponse.model_validate(user),
    )