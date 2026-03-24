"""Node 4: Validate the generated form schema for completeness and correctness."""

import json
import logging

from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from app.agent.prompts.templates import VALIDATE_FORM_PROMPT
from app.agent.state import FormAgentState
from app.config import settings

logger = logging.getLogger(__name__)

VALID_FIELD_TYPES = {
    "text", "number", "single_select", "multi_select",
    "photo", "gps", "signature", "date", "conditional_text",
}


def _run_structural_checks(schema: dict) -> tuple[list[str], list[str]]:
    """Run deterministic validation checks (no LLM needed)."""
    errors = []
    warnings = []
    seen_ids: set[str] = set()

    sections = schema.get("sections", [])
    if not sections:
        errors.append("Form has no sections")
        return errors, warnings

    all_field_ids_ordered: list[str] = []

    for i, section in enumerate(sections):
        fields = section.get("fields", [])
        if not fields:
            errors.append(f"Section '{section.get('id', i)}' has no fields")
            continue

        for j, field in enumerate(fields):
            fid = field.get("id", f"section_{i}_field_{j}")
            ftype = field.get("type", "")

            # Duplicate ID check
            if fid in seen_ids:
                errors.append(f"Duplicate field ID: '{fid}'")
            seen_ids.add(fid)
            all_field_ids_ordered.append(fid)

            # Valid type check
            if ftype not in VALID_FIELD_TYPES:
                errors.append(f"Field '{fid}' has invalid type: '{ftype}'")

            # Select fields must have options
            if ftype in ("single_select", "multi_select"):
                options = field.get("options", [])
                if not options or len(options) < 2:
                    errors.append(f"Field '{fid}' ({ftype}) must have at least 2 options")

            # Conditional logic references
            conditional = field.get("conditional")
            if conditional:
                dep = conditional.get("depends_on", "")
                if dep not in seen_ids:
                    if dep in [f.get("id") for s in sections for f in s.get("fields", [])]:
                        errors.append(
                            f"Field '{fid}' depends on '{dep}' which appears AFTER it. "
                            "Move the dependency field before this one."
                        )
                    else:
                        errors.append(f"Field '{fid}' depends on non-existent field: '{dep}'")

            # Bilingual label check
            settings_data = schema.get("settings", {})
            if settings_data.get("bilingual", False):
                label = field.get("label", {})
                if not label.get("es") or not label.get("en"):
                    warnings.append(f"Field '{fid}' missing bilingual label (es/en)")

            # Photo metadata
            if ftype == "photo" and field.get("required"):
                meta = field.get("metadata", [])
                if not meta:
                    warnings.append(f"Required photo field '{fid}' has no metadata (timestamp, gps)")

            # GPS auto_capture
            if ftype == "gps" and not field.get("auto_capture"):
                warnings.append(f"GPS field '{fid}' should have auto_capture=true")

    return errors, warnings


async def validate_form(state: FormAgentState) -> dict:
    """Validate form schema structurally and via LLM quality check.

    Reads: form_structure, retry_count
    Writes: validation_result, warnings, errors, retry_count, agent_log
    """
    logger.info("Agent node: validate_form")

    schema = state.get("form_structure", {})
    retry_count = state.get("retry_count", 0)

    if not schema:
        return {
            "validation_result": {"valid": False, "errors": ["Empty schema"], "warnings": []},
            "errors": state.get("errors", []) + ["Empty form structure"],
            "retry_count": retry_count + 1,
            "agent_log": state.get("agent_log", []) + [
                "[validate_form] ERROR: Empty schema — nothing to validate"
            ],
        }

    # Step 1: Deterministic structural checks
    struct_errors, struct_warnings = _run_structural_checks(schema)

    # Step 2: LLM-based quality validation (if structural checks pass)
    llm_errors = []
    llm_warnings = []
    if not struct_errors:
        try:
            llm = ChatGoogleGenerativeAI(
                model=settings.gemini_model,
                google_api_key=settings.gemini_api_key,
                temperature=0.0,
            )
            prompt = VALIDATE_FORM_PROMPT.format(
                form_schema=json.dumps(schema, indent=2, ensure_ascii=False)
            )
            response = await llm.ainvoke([HumanMessage(content=prompt)])
            raw_text = response.content.strip()

            if raw_text.startswith("```"):
                raw_text = raw_text.split("\n", 1)[1]
                if raw_text.endswith("```"):
                    raw_text = raw_text[: raw_text.rfind("```")]
                raw_text = raw_text.strip()

            validation = json.loads(raw_text)
            llm_errors = validation.get("errors", [])
            llm_warnings = validation.get("warnings", [])
        except Exception as e:
            logger.warning("LLM validation failed, relying on structural checks: %s", e)
            llm_warnings.append(f"LLM validation skipped: {e}")

    all_errors = struct_errors + llm_errors
    all_warnings = struct_warnings + llm_warnings
    is_valid = len(all_errors) == 0

    log_entry = (
        f"[validate_form] {'VALID' if is_valid else 'INVALID'} — "
        f"{len(all_errors)} errors, {len(all_warnings)} warnings "
        f"(attempt {retry_count + 1})"
    )
    logger.info(log_entry)

    return {
        "validation_result": {
            "valid": is_valid,
            "errors": all_errors,
            "warnings": all_warnings,
        },
        "warnings": state.get("warnings", []) + all_warnings,
        "errors": state.get("errors", []) + all_errors if not is_valid else state.get("errors", []),
        "retry_count": retry_count + 1,
        "agent_log": state.get("agent_log", []) + [log_entry],
    }
