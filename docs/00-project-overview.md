# VentaPOS — Project Overview

## Product
VentaPOS is a Philippines-first, affordable cloud-based POS and inventory SaaS designed for sari-sari stores, mini groceries, retail shops, and small wholesale businesses.

## Core Promise
Make daily selling, inventory, utang, purchasing, and business reporting simple enough for a Filipino store owner to use from a phone, tablet, or computer.

## Primary Users
- Store owner
- Store manager
- Cashier
- Inventory staff
- VentaPOS platform administrator

## Core V1
- Multi-tenant organization/store model
- Authentication
- Product and category management
- Retail POS
- Inventory tracking
- Sales history
- Cash and digital-wallet payment recording
- Customers
- Utang ledger
- Suppliers
- Basic purchasing
- Expenses
- Basic reports
- Role-based access
- Audit logging
- Responsive PWA

## Later
- Wholesale pricing
- Multi-store management
- Offline-first synchronization
- AI store assistant
- Demand forecasting
- Restock recommendations
- SaaS billing
- BIR-related capabilities where applicable
- Payment integrations

## Product Principles
1. POS must be fast.
2. Mobile-first is mandatory.
3. Do not collect unnecessary customer data.
4. Inventory movements must be auditable.
5. Never silently delete financial records.
6. Design for unreliable internet.
7. Keep the MVP simple.
8. Build multi-tenancy into the data model from day one.

## Technology Stack
- Frontend: React + TypeScript + Vite + Tailwind CSS
- PWA: Service Worker + IndexedDB strategy
- Backend: **Python + FastAPI**
- Database: Supabase PostgreSQL
- Authentication: Supabase Auth
- Storage: Supabase Storage
- Frontend hosting: Vercel
- FastAPI hosting: Railway, Render, Fly.io, or another suitable Python host
- Optional later: background workers and Supabase Edge Functions

## Backend Responsibility
FastAPI is the custom application backend. It owns:
- API endpoints
- Request validation
- Authorization
- Business logic
- POS transaction orchestration
- Inventory rules
- Pricing rules
- Reporting logic
- Webhooks/integrations
- Server-side security

Supabase primarily provides:
- PostgreSQL
- Auth
- Storage
- RLS
- Managed database infrastructure

## Architecture Principle
Use a modular monolith first. Do not introduce microservices until there is a demonstrated need.
