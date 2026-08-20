"""Projects API endpoints with state machine enforcement and workspace isolation."""
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from backend.app.core.security import get_current_user
from backend.app.core.database import get_supabase_client
from backend.app.services.state_machines import ProjectStateMachine, StateMachineError

router = APIRouter()


class ProjectCreateRequest(BaseModel):
    client_id: str
    name: str = Field(min_length=1)
    description: Optional[str] = None
    status: Optional[str] = "lead"
    budget: Optional[float] = 0.0
    currency: Optional[str] = "INR"
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class ProjectUpdateRequest(BaseModel):
    client_id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    budget: Optional[float] = None
    currency: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


@router.get("", response_model=List[Dict[str, Any]])
async def list_projects(
    client_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List all projects scoped to workspace."""
    workspace_id = current_user.get("workspace_id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Missing workspace context")

    sb = get_supabase_client()
    query = (
        sb.table("projects")
        .select("*, clients(name, company_name)")
        .eq("workspace_id", workspace_id)
        .is_("deleted_at", "null")
    )
    if client_id:
        query = query.eq("client_id", client_id)
    if status:
        query = query.eq("status", status)

    res = query.order("created_at", desc=True).execute()
    return res.data or []


@router.post("", response_model=Dict[str, Any])
async def create_project(
    request: ProjectCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Create project scoped to workspace."""
    workspace_id = current_user.get("workspace_id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Missing workspace context")

    sb = get_supabase_client()
    data = {
        "workspace_id": workspace_id,
        "client_id": request.client_id,
        "name": request.name.strip(),
        "description": request.description,
        "status": request.status or "lead",
        "budget": request.budget or 0.0,
        "currency": (request.currency or "INR").upper(),
        "start_date": request.start_date,
        "end_date": request.end_date,
    }
    res = sb.table("projects").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create project")
    return res.data[0]


@router.get("/{project_id}", response_model=Dict[str, Any])
async def get_project(
    project_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get project by ID scoped to workspace."""
    workspace_id = current_user.get("workspace_id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Missing workspace context")

    sb = get_supabase_client()
    res = (
        sb.table("projects")
        .select("*, clients(*)")
        .eq("id", project_id)
        .eq("workspace_id", workspace_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Project not found")
    return res.data[0]


@router.put("/{project_id}", response_model=Dict[str, Any])
async def update_project(
    project_id: str,
    request: ProjectUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Update project with state machine validation."""
    workspace_id = current_user.get("workspace_id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Missing workspace context")

    sb = get_supabase_client()
    current_res = (
        sb.table("projects")
        .select("status")
        .eq("id", project_id)
        .eq("workspace_id", workspace_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if not current_res.data:
        raise HTTPException(status_code=404, detail="Project not found")

    current_status = current_res.data[0].get("status", "lead")
    update_data = {k: v for k, v in request.model_dump(exclude_unset=True).items()}

    # Check state machine transition if status is being updated
    if "status" in update_data and update_data["status"] != current_status:
        try:
            ProjectStateMachine.transition(current_status, update_data["status"])
        except StateMachineError as err:
            raise HTTPException(status_code=400, detail=str(err))

    res = (
        sb.table("projects")
        .update(update_data)
        .eq("id", project_id)
        .eq("workspace_id", workspace_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to update project")
    return res.data[0]


@router.delete("/{project_id}", response_model=Dict[str, Any])
async def delete_project(
    project_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Soft delete project scoped to workspace."""
    workspace_id = current_user.get("workspace_id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Missing workspace context")

    sb = get_supabase_client()
    now_iso = datetime.now(timezone.utc).isoformat()
    res = (
        sb.table("projects")
        .update({"deleted_at": now_iso})
        .eq("id", project_id)
        .eq("workspace_id", workspace_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Project not found or already deleted")
    return {"message": "Project deleted successfully", "id": project_id}
