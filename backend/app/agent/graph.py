"""LangGraph form generation graph — compiles the agent pipeline.

Flow:
  START → parse_requirements → classify_fields → structure_form → validate_form
        → [valid?] → END (return schema)
        → [invalid + retry < 2?] → classify_fields (retry loop)
        → [invalid + retry >= 2?] → END (return with warnings)
"""

import logging

from langgraph.graph import END, StateGraph

from app.agent.nodes import classify_fields, parse_requirements, structure_form, validate_form
from app.agent.state import FormAgentState

logger = logging.getLogger(__name__)

MAX_RETRIES = 2


def should_retry(state: FormAgentState) -> str:
    """Routing function after validate_form: retry or finish."""
    validation = state.get("validation_result", {})
    retry_count = state.get("retry_count", 0)

    if validation.get("valid", False):
        logger.info("Form validation passed — finishing")
        return "finish"

    if retry_count < MAX_RETRIES:
        logger.info("Form validation failed — retrying (attempt %d/%d)", retry_count, MAX_RETRIES)
        return "retry"

    logger.warning("Form validation failed after %d attempts — finishing with warnings", MAX_RETRIES)
    return "finish"


def build_graph() -> StateGraph:
    """Build and compile the LangGraph form generation agent."""

    graph = StateGraph(FormAgentState)

    # Add nodes
    graph.add_node("parse_requirements", parse_requirements)
    graph.add_node("classify_fields", classify_fields)
    graph.add_node("structure_form", structure_form)
    graph.add_node("validate_form", validate_form)

    # Define edges
    graph.set_entry_point("parse_requirements")
    graph.add_edge("parse_requirements", "classify_fields")
    graph.add_edge("classify_fields", "structure_form")
    graph.add_edge("structure_form", "validate_form")

    # Conditional routing after validation
    graph.add_conditional_edges(
        "validate_form",
        should_retry,
        {
            "retry": "classify_fields",  # Loop back to reclassify and restructure
            "finish": END,
        },
    )

    return graph.compile()


# Singleton compiled graph
form_agent = build_graph()


async def generate_form(user_input: str, form_name: str | None = None) -> dict:
    """Run the form generation agent end-to-end.

    Args:
        user_input: Natural language description of the form
        form_name: Optional override for the form name

    Returns:
        dict with keys: form_name, schema, warnings, agent_log
    """
    initial_state: FormAgentState = {
        "user_input": user_input,
        "parsed_requirements": {},
        "classified_fields": [],
        "form_structure": {},
        "validation_result": {},
        "errors": [],
        "warnings": [],
        "retry_count": 0,
        "agent_log": [],
    }

    # Run the graph
    final_state = await form_agent.ainvoke(initial_state)

    # Extract results
    parsed = final_state.get("parsed_requirements", {})
    schema = final_state.get("form_structure", {})
    validation = final_state.get("validation_result", {})
    agent_log = final_state.get("agent_log", [])
    warnings = validation.get("warnings", [])

    # If validation had errors and we exhausted retries, include them as warnings
    if not validation.get("valid", False):
        warnings = validation.get("errors", []) + warnings
        warnings.insert(0, "⚠ Form generated with validation issues — review before publishing")

    resolved_name = form_name or parsed.get("form_name", "Untitled Form")

    return {
        "form_name": resolved_name,
        "schema": schema,
        "warnings": warnings,
        "agent_log": agent_log,
    }
