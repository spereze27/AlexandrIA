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
# allow_origin_regex cubre CUALQUIER revisión de Cloud Run.
# El hash del subdominio cambia en cada deploy, por eso no podemos usar
# allow_origins con una URL fija — usamos regex en su lugar.
#
# Patrones cubiertos:
#   https://formbuilder-frontend-<hash>-uc.a.run.app        (us-central1)
#   https://formbuilder-frontend-<hash>-<region>.a.run.app  (otras regiones)
#   http://localhost:5173  /  http://localhost:3000           (dev local)
#
# Si además tienes un dominio custom (settings.frontend_url), se agrega
# como origen exacto en allow_origins para no romper ese caso. 

_CLOUD_RUN_REGEX = (
    r"https://formbuilder-frontend-[a-z0-9]+-[a-z0-9]+\.a\.run\.app"
    r"|http://localhost:(5173|3000)"
)

# Orígenes exactos: solo el dominio custom si está configurado y no es localhost
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


# ─── Startup / shutdown ─────────────────────────────────────────────────────

@app.on_event("startup")
async def on_startup():
    logging.info("FormBuilder API starting — environment=%s", settings.environment)


@app.on_event("shutdown")
async def on_shutdown():
    from app.db.session import engine
    await engine.dispose()
    logging.info("FormBuilder API shutting down")