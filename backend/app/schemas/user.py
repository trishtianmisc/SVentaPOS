"""User management schemas (owner attaches staff by email)."""
from uuid import UUID

from pydantic import BaseModel, Field

# DB roles: owner | manager | cashier | inventory. UI maps inventory -> Staff.
ASSIGNABLE_ROLES = ("owner", "manager", "cashier", "inventory")
_ROLE_PATTERN = "^(owner|manager|cashier|inventory)$"


class UserAdd(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=254)
    role: str = Field(default="cashier", pattern=_ROLE_PATTERN)
    store_id: UUID | None = None
    full_name: str = Field(default="", max_length=200)
    phone: str | None = Field(default=None, max_length=64)
    password: str | None = Field(default=None, min_length=6, max_length=128)


class UserRoleUpdate(BaseModel):
    role: str = Field(pattern=_ROLE_PATTERN)


class UserMembership(BaseModel):
    store_id: UUID
    store_name: str | None = None
    role: str


class UserRead(BaseModel):
    id: UUID
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    status: str = "active"
    role: str
    roles: list[UserMembership] = []
    is_self: bool = False
    last_login: str | None = None


# Role permission matrix (UI Roles tab). Keys: feature -> manager/cashier/staff.
# staff maps to DB role 'inventory'. Owner is not a column (always full).
FEATURE_KEYS = (
    "dashboard", "pos", "inventory", "customers", "credits", "expenses",
    "sales", "reports", "transfers", "settings", "billing", "suppliers",
    "users",
)
MATRIX_ROLES = ("manager", "cashier", "staff")

# Body is the raw matrix object; validation/cleaning lives in permission_service.
RoleMatrixUpdate = dict[str, dict[str, bool]]


class BranchStore(BaseModel):
    """Org branch for the Owner Hub / Add Team Member. First store is HQ."""
    id: UUID
    name: str
    code: str | None = None
    address: str | None = None
    status: str | None = None
    is_hq: bool = False
