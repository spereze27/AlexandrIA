"""Google Sheets integration — auto-create linked sheets, sync submissions."""

import base64
import json
import logging
from datetime import datetime

import gspread
from google.oauth2.service_account import Credentials

from app.config import settings
from app.models.form import Form, Submission

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

_gc: gspread.Client | None = None


def _get_client() -> gspread.Client:
    """Get or create the gspread client using the service account."""
    global _gc
    if _gc is None:
        sa_key_b64 = settings.google_sheets_sa_key
        if not sa_key_b64:
            raise RuntimeError("GOOGLE_SHEETS_SA_KEY not configured")

        sa_info = json.loads(base64.b64decode(sa_key_b64))
        creds = Credentials.from_service_account_info(sa_info, scopes=SCOPES)
        _gc = gspread.authorize(creds)
    return _gc


def _extract_field_headers(schema: dict) -> list[str]:
    """Extract flat list of field IDs from form schema for sheet headers."""
    headers = ["submission_id", "submitted_by", "submitted_at", "gps_lat", "gps_lng"]

    for section in schema.get("sections", []):
        for field in section.get("fields", []):
            fid = field.get("id", "")
            if fid:
                headers.append(fid)

    return headers


async def create_sheet_for_form(form: Form) -> tuple[str, str]:
    """Create a new Google Sheet linked to a form.

    Headers are generated from the form schema fields.
    Returns (sheet_id, sheet_url).
    """
    gc = _get_client()
    title = f"FormBuilder — {form.name}"

    # Create spreadsheet
    sh = gc.create(title)

    # Set up headers from form schema
    headers = _extract_field_headers(form.schema)
    worksheet = sh.sheet1
    worksheet.update_title("Responses")
    worksheet.update("A1", [headers])

    # Bold headers
    worksheet.format("A1:Z1", {
        "textFormat": {"bold": True},
        "backgroundColor": {"red": 0.9, "green": 0.93, "blue": 0.97},
    })

    # Freeze header row
    worksheet.freeze(rows=1)

    sheet_id = sh.id
    sheet_url = sh.url

    logger.info("Created Google Sheet '%s' (ID: %s) for form %s", title, sheet_id, form.id)

    return sheet_id, sheet_url


async def sync_submission_to_sheet(form: Form, submission: Submission) -> None:
    """Append a submission as a new row in the linked Google Sheet."""
    if not form.sheets_id:
        logger.warning("Form %s has no linked Google Sheet", form.id)
        return

    gc = _get_client()

    try:
        sh = gc.open_by_key(form.sheets_id)
        worksheet = sh.sheet1
    except gspread.SpreadsheetNotFound:
        logger.error("Google Sheet %s not found for form %s", form.sheets_id, form.id)
        return

    # Build row matching the header order
    headers = _extract_field_headers(form.schema)
    data = submission.data or {}

    row = []
    for header in headers:
        if header == "submission_id":
            row.append(str(submission.id))
        elif header == "submitted_by":
            row.append(str(submission.submitted_by))
        elif header == "submitted_at":
            row.append(submission.submitted_at.isoformat() if submission.submitted_at else "")
        elif header == "gps_lat":
            row.append(str(submission.gps_lat) if submission.gps_lat else "")
        elif header == "gps_lng":
            row.append(str(submission.gps_lng) if submission.gps_lng else "")
        else:
            value = data.get(header, "")
            # Handle lists (multi_select) by joining
            if isinstance(value, list):
                value = ", ".join(str(v) for v in value)
            row.append(str(value) if value else "")

    worksheet.append_row(row, value_input_option="USER_ENTERED")
    logger.info("Synced submission %s to sheet %s", submission.id, form.sheets_id)
