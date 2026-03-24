"""Agent route — generate forms from natural language using LangGraph."""

from fastapi import APIRouter, Depends

from app.agent.graph import generate_form
from app.api.deps import get_current_user
from app.models.form import User
from app.models.schemas import AgentGenerateRequest, AgentGenerateResponse, FormSchema

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/generate", response_model=AgentGenerateResponse)
async def generate_form_from_prompt(
    body: AgentGenerateRequest,
    user: User = Depends(get_current_user),
):
    """Generate a complete form schema from a natural language description.

    Uses the LangGraph agent pipeline:
    1. parse_requirements — Extract sections and fields from the prompt
    2. classify_fields — Assign widget types to each field
    3. structure_form — Organize into final schema with settings
    4. validate_form — Check completeness and correctness (with retry loop)

    Returns the generated schema ready to save as a form.
    """
    result = await generate_form(
        user_input=body.prompt,
        form_name=body.form_name,
    )

    schema = result.get("schema", {})

    return AgentGenerateResponse(
        form_name=result["form_name"],
        schema=FormSchema(**schema) if schema else FormSchema(sections=[]),
        warnings=result.get("warnings", []),
        agent_log=result.get("agent_log", []),
    )
