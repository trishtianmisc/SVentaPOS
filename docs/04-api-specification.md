# VentaPOS — FastAPI API Specification

## Base URL

```text
/api/v1
```

FastAPI should expose interactive documentation in development at its standard OpenAPI documentation endpoints.

## Response Format

Success:
```json
{
  "data": {},
  "message": "Success"
}
```

Error:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request"
  }
}
```

## Auth

```text
GET    /api/v1/auth/me
POST   /api/v1/auth/logout
```

Supabase Auth remains the identity provider. FastAPI verifies the authenticated identity and resolves organization/store access.

## Products

```text
GET    /api/v1/products
GET    /api/v1/products/{id}
POST   /api/v1/products
PUT    /api/v1/products/{id}
DELETE /api/v1/products/{id}
POST   /api/v1/products/import
```

## Categories

```text
GET    /api/v1/categories
GET    /api/v1/categories/{id}
POST   /api/v1/categories
PUT    /api/v1/categories/{id}
DELETE /api/v1/categories/{id}
```

## Inventory

```text
GET    /api/v1/inventory
GET    /api/v1/inventory/low-stock
GET    /api/v1/inventory/{product_id}
POST   /api/v1/inventory/adjust
GET    /api/v1/inventory/movements
```

## POS / Sales

```text
POST   /api/v1/sales
GET    /api/v1/sales
GET    /api/v1/sales/{id}
POST   /api/v1/sales/{id}/void
POST   /api/v1/sales/{id}/return
```

## Customers

```text
GET    /api/v1/customers
GET    /api/v1/customers/{id}
POST   /api/v1/customers
PUT    /api/v1/customers/{id}
GET    /api/v1/customers/{id}/ledger
POST   /api/v1/customers/{id}/payment
```

## Suppliers

```text
GET    /api/v1/suppliers
GET    /api/v1/suppliers/{id}
POST   /api/v1/suppliers
PUT    /api/v1/suppliers/{id}
```

## Purchases

```text
GET    /api/v1/purchase-orders
POST   /api/v1/purchase-orders
GET    /api/v1/purchase-orders/{id}
PUT    /api/v1/purchase-orders/{id}
POST   /api/v1/purchase-orders/{id}/receive
```

## Reports

```text
GET    /api/v1/reports/sales
GET    /api/v1/reports/products
GET    /api/v1/reports/inventory
GET    /api/v1/reports/profit
GET    /api/v1/reports/expenses
```

## FastAPI Rules
- Use APIRouter by domain.
- Use Pydantic request/response schemas.
- Use dependency injection for authentication and authorization.
- Keep route handlers thin.
- Put business logic in services.
- Use repository/data-access modules for complex queries.
- Return typed response models.
- Use appropriate HTTP status codes.
- Never trust organization_id/store_id from the client.
- Never expose Supabase service-role credentials.
- Use idempotency for critical mutations.
