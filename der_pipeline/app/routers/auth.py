"""Authentication router for user management and JWT tokens."""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlmodel import Session

from ..auth import (
    authenticate_user,
    create_access_token,
    create_user,
    get_current_active_user,
)
from ..config import settings
from ..db import get_session
from ..schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/register", response_model=TokenResponse)
@limiter.limit(f"{settings.rate_limit_per_minute//10}/minute")
async def register(
    request: Request,
    register_request: RegisterRequest,
    session: Session = Depends(get_session),
):
    """Register a new user."""
    try:
        user = create_user(
            session=session,
            email=register_request.email,
            password=register_request.password,
            role=register_request.role,
        )

        # Create access token
        access_token_expires = timedelta(minutes=settings.jwt_expire_minutes)
        access_token = create_access_token(
            data={"sub": str(user.id)}, expires_delta=access_token_expires
        )

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.jwt_expire_minutes * 60,
            user_id=user.id,
            email=user.email,
            role=user.role,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/login", response_model=TokenResponse)
@limiter.limit(f"{settings.rate_limit_per_minute//5}/minute")
async def login(
    request: Request,
    login_request: LoginRequest,
    session: Session = Depends(get_session),
):
    """Authenticate user and return JWT token."""
    user = authenticate_user(session, login_request.email, login_request.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create access token
    access_token_expires = timedelta(minutes=settings.jwt_expire_minutes)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.jwt_expire_minutes * 60,
        user_id=user.id,
        email=user.email,
        role=user.role,
    )


@router.post("/token", response_model=TokenResponse)
@limiter.limit(f"{settings.rate_limit_per_minute//5}/minute")
async def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session),
):
    """OAuth2 compatible token endpoint."""
    user = authenticate_user(session, form_data.username, form_data.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=settings.jwt_expire_minutes)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.jwt_expire_minutes * 60,
        user_id=user.id,
        email=user.email,
        role=user.role,
    )


@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user=Depends(get_current_active_user)):
    """Get current user information."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
    )
