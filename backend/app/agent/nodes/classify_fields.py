"""Node 2: Classify each field into the appropriate widget type."""

import json
import logging

from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from app.agent.prompts.templates import CLASSIFY_FIELDS_PROMPT
from app.agent.state import FormAgentState
from app.config import settings

logger = logging.getLogger(__name__)


def get_llm() -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=settings.gemini_api_key,
        temperature=0.0,
    )


async def classify_fields(state: FormAgentState) -> dict:
    """Assign widget type to each field based on parsed requirements.

    Reads: parsed_requirements
    Writes: classified_fields, agent_log
    """
    logger.info("Agent node: classify_fields")

    parsed = state.get("parsed_requirements", {})
    if not parsed or not parsed.get("sections"):
        return {
            "classified_fields": [],
            "errors": state.get("errors", []) + ["No parsed requirements to classify"],
            "agent_log": state.get("agent_log", []) + [
                "[classify_fields] ERROR: No parsed requirements available"
            ],
        }

    # Flatten all fields with their section context for classification
    all_fields = []
    for section in parsed["sections"]:
        for field in section.get("fields", []):
            field["_section_title"] = section.get("title", {})
            all_fields.append(field)

    llm = get_llm()
    prompt = CLASSIFY_FIELDS_PROMPT.format(parsed_fields=json.dumps(all_fields, indent=2, ensure_ascii=False))

    response = await llm.ainvoke([HumanMessage(content=prompt)])
    raw_text = response.content.strip()

    # Strip markdown fences
    if raw_text.startswith("```"):
        raw_text = raw_text.split("\n", 1)[1]
        if raw_text.endswith("```"):
            raw_text = raw_text[: raw_text.rfind("```")]
        raw_text = raw_text.strip()

    try:
        classified = json.loads(raw_text)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse classification response: %s", e)
        return {
            "classified_fields": [],
            "errors": state.get("errors", []) + [f"Classification parse error: {e}"],
            "agent_log": state.get("agent_log", []) + [
                f"[classify_fields] ERROR: LLM returned invalid JSON — {e}"
            ],
        }

    # Count by type for logging
    type_counts: dict[str, int] = {}
    for field in classified:
        ftype = field.get("type", "unknown")
        type_counts[ftype] = type_counts.get(ftype, 0) + 1

    log_entry = f"[classify_fields] Classified {len(classified)} fields: {type_counts}"
    logger.info(log_entry)

    return {
        "classified_fields": classified,
        "agent_log": state.get("agent_log", []) + [log_entry],
    }
