"""Node 3: Structure the classified fields into the final form schema."""

import json
import logging

from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from app.agent.prompts.templates import STRUCTURE_FORM_PROMPT
from app.agent.state import FormAgentState
from app.config import settings

logger = logging.getLogger(__name__)


def get_llm() -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=settings.gemini_api_key,
        temperature=0.0,
    )


async def structure_form(state: FormAgentState) -> dict:
    """Organize classified fields into logical sections with settings.

    Reads: parsed_requirements, classified_fields
    Writes: form_structure, agent_log
    """
    logger.info("Agent node: structure_form")

    parsed = state.get("parsed_requirements", {})
    classified = state.get("classified_fields", [])

    if not classified:
        return {
            "form_structure": {},
            "errors": state.get("errors", []) + ["No classified fields to structure"],
            "agent_log": state.get("agent_log", []) + [
                "[structure_form] ERROR: No classified fields available"
            ],
        }

    # Build a mapping of classified fields by their section context
    # Re-associate classified fields with their original sections
    sections_with_fields = []
    field_index = 0
    for section in parsed.get("sections", []):
        section_fields = []
        for _ in section.get("fields", []):
            if field_index < len(classified):
                section_fields.append(classified[field_index])
                field_index += 1
        sections_with_fields.append({
            "title": section.get("title", {}),
            "description": section.get("description"),
            "fields": section_fields,
        })

    form_name = parsed.get("form_name", "Untitled Form")
    languages = parsed.get("languages", ["es", "en"])

    llm = get_llm()
    prompt = STRUCTURE_FORM_PROMPT.format(
        sections_with_fields=json.dumps(sections_with_fields, indent=2, ensure_ascii=False),
        form_name=form_name,
        languages=json.dumps(languages),
    )

    response = await llm.ainvoke([HumanMessage(content=prompt)])
    raw_text = response.content.strip()

    # Strip markdown fences
    if raw_text.startswith("```"):
        raw_text = raw_text.split("\n", 1)[1]
        if raw_text.endswith("```"):
            raw_text = raw_text[: raw_text.rfind("```")]
        raw_text = raw_text.strip()

    try:
        structured = json.loads(raw_text)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse structure response: %s", e)
        return {
            "form_structure": {},
            "errors": state.get("errors", []) + [f"Structure parse error: {e}"],
            "agent_log": state.get("agent_log", []) + [
                f"[structure_form] ERROR: LLM returned invalid JSON — {e}"
            ],
        }

    section_count = len(structured.get("sections", []))
    field_count = sum(len(s.get("fields", [])) for s in structured.get("sections", []))
    log_entry = f"[structure_form] Built schema: {section_count} sections, {field_count} fields"
    logger.info(log_entry)

    return {
        "form_structure": structured,
        "agent_log": state.get("agent_log", []) + [log_entry],
    }
