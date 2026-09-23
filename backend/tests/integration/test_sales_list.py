"""Sales list enrichment + date/status/payment/search filters.

Service fakes Supabase in-memory; routes, envelopes, Query validation real."""
import uuid
from datetime import date, datetime, timezone

import pytest

from app.api.v1 import dependencies as deps
from app.main import app
from app.services import sale_service, user_service

ORG = str(uuid.uuid4())
STORE = str(uuid.uuid4())
USER = str(uuid.uuid4())
CUST = str(uuid.uuid4())


class _R:
    def __init__(self, data):
        self.data = data


class _Fake:
    """Chainable supabase fake covering filters used by list_sales/get_sale."""

    def __init__(self, state, name=""):
        self.s = state
        self.n = name
        self._eq: list[tuple] = []
        self._gte: list[tuple] = []
        self._lte: list[tuple] = []
        self._ilike: list[tuple] = []
        self._in: list[tuple] = []
        self._order = None
        self._desc = False
        self._limit: int | None = None
        self._single = False

    def table(self, name):
        return _Fake(self.s, name)

    def select(self, *a, **k):
        return self

    def eq(self, col, val):
        self._eq.append((col, val))
        return self

    def gte(self, col, val):
        self._gte.append((col, val))
        return self

    def lte(self, col, val):
        self._lte.append((col, val))
        return self

    def ilike(self, col, pattern):
        self._ilike.append((col, pattern))
        return self

    def in_(self, col, vals):
        self._in.append((col, list(vals)))
        return self

    def order(self, col, desc=False):
        self._order = col
        self._desc = desc
        return self

    def limit(self, n):
        self._limit = n
        return self

    def maybe_single(self):
        self._single = True
        return self

    def _rows(self):
        rows = list(self.s.get(self.n, []))
        for col, val in self._eq:
            rows = [r for r in rows if str(r.get(col)) == str(val)]
        for col, val in self._gte:
            rows = [r for r in rows if (r.get(col) or "") >= val]
        for col, val in self._lte:
            rows = [r for r in rows if (r.get(col) or "") <= val]
        for col, pattern in self._ilike:
            needle = pattern.strip("%").lower()
            rows = [r for r in rows if needle in (r.get(col) or "").lower()]
        for col, vals in self._in:
            allowed = {str(v) for v in vals}
            rows = [r for r in rows if str(r.get(col)) in allowed]
        if self._order:
            rows.sort(
                key=lambda r: r.get(self._order) or "",
                reverse=self._desc,
            )
        if self._limit is not None:
            rows = rows[: self._limit]
        return rows

    def execute(self):
        rows = self._rows()
        if self._single:
            return _R(rows[0] if rows else None)
        return _R(rows)


def _mk_sale(sid, total=100.0, status="COMPLETED", created_at=None,
             receipt=None, customer_id=None, cashier=USER):
    return {
        "id": sid,
        "organization_id": ORG,
        "store_id": STORE,
        "receipt_number": receipt or f"MAIN-{sid[:6].upper()}",
        "subtotal": total,
        "discount_amount": 0,
        "tax_amount": 0,
        "tax_rate": 0,
        "vatable_amount": total,
        "total": total,
        "status": status,
        "created_at": created_at or "2026-09-22T10:00:00+00:00",
        "cashier_id": cashier,
        "customer_id": customer_id,
        "voided_by": None,
        "void_reason": None,
        "voided_at": None,
        "store_id": STORE,
    }


@pytest.fixture()
def state():
    s1 = str(uuid.uuid4())
    s2 = str(uuid.uuid4())
    s3 = str(uuid.uuid4())
    sales = [
        _mk_sale(s1, total=100.0, created_at="2026-09-22T09:00:00+00:00",
                 receipt="MAIN-ALPHA", customer_id=CUST),
        _mk_sale(s2, total=50.0, status="VOIDED",
                 created_at="2026-09-21T15:00:00+00:00", receipt="MAIN-BETA"),
        _mk_sale(s3, total=75.0, created_at="2026-09-20T12:00:00+00:00",
                 receipt="MAIN-GAMMA"),
    ]
    return {
        "sales": sales,
        "sale_items": [
            {"sale_id": s1, "id": "i1"},
            {"sale_id": s1, "id": "i2"},
            {"sale_id": s2, "id": "i3"},
            {"sale_id": s3, "id": "i4"},
        ],
        "sale_payments": [
            {"sale_id": s1, "payment_method": "cash", "amount": 100},
            {"sale_id": s2, "payment_method": "gcash", "amount": 50},
            {"sale_id": s3, "payment_method": "cash", "amount": 75},
        ],
        "customers": [{"id": CUST, "name": "Juan Dela Cruz"}],
        "profiles": [
            {"id": USER, "full_name": "Cashier One"},
        ],
        "ids": (s1, s2, s3),
    }


@pytest.fixture()
def sales_ctx(client, monkeypatch, state):
    monkeypatch.setattr(sale_service, "_sb", lambda: _Fake(state))
    monkeypatch.setattr(user_service, "_sb", lambda: _Fake(state))
    # No auth-admin network for missing profile ids.
    monkeypatch.setattr(user_service, "_auth_emails", lambda ids: {})

    async def _user():
        return deps.CurrentUser(
            id=uuid.UUID(USER), email="cashier@shop.ph",
            organization_id=uuid.UUID(ORG),
            stores=[{"store_id": STORE, "role": "owner"}])

    async def _org():
        return uuid.UUID(ORG)

    async def _store():
        return {"store_id": STORE, "role": "owner"}

    app.dependency_overrides[deps.get_current_user] = _user
    app.dependency_overrides[deps.get_current_organization] = _org
    app.dependency_overrides[deps.get_current_store] = _store
    yield state
    app.dependency_overrides.clear()


def test_list_sales_enriches_customer_items_payments(sales_ctx, client):
    r = client.get("/api/v1/sales")
    assert r.status_code == 200, r.text
    rows = r.json()["data"]
    assert len(rows) == 3
    by_id = {row["id"]: row for row in rows}
    s1, s2, s3 = sales_ctx["ids"]

    assert by_id[s1]["customer_name"] == "Juan Dela Cruz"
    assert by_id[s1]["items_count"] == 2
    assert by_id[s1]["payment_method"] == "cash"
    assert by_id[s1]["paid"] == 100.0
    assert by_id[s1]["cashier_name"] == "Cashier One"

    # Walk-in: no customer → null (UI shows Walk-in).
    assert by_id[s2]["customer_name"] is None
    assert by_id[s2]["items_count"] == 1
    assert by_id[s2]["payment_method"] == "gcash"
    assert by_id[s3]["items_count"] == 1


def test_list_sales_status_and_search_filters(sales_ctx, client):
    r = client.get("/api/v1/sales", params={"status": "voided"})
    assert r.status_code == 200
    rows = r.json()["data"]
    assert len(rows) == 1
    assert rows[0]["status"] == "VOIDED"

    r = client.get("/api/v1/sales", params={"q": "alpha"})
    rows = r.json()["data"]
    assert len(rows) == 1
    assert rows[0]["receipt_number"] == "MAIN-ALPHA"

    r = client.get("/api/v1/sales", params={"status": "COMPLETED"})
    assert len(r.json()["data"]) == 2


def test_list_sales_date_range_inclusive(sales_ctx, client):
    r = client.get(
        "/api/v1/sales",
        params={"from": "2026-09-21", "to": "2026-09-22"},
    )
    assert r.status_code == 200
    rows = r.json()["data"]
    receipts = {row["receipt_number"] for row in rows}
    assert receipts == {"MAIN-ALPHA", "MAIN-BETA"}

    # Single day.
    r = client.get("/api/v1/sales", params={"from": "2026-09-20", "to": "2026-09-20"})
    rows = r.json()["data"]
    assert [row["receipt_number"] for row in rows] == ["MAIN-GAMMA"]


def test_list_sales_today_uses_local_day_not_utc(sales_ctx, client):
    """Early-morning local sale (prev UTC day) must match Today filter.

    Sale at 02:11 Asia/Manila (+8) on 2026-09-24 is 2026-09-23T18:11Z.
    Today (local 2026-09-24) must include it; Yesterday must not.
    """
    s_early = str(uuid.uuid4())
    sales_ctx["sales"].append(_mk_sale(
        s_early, total=42.0,
        created_at="2026-09-23T18:11:00+00:00",
        receipt="MAIN-EARLY",
    ))

    r = client.get("/api/v1/sales",
                   params={"from": "2026-09-24", "to": "2026-09-24"})
    assert r.status_code == 200
    receipts = {row["receipt_number"] for row in r.json()["data"]}
    assert "MAIN-EARLY" in receipts

    r = client.get("/api/v1/sales",
                   params={"from": "2026-09-23", "to": "2026-09-23"})
    receipts = {row["receipt_number"] for row in r.json()["data"]}
    assert "MAIN-EARLY" not in receipts


def test_list_sales_payment_method_filter(sales_ctx, client):
    r = client.get("/api/v1/sales", params={"payment_method": "gcash"})
    assert r.status_code == 200
    rows = r.json()["data"]
    assert len(rows) == 1
    assert rows[0]["payment_method"] == "gcash"

    r = client.get("/api/v1/sales", params={"payment_method": "cash"})
    assert len(r.json()["data"]) == 2


def test_list_sales_limit_validation(sales_ctx, client):
    assert client.get("/api/v1/sales", params={"limit": 0}).status_code == 422
    assert client.get("/api/v1/sales", params={"limit": 501}).status_code == 422
    assert client.get("/api/v1/sales", params={"limit": 500}).status_code == 200


def test_list_sales_default_order_desc(sales_ctx, client):
    rows = client.get("/api/v1/sales").json()["data"]
    created = [row["created_at"] for row in rows]
    assert created == sorted(created, reverse=True)


def test_get_sale_enriches_customer_and_counts(sales_ctx, client):
    s1 = sales_ctx["ids"][0]
    r = client.get(f"/api/v1/sales/{s1}")
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["customer_name"] == "Juan Dela Cruz"
    assert data["items_count"] == 2
    assert data["payment_method"] == "cash"
    assert data["paid"] == 100.0
    assert len(data["items"]) == 2
    assert len(data["payments"]) == 1


def test_get_sale_not_found(sales_ctx, client):
    r = client.get(f"/api/v1/sales/{uuid.uuid4()}")
    assert r.status_code == 404


def test_list_sales_query_alias_from_param(sales_ctx, client, monkeypatch):
    """Route maps `from` alias → service date_from without validation crash."""
    seen = {}

    def spy(o, s, **kw):
        seen.update(kw)
        return []

    monkeypatch.setattr(sale_service, "list_sales", spy)
    r = client.get(
        "/api/v1/sales",
        params={
            "from": "2026-09-01",
            "to": "2026-09-15",
            "status": "COMPLETED",
            "payment_method": "cash",
            "q": "MAIN",
            "limit": 100,
        },
    )
    assert r.status_code == 200, r.text
    assert seen["date_from"] == "2026-09-01"
    assert seen["date_to"] == "2026-09-15"
    assert seen["status"] == "COMPLETED"
    assert seen["payment_method"] == "cash"
    assert seen["q"] == "MAIN"
    assert seen["limit"] == 100
