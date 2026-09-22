# VentaPOS

Philippines-first, affordable cloud-based POS and inventory SaaS for sari-sari stores, mini groceries, and small retail/wholesale businesses.

> Stack: React + TypeScript + Vite + Tailwind (PWA) • Python + FastAPI • Supabase (PostgreSQL / Auth / Storage)
> Architecture: Modular monolith. See `docs/02-system-architecture.md`.

## Monorepo Layout

```text
VentaPOS/
├── docs/                  # Product plans (00-14, source of truth)
├── frontend/              # React + TS + Vite + Tailwind + PWA (Vercel)
│   ├── public/            # Static assets, manifest, icons
│   └── src/
│       ├── app/           # Router, providers, queryClient
│       ├── pages/         # Route pages
│       ├── features/      # Domain modules (pos, products, inventory, ...)
│       ├── components/    # ui / layout / common
│       ├── hooks/ lib/ services/ stores/
│       ├── pwa/           # register-sw, IndexedDB, sync-engine
│       ├── utils/ types/ styles/ assets/
│       └── tests/
├── admin/                 # Platform admin console (separate Vite app, port 5174)
│   └── src/
│       ├── app/           # Router, providers, queryClient
│       ├── pages/         # Dashboard, Organizations, Org detail, Upgrade requests
│       ├── components/    # ui / layout
│       ├── lib/ stores/
│       └── styles/ utils/
├── backend/               # FastAPI modular monolith (Railway/Render/Fly.io)
│   └── app/
│       ├── main.py
│       ├── core/          # config, database, security, logging, exceptions
│       ├── api/v1/        # router, dependencies, routes/
│       ├── schemas/       # Pydantic request/response
│       ├── models/        # SQLAlchemy / table models
│       ├── services/      # Business logic (POS orchestration, pricing, ...)
│       ├── repositories/  # DB access
│       ├── middleware/ utils/ jobs/
│   ├── tests/             # unit/ + integration/ (sale tx, inventory, utang, auth)
│   └── alembic/           # DB migrations
├── supabase/
│   ├── migrations/        # SQL migrations (source of truth for schema)
│   ├── seeds/             # Dev seed data
│   └── functions/         # Edge Functions (later, optional)
├── scripts/               # Dev/setup helpers
└── .github/workflows/     # CI for backend + frontend
```

## Request Flow

```text
React/PWA → FastAPI Router → Auth dep → AuthZ dep → Pydantic schema
→ Service → Repository → PostgreSQL → Response schema → React
```

FastAPI owns API, validation, authZ, business logic, POS transactions, reports.
Supabase provides PostgreSQL, Auth, Storage, RLS (defense in depth).

## Quick Start

### 1. Prerequisites
- Node 20+, Python 3.11+, Supabase project, Git

### 2. Backend
```powershell
cd backend
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
# docs: http://localhost:8000/docs
```

### 3. Frontend
```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

### 4. Admin console (platform admins only)
```powershell
cd admin
npm install
copy .env.example .env   # set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev              # http://localhost:5174
```
Sign-in requires an email listed in `backend/.env` → `PLATFORM_ADMIN_EMAILS`.

### 5. Supabase
- Create project at supabase.com
- Run `supabase/migrations/*.sql` in order
- Set RLS policies (see docs/03 + 05 + 11)
- Wire `SUPABASE_URL`, keys into `backend/.env` and `frontend/.env`

## API Versioning
All APIs under `/api/v1`. See `docs/04-api-specification.md`.

## Financial Integrity Rules
- Server is authoritative for prices/totals. Never trust client totals.
- Use DB transactions for sale completion. Sale must be atomic.
- Use idempotency keys for `POST /sales`.
- Use NUMERIC for money. Never hard-delete completed sales.
- Every stock change writes `inventory_movements`.

## Docs Index
- 00-project-overview, 01-product-requirements, 02-system-architecture
- 03-database-schema, 04-api-specification, 05-auth-and-permissions
- 06-pos-sales-flow, 07-inventory-system, 08-utang-and-customers
- 09-offline-sync (build AFTER online POS is stable), 10-saas-subscriptions
- 11-security, 12-bir-and-philippines-readiness, 13-development-roadmap, 14-coding-guidelines

## Branching
`main`, `develop`, `feature/*`, `fix/*`

Conventional commits, e.g. `feat: implement POS sale transaction`.
