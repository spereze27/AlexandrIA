"""FormBuilder API — FastAPI entrypoint."""

import logging
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="FormBuilder API",
    description="Form generation platform with LangGraph AI agent for electrical installations",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── Global exception handler ──────────────────────────────────────────────
# CRITICAL: Unhandled exceptions bypass CORS middleware, so the browser sees
# "CORS Missing Allow Origin" instead of the real error.
# This handler catches ALL unhandled errors and returns a proper JSON 500
# *after* CORS headers are already applied by the middleware.

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        "Unhandled exception on %s %s: %s\n%s",
        request.method,
        request.url.path,
        exc,
        traceback.format_exc(),
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": f"Internal server error: {type(exc).__name__}: {exc}",
            "path": str(request.url.path),
        },
    )


# ─── CORS ───────────────────────────────────────────────────────────────────
# allow_origin_regex covers ANY Cloud Run revision URL.
# The subdomain hash changes on every deploy so we can't hardcode origins.
#
# Covered patterns:
#   https://formbuilder-frontend-<hash>-uc.a.run.app         (old format)
#   https://formbuilder-frontend-<id>.<region>.run.app        (new format)
#   https://formbuilder-backend-<hash>-uc.a.run.app           (backend too)
#   https://formbuilder-backend-<id>.<region>.run.app
#   http://localhost:5173  /  http://localhost:3000             (dev)

_CLOUD_RUN_REGEX = (
    # Old format: formbuilder-{service}-{hash}-{region_code}.a.run.app
    r"https://formbuilder-[a-z]+-[a-z0-9]+-[a-z]{2}\.a\.run\.app"
    # New format: formbuilder-{service}-{project_number}.{region}.run.app
    r"|https://formbuilder-[a-z]+-[0-9]+\.[a-z0-9-]+\.run\.app"
    # Catch-all Cloud Run: anything under *.run.app with formbuilder prefix
    r"|https://formbuilder-[a-z0-9-]+\.run\.app"
    # Dev local
    r"|http://localhost:(5173|3000)"
)

_exact_origins = ["http://localhost:5173", "http://localhost:3000"]
if settings.frontend_url and "localhost" not in settings.frontend_url:
    _exact_origins.append(settings.frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_exact_origins,
    allow_origin_regex=_CLOUD_RUN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health check ───────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "formbuilder-backend",
        "environment": settings.environment,
    }


# ─── Diagnostic endpoint (remove in production) ────────────────────────────

@app.get("/debug/check")
async def debug_check():
    """Checks DB connection, env vars, and returns diagnostics.
    Remove this endpoint once everything works.
    """
    checks = {}

    # Check env vars
    checks["env"] = {
        "ENVIRONMENT": settings.environment,
        "DB_HOST": settings.db_host[:30] + "..." if len(settings.db_host) > 30 else settings.db_host,
        "DB_NAME": settings.db_name,
        "GEMINI_API_KEY": "SET" if settings.gemini_api_key and settings.gemini_api_key != "SET_BY_GITHUB_ACTIONS" else "MISSING",
        "GOOGLE_OAUTH_CLIENT_ID": "SET" if settings.google_oauth_client_id and settings.google_oauth_client_id != "SET_BY_GITHUB_ACTIONS" else "MISSING",
        "GOOGLE_OAUTH_CLIENT_SECRET": "SET" if settings.google_oauth_client_secret and settings.google_oauth_client_secret != "SET_BY_GITHUB_ACTIONS" else "MISSING",
        "JWT_SECRET": "SET" if settings.jwt_secret and settings.jwt_secret != "dev-secret-change-me" else "MISSING/DEFAULT",
        "GCS_BUCKET_NAME": settings.gcs_bucket_name,
        "FRONTEND_URL": settings.frontend_url,
    }

    # Check DB connection
    try:
        from app.db.session import engine
        from sqlalchemy import text
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            checks["database"] = "OK"

            # Check if tables exist
            result = await conn.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' ORDER BY table_name"
            ))
            tables = [row[0] for row in result]
            checks["tables"] = tables if tables else "NO TABLES — run migrations!"
    except Exception as e:
        checks["database"] = f"FAILED: {e}"

    return checks


# ─── Mount routers ──────────────────────────────────────────────────────────

from app.api.routes.auth import router as auth_router
from app.api.routes.forms import router as forms_router
from app.api.routes.submissions import router as submissions_router
from app.api.routes.agent import router as agent_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.setup import router as setup_router

app.include_router(auth_router, prefix="/api")
app.include_router(forms_router, prefix="/api")
app.include_router(submissions_router, prefix="/api")
app.include_router(agent_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(setup_router)


# ─── Startup / shutdown ─────────────────────────────────────────────────────

@app.on_event("startup")
async def on_startup():
    logger.info("FormBuilder API starting — environment=%s", settings.environment)


@app.on_event("shutdown")
async def on_shutdown():
    from app.db.session import engine
    await engine.dispose()
    logger.info("FormBuilder API shutting down")