# VentaPOS — Security Requirements

## Authentication
- Supabase Auth
- Secure session handling
- FastAPI authentication dependencies
- Protected endpoints
- Password/session controls according to provider capabilities

## Authorization
Use:
- Organization membership
- Store membership
- Role
- Permission
- RLS

Frontend guards are not security controls.

## Secrets
Never commit:
- Supabase service-role key
- Database passwords
- JWT secrets
- Payment secrets
- AI API keys

Use environment variables or managed secrets.

## Input Validation
Validate:
- JSON bodies
- Query parameters
- Path parameters
- File uploads
- CSV imports

FastAPI/Pydantic should be used for request/response validation.

## SQL Injection
Use parameterized queries and safe database APIs. Never concatenate raw user input into SQL.

## Rate Limiting
Protect:
- Authentication-related endpoints
- Public endpoints
- Contact forms
- Imports
- Expensive reports
- Sensitive mutations

## Financial Integrity
- Use transactions.
- Use idempotency.
- Never hard-delete completed sales.
- Use NUMERIC/DECIMAL for money.
- Recalculate authoritative totals server-side.
- Never trust a client-supplied total.

## Audit Logs
Log:
- Product changes
- Price changes
- Inventory adjustments
- Sale voids
- Returns
- User/role changes
- Subscription changes
- Privileged actions

## Storage
- Validate file type/size.
- Use controlled paths.
- Protect private assets.
- Do not expose secrets through public storage metadata.

## Privacy
Collect only necessary information. Maintain privacy documentation, access controls, retention rules, and appropriate security safeguards.
