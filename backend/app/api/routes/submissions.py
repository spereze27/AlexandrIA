"""Submission routes — submit forms, upload media, batch sync for offline."""

import logging
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.form import Form, Media, Submission, User
from app.models.schemas import (
    BatchSubmissionRequest,
    BatchSubmissionResponse,
    SubmissionCreate,
    SubmissionResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/submissions", tags=["submissions"])


@router.post("/", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED)
async def create_submission(
    body: SubmissionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Submit a form response."""
    # Verify form exists
    form_result = await db.execute(select(Form).where(Form.id == body.form_id, Form.is_active.is_(True)))
    form = form_result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found or inactive")

    # Check for duplicate offline submission
    if body.client_id:
        dup_result = await db.execute(
            select(Submission).where(
                Submission.client_id == body.client_id,
                Submission.form_id == body.form_id,
            )
        )
        if dup_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Submission already exists (duplicate client_id)",
            )

    submission = Submission(
        form_id=body.form_id,
        data=body.data,
        gps_lat=body.gps_lat,
        gps_lng=body.gps_lng,
        submitted_by=user.id,
        client_id=body.client_id,
        offline_created_at=body.offline_created_at,
    )
    db.add(submission)
    await db.flush()

    # Sync to Google Sheets (non-blocking)
    try:
        from app.services.sheets_sync import sync_submission_to_sheet
        await sync_submission_to_sheet(form, submission)
        submission.synced_to_sheets = True
    except Exception as e:
        logger.warning("Failed to sync submission %s to Sheets: %s", submission.id, e)

    await db.commit()
    await db.refresh(submission)

    return SubmissionResponse.model_validate(submission)


@router.post("/batch", response_model=BatchSubmissionResponse)
async def batch_sync_submissions(
    body: BatchSubmissionRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Batch sync offline submissions. Skips duplicates by client_id."""
    synced = 0
    duplicates = 0
    errors_list: list[str] = []

    for sub_data in body.submissions:
        try:
            # Check duplicate
            if sub_data.client_id:
                dup_result = await db.execute(
                    select(Submission).where(
                        Submission.client_id == sub_data.client_id,
                        Submission.form_id == sub_data.form_id,
                    )
                )
                if dup_result.scalar_one_or_none():
                    duplicates += 1
                    continue

            submission = Submission(
                form_id=sub_data.form_id,
                data=sub_data.data,
                gps_lat=sub_data.gps_lat,
                gps_lng=sub_data.gps_lng,
                submitted_by=user.id,
                client_id=sub_data.client_id,
                offline_created_at=sub_data.offline_created_at,
            )
            db.add(submission)
            await db.flush()

            # Sync each to sheets
            try:
                form_result = await db.execute(select(Form).where(Form.id == sub_data.form_id))
                form = form_result.scalar_one_or_none()
                if form:
                    from app.services.sheets_sync import sync_submission_to_sheet
                    await sync_submission_to_sheet(form, submission)
                    submission.synced_to_sheets = True
            except Exception as e:
                logger.warning("Sheet sync failed for submission %s: %s", submission.id, e)

            synced += 1

        except Exception as e:
            errors_list.append(f"Failed to sync submission (client_id={sub_data.client_id}): {e}")

    await db.commit()

    return BatchSubmissionResponse(synced=synced, duplicates_skipped=duplicates, errors=errors_list)


@router.get("/{form_id}", response_model=list[SubmissionResponse])
async def list_submissions(
    form_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 100,
    offset: int = 0,
):
    """List submissions for a form."""
    stmt = (
        select(Submission)
        .where(Submission.form_id == form_id)
        .order_by(Submission.submitted_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    submissions = result.scalars().all()
    return [SubmissionResponse.model_validate(s) for s in submissions]


@router.post("/{submission_id}/media", status_code=status.HTTP_201_CREATED)
async def upload_media(
    submission_id: uuid.UUID,
    field_key: str,
    file: UploadFile = File(...),
    gps_lat: float | None = None,
    gps_lng: float | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Upload a photo/signature for a specific submission field."""
    # Verify submission exists
    sub_result = await db.execute(select(Submission).where(Submission.id == submission_id))
    submission = sub_result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    # Upload to Cloud Storage
    from app.services.storage import upload_file
    gcs_url = await upload_file(
        file=file,
        submission_id=str(submission_id),
        field_key=field_key,
    )

    metadata = {}
    if gps_lat and gps_lng:
        metadata["gps"] = {"lat": gps_lat, "lng": gps_lng}

    media = Media(
        submission_id=submission_id,
        field_key=field_key,
        gcs_url=gcs_url,
        content_type=file.content_type or "application/octet-stream",
        file_size=file.size,
        metadata=metadata if metadata else None,
    )
    db.add(media)
    await db.commit()

    return {"id": str(media.id), "gcs_url": gcs_url, "field_key": field_key}
