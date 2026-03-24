"""Auth routes — Google OAuth login, token refresh."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import create_access_token, get_current_user, get_or_create_user, verify_google_token
from app.db.session import get_db
from app.models.form import User
from app.models.schemas import TokenResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


class GoogleLoginRequest:
    """Body for Google login — just the OAuth access token."""
    def __init__(self, access_token: str):
        self.access_token = access_token


from pydantic import BaseModel


class GoogleLoginBody(BaseModel):
    access_token: str


@router.post("/google", response_model=TokenResponse)
async def login_with_google(body: GoogleLoginBody, db: AsyncSession = Depends(get_db)):
    """Exchange a Google OAuth access token for a JWT.

    Frontend uses Google Sign-In, sends the access_token here,
    we verify it with Google, create/find the user, and return a JWT.
    """
    google_info = await verify_google_token(body.access_token)
    user = await get_or_create_user(google_info, db)
    await db.commit()

    token = create_access_token(user.id)

    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Return the current authenticated user's info."""
    return UserResponse.model_validate(user)
