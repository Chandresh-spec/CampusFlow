from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.database import init_db
from app.routers import auth, profile, academic, resource, notice, chat

settings = get_settings()

import asyncio
from app.worker import poll_sqs_loop

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await init_db()
    except Exception as e:
        print(f"[DB] init_db note: {e}")

    worker_task = None
    if settings.SQS_QUEUE_URL:
        worker_task = asyncio.create_task(poll_sqs_loop())

    yield

    if worker_task:
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            pass

app = FastAPI(
    title="Smart College System API",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://campus-flow.duckdns.org",
        "https://campus-flow.duckdns.org",
    ],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(academic.router)
app.include_router(resource.router)
app.include_router(notice.router)
app.include_router(chat.router)
app.include_router(chat.chat_group_router)

@app.get("/health", tags=["system"])
async def health_check():
    return {"status": "ok"}
