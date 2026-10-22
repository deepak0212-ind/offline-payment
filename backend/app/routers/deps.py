"""
Dependencies compatibility layer.
Re-exports dependencies from app.api.deps.
"""
from app.api.deps import (
    oauth2_scheme,
    get_current_user,
    require_roles,
    get_current_analyst,
)

__all__ = [
    "oauth2_scheme",
    "get_current_user",
    "require_roles",
    "get_current_analyst",
]
