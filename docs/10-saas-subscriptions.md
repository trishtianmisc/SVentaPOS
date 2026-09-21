# VentaPOS — SaaS Subscription Architecture

## Suggested Plans
These are product proposals and must be validated against actual infrastructure costs, support costs, and market demand.

### Free
- 1 store
- 1 user
- Limited products
- Basic POS
- Basic inventory

### Starter
- 1 store
- More users
- Expanded/unlimited products
- Utang
- Suppliers
- Reports

### Business
- Multiple stores
- More users
- Advanced reports
- Wholesale pricing
- Purchase orders

### Pro
- Advanced analytics
- AI features
- Expanded multi-store capabilities
- Priority support

## Tables

### subscription_plans
- id
- name
- price
- billing_interval
- feature_limits JSONB
- active

### subscriptions
- id
- organization_id
- plan_id
- status
- provider
- provider_customer_id
- provider_subscription_id
- current_period_start
- current_period_end
- created_at
- updated_at

## Billing
Use a payment provider with verified webhooks.

```text
Payment Provider
 ↓
Webhook
 ↓
FastAPI endpoint
 ↓
Verify signature/event
 ↓
Update subscription
```

Never trust a frontend-only payment success state.

## Feature Limits
Enforce subscription limits server-side.

Examples:
- Stores
- Users
- Products
- Reports
- AI usage
