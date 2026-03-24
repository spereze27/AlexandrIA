"""Form CRUD routes — create, read, update, delete forms."""

import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.form import Form, Submission, User
from app.models.schemas import FormCreate, FormListResponse, FormResponse, FormUpdate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/forms", tags=["forms"])


@router.get("/", response_model=list[FormListResponse])
async def list_forms(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    active_only: bool = True,
):
    """List all forms with submission counts."""
    stmt = (
        select(
            Form,
            func.count(Submission.id).label("submission_count"),
        )
        .outerjoin(Submission, Submission.form_id == Form.id)
        .group_by(Form.id)
        .order_by(Form.updated_at.desc())
    )

    if active_only:
        stmt = stmt.where(Form.is_active.is_(True))

    result = await db.execute(stmt)
    rows = result.all()

    return [
        FormListResponse(
            id=form.id,
            name=form.name,
            description=form.description,
            is_active=form.is_active,
            created_at=form.created_at,
            submission_count=count,
        )
        for form, count in rows
    ]


@router.get("/{form_id}", response_model=FormResponse)
async def get_form(
    form_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a single form by ID with its full schema."""
    stmt = (
        select(Form, func.count(Submission.id).label("submission_count"))
        .outerjoin(Submission)
        .where(Form.id == form_id)
        .group_by(Form.id)
    )
    result = await db.execute(stmt)
    row = result.one_or_none()

    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

    form, count = row
    response = FormResponse(
        id=form.id,
        name=form.name,
        description=form.description,
        schema=form.schema,
        sheets_id=form.sheets_id,
        sheets_url=form.sheets_url,
        created_by=form.created_by,
        is_active=form.is_active,
        created_at=form.created_at,
        updated_at=form.updated_at,
        submission_count=count,
    )
    return response


@router.post("/", response_model=FormResponse, status_code=status.HTTP_201_CREATED)
async def create_form(
    body: FormCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new form and optionally link a Google Sheet."""
    form = Form(
        name=body.name,
        description=body.description,
        schema=body.schema_data.model_dump(),
        created_by=user.id,
    )
    db.add(form)
    await db.flush()

    # Auto-create linked Google Sheet (async, non-blocking)
    try:
        from app.services.sheets_sync import create_sheet_for_form
        sheets_id, sheets_url = await create_sheet_for_form(form)
        form.sheets_id = sheets_id
        form.sheets_url = sheets_url
    except Exception as e:
        logger.warning("Failed to create Google Sheet for form %s: %s", form.id, e)

    await db.commit()
    await db.refresh(form)

    return FormResponse(
        id=form.id,
        name=form.name,
        description=form.description,
        schema=form.schema,
        sheets_id=form.sheets_id,
        sheets_url=form.sheets_url,
        created_by=form.created_by,
        is_active=form.is_active,
        created_at=form.created_at,
        updated_at=form.updated_at,
    )


@router.patch("/{form_id}", response_model=FormResponse)
async def update_form(
    form_id: uuid.UUID,
    body: FormUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update form name, description, schema, or active status."""
    stmt = select(Form).where(Form.id == form_id)
    result = await db.execute(stmt)
    form = result.scalar_one_or_none()

    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

    if body.name is not None:
        form.name = body.name
    if body.description is not None:
        form.description = body.description
    if body.schema_data is not None:
        form.schema = body.schema_data.model_dump()
    if body.is_active is not None:
        form.is_active = body.is_active

    await db.commit()
    await db.refresh(form)

    return FormResponse(
        id=form.id,
        name=form.name,
        description=form.description,
        schema=form.schema,
        sheets_id=form.sheets_id,
        sheets_url=form.sheets_url,
        created_by=form.created_by,
        is_active=form.is_active,
        created_at=form.created_at,
        updated_at=form.updated_at,
    )


@router.delete("/{form_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_form(
    form_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Soft-delete a form (set is_active=False)."""
    stmt = select(Form).where(Form.id == form_id)
    result = await db.execute(stmt)
    form = result.scalar_one_or_none()

    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

    form.is_active = False
    await db.commit()


@router.get("/{form_id}/public")
async def get_form_public(form_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Public endpoint to get form schema (for rendering in mobile/PWA without auth)."""
    stmt = select(Form).where(Form.id == form_id, Form.is_active.is_(True))
    result = await db.execute(stmt)
    form = result.scalar_one_or_none()

    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")

    return {
        "id": str(form.id),
        "name": form.name,
        "schema": form.schema,
    }
