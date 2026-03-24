"""FastAPI dependencies for authentication and database access."""

import uuid
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import get_db
from app.models.form import User

security = HTTPBearer()

GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


# ─── JWT helpers ────────────────────────────────────────────────────────────

def create_access_token(user_id: uuid.UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> uuid.UUID:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return uuid.UUID(user_id)
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc


# ─── Google OAuth ───────────────────────────────────────────────────────────

async def verify_google_token(access_token: str) -> dict:
    """Exchange a Google OAuth access token for user info."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
        if resp.status_code != 200:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")
        return resp.json()


async def get_or_create_user(google_info: dict, db: AsyncSession) -> User:
    """Find existing user by Google ID, or create a new one."""
    stmt = select(User).where(User.google_id == google_info["sub"])
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user:
        user.last_login = datetime.now(timezone.utc)
        user.name = google_info.get("name", user.name)
        user.picture = google_info.get("picture", user.picture)
        return user

    user = User(
        email=google_info["email"],
        name=google_info.get("name", google_info["email"]),
        picture=google_info.get("picture"),
        google_id=google_info["sub"],
        role="technician",
        last_login=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.flush()
    return user


# ─── FastAPI dependencies ───────────────────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate JWT, return the current user."""
    user_id = decode_access_token(credentials.credentials)
    stmt = select(User).where(User.id == user_id, User.is_active.is_(True))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    """Require admin role."""
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user
