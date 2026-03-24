"""Database initialization route — creates tables if they don't exist.

Add this to the backend temporarily. Call it once, then remove it.
"""

import logging
from fastapi import APIRouter
from sqlalchemy import text

from app.db.session import engine
from app.models.form import Base

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/setup", tags=["setup"])


@router.post("/create-tables")
async def create_tables():
    """Create all database tables. Call this ONCE after first deploy.

    curl -X POST https://formbuilder-backend-fwsbuf7tgq-uc.a.run.app/setup/create-tables
    """
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # Verify
        async with engine.connect() as conn:
            result = await conn.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' ORDER BY table_name"
            ))
            tables = [row[0] for row in result]

        logger.info("Tables created: %s", tables)
        return {"status": "ok", "tables_created": tables}

    except Exception as e:
        logger.error("Failed to create tables: %s", e)
        return {"status": "error", "detail": str(e)}