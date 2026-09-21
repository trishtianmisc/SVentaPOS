# VentaPOS — Development Roadmap

## Phase 0 — Foundation
- Repository
- React/Vite
- FastAPI project
- Supabase project
- Environment variables
- Database migrations
- RLS strategy
- API versioning
- Pydantic schemas
- Authentication dependency
- Error handling
- Logging
- CI/build

## Phase 1 — MVP POS
- Auth
- Organization
- Store
- Roles
- Categories
- Products
- Inventory
- POS
- Sales
- Cash payment
- Receipt
- Sales history

### Exit Criteria
A test store can:
1. Create products.
2. Add stock.
3. Complete a sale.
4. See inventory decrease.
5. View the sale.
6. Reconcile payment.

## Phase 2 — Business Operations
- Customers
- Utang
- Payments
- Suppliers
- Purchases
- Expenses
- Wholesale pricing
- Low-stock alerts
- Reports

## Phase 3 — Production SaaS
- Subscription plans
- Billing
- SaaS admin
- Usage limits
- Audit logs
- Notifications
- Monitoring
- Backup/recovery

## Phase 4 — Offline
- PWA caching
- IndexedDB
- Offline catalog
- Offline sales queue
- Idempotent sync
- Conflict handling
- Multi-device testing

## Phase 5 — Advanced
- Multi-store
- Stock transfers
- Advanced analytics
- AI assistant
- Demand forecasting
- Restock recommendations
- Integrations

## Recommended Build Order

```text
Database
 ↓
Supabase Auth
 ↓
FastAPI authentication
 ↓
RLS
 ↓
Products
 ↓
Inventory
 ↓
POS transaction
 ↓
Sales history
 ↓
Customers/Utang
 ↓
Purchasing
 ↓
Reports
 ↓
Subscriptions
 ↓
Offline
 ↓
AI
```

## Do Not Build First
- Marketplace
- Delivery platform
- Full accounting ERP
- Payroll
- Complex loyalty system
- Multi-country support
- Microservices
- AI before transaction correctness
