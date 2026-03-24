"""Node 1: Parse user input into structured requirements."""

import json
import logging

from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from app.agent.prompts.templates import PARSE_REQUIREMENTS_PROMPT
from app.agent.state import FormAgentState
from app.config import settings

logger = logging.getLogger(__name__)


def get_llm() -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=settings.gemini_api_key,
        temperature=0.1,
    )


async def parse_requirements(state: FormAgentState) -> dict:
    """Extract sections, fields, and language info from the user's natural language prompt.

    Reads: user_input
    Writes: parsed_requirements, agent_log
    """
    logger.info("Agent node: parse_requirements")

    llm = get_llm()
    prompt = PARSE_REQUIREMENTS_PROMPT.format(user_input=state["user_input"])

    response = await llm.ainvoke([HumanMessage(content=prompt)])
    raw_text = response.content.strip()

    # Strip markdown code fences if present
    if raw_text.startswith("```"):
        raw_text = raw_text.split("\n", 1)[1]
        if raw_text.endswith("```"):
            raw_text = raw_text[: raw_text.rfind("```")]
        raw_text = raw_text.strip()

    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse LLM response as JSON: %s", e)
        return {
            "parsed_requirements": {},
            "errors": state.get("errors", []) + [f"Parse error: {e}"],
            "agent_log": state.get("agent_log", []) + [
                f"[parse_requirements] ERROR: LLM returned invalid JSON — {e}"
            ],
        }

    section_count = len(parsed.get("sections", []))
    field_count = sum(len(s.get("fields", [])) for s in parsed.get("sections", []))
    languages = parsed.get("languages", [])

    log_entry = (
        f"[parse_requirements] Extracted {section_count} sections, "
        f"{field_count} fields, languages: {languages}"
    )
    logger.info(log_entry)

    return {
        "parsed_requirements": parsed,
        "agent_log": state.get("agent_log", []) + [log_entry],
    }
