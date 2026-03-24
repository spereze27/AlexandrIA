"""LangGraph agent state schema for form generation."""

from typing import Annotated

from langgraph.graph.message import add_messages
from typing_extensions import TypedDict


class FormAgentState(TypedDict):
    """State that flows through the LangGraph form generation pipeline.

    Each node reads from and writes to this shared state dict.
    """

    # Input
    user_input: str  # Original prompt describing the form

    # Node outputs (built progressively)
    parsed_requirements: Annotated[dict, "Output of parse_requirements node"]
    # Structure:
    # {
    #   "form_name": str,
    #   "languages": ["es", "en"],
    #   "sections": [
    #     {
    #       "title": {"es": "...", "en": "..."},
    #       "fields": [
    #         {"description": "...", "required": bool, "options": [...] | None}
    #       ]
    #     }
    #   ]
    # }

    classified_fields: Annotated[list[dict], "Output of classify_fields node"]
    # Each field gets a widget type:
    # {
    #   "id": "pole_id",
    #   "type": "text" | "single_select" | "multi_select" | "photo" | "gps" | "signature" | ...,
    #   "label": {"es": "...", "en": "..."},
    #   "required": bool,
    #   "options": [...] | None,
    #   "validation": {...} | None,
    #   "metadata": ["timestamp", "gps"] | None,
    #   "auto_capture": bool,
    #   "conditional": {...} | None
    # }

    form_structure: Annotated[dict, "Output of structure_form node"]
    # Final structured form matching FormSchema

    validation_result: Annotated[dict, "Output of validate_form node"]
    # {"valid": bool, "errors": [...], "warnings": [...]}

    # Control flow
    errors: list[str]
    warnings: list[str]
    retry_count: int
    agent_log: list[str]  # Step-by-step reasoning for transparency
