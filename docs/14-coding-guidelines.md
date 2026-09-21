# VentaPOS — Coding Guidelines

## Backend Stack
- Python
- FastAPI
- Pydantic
- Supabase/PostgreSQL
- Prefer async where it provides real value
- Use typed interfaces/models

## Backend Structure

```text
app/
├── main.py
├── core/
├── api/
│   └── routes/
├── schemas/
├── models/
├── services/
├── repositories/
├── middleware/
├── utils/
└── jobs/
```

## FastAPI Rules
Routes should be thin.

Preferred:

```text
Router
  ↓
Dependency
  ↓
Schema validation
  ↓
Service
  ↓
Repository
  ↓
Database
```

Do not put large business workflows directly in route functions.

## Pydantic
Use Pydantic models for:
- Request bodies
- Query parameter models when appropriate
- Response schemas
- Configuration validation

## Financial Rules
Never trust frontend totals.

Frontend:
```text
Requested products + quantities
```

Backend:
```text
Authoritative products
+ prices
+ discounts
+ inventory
= authoritative sale
```

## Database
- Use migrations.
- Use foreign keys.
- Use NUMERIC/DECIMAL for money.
- Use UUIDs.
- Add indexes based on actual queries.
- Keep production schema changes tracked.
- Use transactions for financial operations.

## API
- Version API under `/api/v1`.
- Use clear resource names.
- Use correct HTTP methods.
- Return consistent errors.
- Use response schemas.
- Document important behavior in OpenAPI descriptions.

## Security
- No secrets in Git.
- No service-role key in frontend.
- Verify organization/store access server-side.
- Use RLS as defense in depth.
- Rate-limit sensitive endpoints.
- Audit sensitive mutations.

## Testing Priorities
Highest priority:
- Sale transaction
- Inventory deduction
- Returns
- Utang
- Payments
- Authorization
- Tenant isolation
- Idempotency
- Subscription webhooks

## Git
Suggested branches:
```text
main
develop
feature/*
fix/*
```

Commit examples:
```text
feat: add product CRUD
feat: implement POS sale transaction
fix: prevent negative stock
refactor: move pricing logic to service
```

## Definition of Done
A feature is complete only when:
- UI works
- FastAPI endpoint works
- Validation exists
- Authorization exists
- Database migration exists
- Error states work
- Critical tests pass
- No secrets are committed
- Documentation is updated
