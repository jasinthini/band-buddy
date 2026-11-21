import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.auth import router as auth_router
from app.routers.dashboard import (
    require_writing_access,
    router as dashboard_router,
)
from app.routers.writing import router as writing_router
from app.routers.practice_history import (
    router as practice_history_router,
)
from app.routers.speaking import router as speaking_router
from app.routers.admin_speaking import (
    router as admin_speaking_router,
)
from app.routers.billing import router as billing_router
from app.routers.admin_billing import (
    router as admin_billing_router,
)
from app.routers.admin_resources import (
    router as admin_resources_router,
)


env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)

default_origins = (
    "http://localhost:5173,"
    "http://127.0.0.1:5173,"
    "http://localhost:5174,"
    "http://127.0.0.1:5174"
    "https://band-buddy-seven.vercel.app",
)

allowed_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "CORS_ORIGINS",
        default_origins,
    ).split(",")
    if origin.strip()
]

app = FastAPI(title="Band Buddy API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.get("/")
def health_check():
    return {"message": "Band Buddy API is running"}


app.include_router(auth_router)
app.include_router(dashboard_router)

app.include_router(
    writing_router,
    dependencies=[Depends(require_writing_access)],
)

app.include_router(practice_history_router)
app.include_router(speaking_router)
app.include_router(admin_speaking_router)
app.include_router(billing_router)
app.include_router(admin_billing_router)
app.include_router(admin_resources_router)