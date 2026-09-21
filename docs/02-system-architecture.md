# VentaPOS — System Architecture

## Target Architecture

```text
                    VentaPOS

        ┌────────────────────────────┐
        │ React + TypeScript + PWA   │
        │ Vercel                     │
        └─────────────┬──────────────┘
                      │ HTTPS / JSON
                      ▼
        ┌────────────────────────────┐
        │ FastAPI + Python           │
        │ Custom Application API     │
        └─────────────┬──────────────┘
                      │
             ┌────────┴─────────┐
             ▼                  ▼
      Supabase Auth       PostgreSQL
                           + RLS
             │
             ▼
      Supabase Storage
```

## Backend Request Flow

```text
React/PWA
  ↓
FastAPI Router
  ↓
Authentication dependency
  ↓
Authorization dependency
  ↓
Pydantic request schema
  ↓
Service/business logic
  ↓
Repository/database layer
  ↓
PostgreSQL
  ↓
Response schema
  ↓
React/PWA
```

## Backend Structure

```text
backend/
├── app/
│   ├── main.py
│   ├── core/
│   │   ├── config.py
│   │   ├── security.py
│   │   └── database.py
│   ├── api/
│   │   ├── router.py
│   │   ├── dependencies.py
│   │   └── routes/
│   │       ├── auth.py
│   │       ├── products.py
│   │       ├── categories.py
│   │       ├── inventory.py
│   │       ├── sales.py
│   │       ├── customers.py
│   │       ├── suppliers.py
│   │       ├── purchases.py
│   │       └── reports.py
│   ├── schemas/
│   ├── models/
│   ├── services/
│   ├── repositories/
│   ├── middleware/
│   ├── utils/
│   └── jobs/
├── tests/
├── requirements.txt
└── Dockerfile
```

## Responsibilities

### FastAPI Routes
- Define HTTP endpoints.
- Attach dependencies.
- Receive validated requests.
- Call services.

### Pydantic Schemas
- Validate request data.
- Serialize response data.
- Prevent malformed input.

### Services
- Business logic.
- POS transaction orchestration.
- Pricing.
- Inventory rules.
- Customer credit rules.
- Reports.

### Repositories
- Database access.
- Reusable queries.
- Keep database code out of route handlers.

### Dependencies
- Current user
- Organization
- Store
- Role
- Permission
- Database/session context

## Database
Supabase PostgreSQL is the primary database.

FastAPI must not expose database credentials to the frontend.

## Deployment
Frontend:
- Vercel

Backend:
- Railway/Render/Fly.io or another Python-compatible production host

Database/Auth/Storage:
- Supabase

## Important
FastAPI is the custom backend API. Supabase is the managed database/backend infrastructure. They are complementary, not interchangeable.

## Scaling Principle
Start as a modular monolith. Add workers/services only when actual workload requires them.
