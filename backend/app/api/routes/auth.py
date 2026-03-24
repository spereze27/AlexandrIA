"""Auth routes — Google OAuth login, token refresh."""

import logging
import traceback

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import create_access_token, get_current_user, get_or_create_user, verify_google_token
from app.db.session import get_db
from app.models.form import User
from app.models.schemas import TokenResponse, UserResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


class GoogleLoginBody(BaseModel):
    access_token: str


@router.post("/google", response_model=TokenResponse)
async def login_with_google(body: GoogleLoginBody, db: AsyncSession = Depends(get_db)):
    """Exchange a Google OAuth access token for a JWT.

    Frontend uses Google Sign-In, sends the access_token here,
    we verify it with Google, create/find the user, and return a JWT.
    """
    # Step 1: Verify with Google
    try:
        google_info = await verify_google_token(body.access_token)
        logger.info("Google auth OK for email=%s", google_info.get("email", "unknown"))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Google token verification failed: %s\n%s", e, traceback.format_exc())
        raise HTTPException(status_code=401, detail=f"Google verification failed: {e}")

    # Step 2: Create or find user in DB
    try:
        user = await get_or_create_user(google_info, db)
        await db.commit()
        logger.info("User resolved: id=%s email=%s", user.id, user.email)
    except Exception as e:
        logger.error("DB user creation failed: %s\n%s", e, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"User creation failed: {e}")

    # Step 3: Create JWT
    try:
        token = create_access_token(user.id)
    except Exception as e:
        logger.error("JWT creation failed: %s\n%s", e, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Token creation failed: {e}")

    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Return the current authenticated user's info."""
    return UserResponse.model_validate(user)