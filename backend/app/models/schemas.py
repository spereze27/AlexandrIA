"""Pydantic schemas for API serialization and validation."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ─── Widget / Field types ───────────────────────────────────────────────────

class LocalizedText(BaseModel):
    es: str = ""
    en: str = ""


class FieldOption(BaseModel):
    value: str
    label: LocalizedText


class ValidationRule(BaseModel):
    pattern: str | None = None
    min_length: int | None = None
    max_length: int | None = None
    min_value: float | None = None
    max_value: float | None = None


class ConditionalLogic(BaseModel):
    """Show this field only when another field has a specific value."""
    depends_on: str  # field_id
    operator: str = "equals"  # equals, not_equals, contains, in
    value: str | list[str]


class FormField(BaseModel):
    id: str
    type: str  # text, number, single_select, multi_select, photo, gps, signature, date, conditional_text
    label: LocalizedText
    required: bool = False
    placeholder: LocalizedText | None = None
    options: list[FieldOption] | None = None
    validation: ValidationRule | None = None
    conditional: ConditionalLogic | None = None
    metadata: list[str] | None = None  # ["timestamp", "gps"] for photos
    auto_capture: bool = False  # For GPS fields
    max_photos: int = 1


class FormSection(BaseModel):
    id: str
    title: LocalizedText
    description: LocalizedText | None = None
    fields: list[FormField]


class FormSchema(BaseModel):
    """Complete form definition stored in the `schema` JSONB column."""
    sections: list[FormSection]
    settings: dict = Field(default_factory=lambda: {
        "bilingual": True,
        "primary_language": "es",
        "require_gps": True,
        "require_timestamp": True,
    })


# ─── Form CRUD ──────────────────────────────────────────────────────────────

class FormCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    schema_data: FormSchema = Field(..., alias="schema")

    model_config = {"populate_by_name": True}


class FormUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    schema_data: FormSchema | None = Field(None, alias="schema")
    is_active: bool | None = None

    model_config = {"populate_by_name": True}


class FormResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    schema_data: FormSchema = Field(..., alias="schema")
    sheets_id: str | None
    sheets_url: str | None
    created_by: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
    submission_count: int = 0

    model_config = {"from_attributes": True, "populate_by_name": True}


class FormListResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    is_active: bool
    created_at: datetime
    submission_count: int = 0

    model_config = {"from_attributes": True}


# ─── Submissions ────────────────────────────────────────────────────────────

class SubmissionCreate(BaseModel):
    form_id: uuid.UUID
    data: dict  # Field responses keyed by field_id
    gps_lat: float | None = None
    gps_lng: float | None = None
    client_id: str | None = None  # For offline dedup
    offline_created_at: datetime | None = None


class SubmissionResponse(BaseModel):
    id: uuid.UUID
    form_id: uuid.UUID
    data: dict
    gps_lat: float | None
    gps_lng: float | None
    submitted_by: uuid.UUID
    submitted_at: datetime
    synced_to_sheets: bool
    media: list["MediaResponse"] = []

    model_config = {"from_attributes": True}


class MediaResponse(BaseModel):
    id: uuid.UUID
    field_key: str
    gcs_url: str
    content_type: str
    metadata: dict | None

    model_config = {"from_attributes": True}


# ─── Batch sync (offline submissions) ──────────────────────────────────────

class BatchSubmissionRequest(BaseModel):
    submissions: list[SubmissionCreate]


class BatchSubmissionResponse(BaseModel):
    synced: int
    duplicates_skipped: int
    errors: list[str]


# ─── Agent ──────────────────────────────────────────────────────────────────

class AgentGenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=10, max_length=10000)
    form_name: str | None = None


class AgentGenerateResponse(BaseModel):
    form_name: str
    schema_data: FormSchema = Field(..., alias="schema")
    warnings: list[str] = []
    agent_log: list[str] = []  # Step-by-step reasoning

    model_config = {"populate_by_name": True}


# ─── Dashboard ──────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_submissions: int
    ready_for_execution: int
    requires_review: int
    not_executable: int
    pending: int


class MapPoint(BaseModel):
    submission_id: uuid.UUID
    lat: float
    lng: float
    pole_id: str | None
    status: str  # ready, review, not_executable, pending
    severity: str  # green, yellow, red, gray
    issues: list[str] = []


class DashboardResponse(BaseModel):
    stats: DashboardStats
    map_points: list[MapPoint]


# ─── Auth ───────────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    picture: str | None
    role: str

    model_config = {"from_attributes": True}
