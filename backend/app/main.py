"""FormBuilder API — FastAPI entrypoint."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)

app = FastAPI(
    title="FormBuilder API",
    description="Form generation platform with LangGraph AI agent for electrical installations",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS ───────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:5173",  # Vite dev
        "http://localhost:3000",  # Docker local
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Health check ───────────────────────────────────────────────────────────


@app.get("/health")
async def health():
    return {"status": "ok", "service": "formbuilder-backend", "environment": settings.environment}


# ─── Mount routers ──────────────────────────────────────────────────────────

from app.api.routes.auth import router as auth_router
from app.api.routes.forms import router as forms_router
from app.api.routes.submissions import router as submissions_router
from app.api.routes.agent import router as agent_router
from app.api.routes.dashboard import router as dashboard_router

app.include_router(auth_router, prefix="/api")
app.include_router(forms_router, prefix="/api")
app.include_router(submissions_router, prefix="/api")
app.include_router(agent_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")


# ─── Startup / shutdown ────────────────────────────────────────────────────


@app.on_event("startup")
async def on_startup():
    logging.info("FormBuilder API starting — environment=%s", settings.environment)


@app.on_event("shutdown")
async def on_shutdown():
    from app.db.session import engine
    await engine.dispose()
    logging.info("FormBuilder API shutting down")
