# VentaPOS — Authentication and Permissions

## Authentication
Supabase Auth is the identity provider.

FastAPI is responsible for:
- Extracting the authenticated token/session context.
- Verifying identity.
- Resolving the user profile.
- Resolving organization membership.
- Resolving store membership.

## Roles

### Owner
- Full organization access
- Manage stores
- Manage users
- Manage products
- Manage inventory
- Manage suppliers
- View reports
- Manage subscription

### Manager
- Manage store operations
- Manage inventory
- Manage products
- View reports
- Manage customers
- Manage suppliers

### Cashier
- POS
- Sales
- Customers
- Utang according to store policy
- Cannot manage users
- Cannot change cost price
- Cannot delete completed financial records

### Inventory Staff
- Inventory
- Stock receiving
- Purchase orders
- Stock adjustments subject to permission

### Platform Admin
- SaaS-level administration
- Support operations
- Tenant access must be controlled and audited

## FastAPI Dependency Pattern

Conceptually:

```text
Request
 ↓
get_current_user()
 ↓
get_current_organization()
 ↓
get_current_store()
 ↓
require_role(...)
 ↓
Route
```

## Security Rules
- Never trust frontend role claims.
- Never accept arbitrary organization_id from ordinary clients.
- Never expose service-role keys.
- Enforce authorization on every protected route.
- Use Supabase RLS as defense in depth.
- Audit privileged operations.
