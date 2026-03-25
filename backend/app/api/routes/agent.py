"""Agent route — generate forms from natural language using LangGraph."""

import logging
import traceback

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError

from app.agent.graph import generate_form
from app.api.deps import get_current_user
from app.models.form import User
from app.models.schemas import AgentGenerateRequest, AgentGenerateResponse, FormSchema

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/agent", tags=["agent"])


def _normalize_label(value) -> dict:
    """Ensure label is always {"es": "...", "en": "..."}."""
    if isinstance(value, dict):
        return {"es": str(value.get("es", "")), "en": str(value.get("en", ""))}
    if isinstance(value, str):
        return {"es": value, "en": value}
    return {"es": "", "en": ""}


def _normalize_schema(raw: dict) -> dict:
    """Normalize the LLM-generated schema to match our Pydantic models.

    Gemini often returns slightly different formats:
    - label as string instead of {"es": ..., "en": ...}
    - missing fields (placeholder, validation, etc.)
    - options with label as string
    - description as string instead of LocalizedText
    - extra fields not in our model
    """
    if not raw or not isinstance(raw, dict):
        return {"sections": [], "settings": {}}

    normalized_sections = []
    for section in raw.get("sections", []):
        norm_fields = []
        for field in section.get("fields", []):
            # Normalize label
            field["label"] = _normalize_label(field.get("label"))

            # Normalize placeholder
            if "placeholder" in field and field["placeholder"] is not None:
                field["placeholder"] = _normalize_label(field["placeholder"])

            # Normalize options
            if "options" in field and field["options"]:
                norm_options = []
                for opt in field["options"]:
                    if isinstance(opt, str):
                        norm_options.append({"value": opt, "label": {"es": opt, "en": opt}})
                    elif isinstance(opt, dict):
                        opt_label = opt.get("label", opt.get("value", ""))
                        norm_options.append({
                            "value": str(opt.get("value", "")),
                            "label": _normalize_label(opt_label),
                        })
                    else:
                        continue
                field["options"] = norm_options

            # Normalize conditional
            if "conditional" in field and field["conditional"]:
                cond = field["conditional"]
                if isinstance(cond, dict):
                    cond.setdefault("operator", "equals")
                    cond.setdefault("value", "")
                    cond.setdefault("depends_on", "")
                else:
                    field["conditional"] = None

            # Ensure defaults for optional fields
            field.setdefault("required", False)
            field.setdefault("auto_capture", False)
            field.setdefault("max_photos", 1)
            field.setdefault("metadata", None)
            field.setdefault("validation", None)
            field.setdefault("conditional", None)
            field.setdefault("placeholder", None)

            # Ensure id and type exist
            field.setdefault("id", f"field_{len(norm_fields)}")
            field.setdefault("type", "text")

            norm_fields.append(field)

        # Normalize section title and description
        norm_section = {
            "id": section.get("id", f"section_{len(normalized_sections)}"),
            "title": _normalize_label(section.get("title")),
            "description": _normalize_label(section.get("description")) if section.get("description") else None,
            "fields": norm_fields,
        }
        normalized_sections.append(norm_section)

    # Normalize settings
    settings = raw.get("settings", {})
    if not isinstance(settings, dict):
        settings = {}
    settings.setdefault("bilingual", True)
    settings.setdefault("primary_language", "es")
    settings.setdefault("require_gps", True)
    settings.setdefault("require_timestamp", True)

    return {"sections": normalized_sections, "settings": settings}


@router.post("/generate", response_model=AgentGenerateResponse)
async def generate_form_from_prompt(
    body: AgentGenerateRequest,
    user: User = Depends(get_current_user),
):
    """Generate a complete form schema from a natural language description."""

    # Step 1: Run the LangGraph agent
    try:
        result = await generate_form(
            user_input=body.prompt,
            form_name=body.form_name,
        )
    except Exception as e:
        logger.error("Agent execution failed: %s\n%s", e, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Agent failed: {e}")

    raw_schema = result.get("schema", {})
    warnings = result.get("warnings", [])
    agent_log = result.get("agent_log", [])

    # Step 2: Normalize the LLM output to match our Pydantic models
    normalized = _normalize_schema(raw_schema)

    # Step 3: Try to parse with Pydantic
    try:
        schema = FormSchema(**normalized)
    except ValidationError as e:
        logger.warning(
            "Schema validation failed after normalization, returning raw. Errors: %s",
            e.error_count(),
        )
        # Last resort: return an empty schema with warnings
        warnings.insert(0, f"Schema had {e.error_count()} validation issues — review manually")
        schema = FormSchema(sections=[])

        # Try to salvage what we can: parse sections one by one
        salvaged_sections = []
        for raw_section in normalized.get("sections", []):
            try:
                from app.models.schemas import FormSection
                salvaged_sections.append(FormSection(**raw_section))
            except ValidationError:
                continue
        if salvaged_sections:
            schema = FormSchema(sections=salvaged_sections, settings=normalized.get("settings", {}))
            warnings[0] = f"Some fields had validation issues — {len(salvaged_sections)} sections recovered"

    return AgentGenerateResponse(
        form_name=result.get("form_name", "Untitled"),
        schema=schema,
        warnings=warnings,
        agent_log=agent_log,
    )