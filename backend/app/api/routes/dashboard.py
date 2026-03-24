"""Dashboard routes — stats, map points with severity traffic light."""

import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, case, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.form import Form, Submission, User
from app.models.schemas import DashboardResponse, DashboardStats, MapPoint

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _compute_severity(data: dict) -> str:
    """Compute traffic light severity from submission data.

    Returns: green, yellow, red, gray
    """
    result = data.get("result", "")
    complexity = data.get("complexity", "")
    issues = data.get("issues", [])

    # Red: not executable, high complexity, or critical issues
    critical_issues = {"electrical_interference", "blocked_access", "underground_present"}
    if result == "not_executable":
        return "red"
    if complexity == "high":
        return "red"
    if isinstance(issues, list) and critical_issues.intersection(set(issues)):
        return "red"

    # Yellow: requires review, medium complexity
    if result == "requires_review":
        return "yellow"
    if complexity == "medium":
        return "yellow"
    if isinstance(issues, list) and len(issues) > 0:
        return "yellow"

    # Green: ready for execution, no issues
    if result == "ready_for_execution":
        return "green"

    # Gray: no data / not found
    return "gray"


def _map_result_to_status(data: dict) -> str:
    """Map result field to a status category."""
    result = data.get("result", "")
    mapping = {
        "ready_for_execution": "ready",
        "requires_review": "review",
        "not_executable": "not_executable",
    }
    return mapping.get(result, "pending")


@router.get("/{form_id}", response_model=DashboardResponse)
async def get_dashboard(
    form_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get dashboard data for a specific form: stats + map points with severity."""

    # Fetch all submissions for this form
    stmt = select(Submission).where(Submission.form_id == form_id).order_by(Submission.submitted_at.desc())
    result = await db.execute(stmt)
    submissions = result.scalars().all()

    # Compute stats
    stats = DashboardStats(
        total_submissions=len(submissions),
        ready_for_execution=0,
        requires_review=0,
        not_executable=0,
        pending=0,
    )

    map_points: list[MapPoint] = []

    for sub in submissions:
        data = sub.data or {}
        status = _map_result_to_status(data)
        severity = _compute_severity(data)

        # Count stats
        if status == "ready":
            stats.ready_for_execution += 1
        elif status == "review":
            stats.requires_review += 1
        elif status == "not_executable":
            stats.not_executable += 1
        else:
            stats.pending += 1

        # Build map point if GPS available
        if sub.gps_lat and sub.gps_lng:
            map_points.append(
                MapPoint(
                    submission_id=sub.id,
                    lat=float(sub.gps_lat),
                    lng=float(sub.gps_lng),
                    pole_id=data.get("pole_id"),
                    status=status,
                    severity=severity,
                    issues=data.get("issues", []) if isinstance(data.get("issues"), list) else [],
                )
            )

    return DashboardResponse(stats=stats, map_points=map_points)
