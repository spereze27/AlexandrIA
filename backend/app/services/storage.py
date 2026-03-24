"""Cloud Storage service — upload photos, signatures, and files."""

import uuid
from datetime import timedelta

from fastapi import UploadFile
from google.cloud import storage

from app.config import settings

_client: storage.Client | None = None


def _get_client() -> storage.Client:
    global _client
    if _client is None:
        _client = storage.Client()
    return _client


def _get_bucket() -> storage.Bucket:
    return _get_client().bucket(settings.gcs_bucket_name)


async def upload_file(
    file: UploadFile,
    submission_id: str,
    field_key: str,
) -> str:
    """Upload a file to Cloud Storage and return the public URL.

    Files are organized as: submissions/{submission_id}/{field_key}/{filename}
    """
    # Generate unique filename to avoid collisions
    ext = ""
    if file.filename:
        parts = file.filename.rsplit(".", 1)
        if len(parts) > 1:
            ext = f".{parts[1]}"

    unique_name = f"{uuid.uuid4().hex}{ext}"
    blob_path = f"submissions/{submission_id}/{field_key}/{unique_name}"

    bucket = _get_bucket()
    blob = bucket.blob(blob_path)

    content = await file.read()
    blob.upload_from_string(content, content_type=file.content_type or "application/octet-stream")

    # Return the GCS URI (authenticated access via backend)
    return f"gs://{settings.gcs_bucket_name}/{blob_path}"


async def get_signed_url(gcs_url: str, expiration_minutes: int = 60) -> str:
    """Generate a signed URL for temporary access to a file.

    Used by the frontend to display photos without requiring GCS auth.
    """
    if not gcs_url.startswith("gs://"):
        return gcs_url

    # Parse gs://bucket/path
    path = gcs_url.replace(f"gs://{settings.gcs_bucket_name}/", "")
    bucket = _get_bucket()
    blob = bucket.blob(path)

    url = blob.generate_signed_url(
        version="v4",
        expiration=timedelta(minutes=expiration_minutes),
        method="GET",
    )
    return url
