"""Expense create: default expense_date must be business-local today
(Supabase current_date is UTC — wrong before 08:00 Manila)."""
import uuid

import pytest

from app.core.timezone import local_today
from app.services import expense_service


class _R:
    def __init__(self, data):
        self.data = data


class _Fake:
    def __init__(self, state, name=""):
        self.s = state
        self.n = name
        self._eq = []
        self._single = False

    def table(self, name):
        return _Fake(self.s, name)

    def select(self, *a, **k):
        return self

    def eq(self, col, val):
        self._eq.append((col, val))
        return self

    def maybe_single(self):
        self._single = True
        return self

    def insert(self, row):
        row = {**row, "id": str(uuid.uuid4())}
        self.s.setdefault(self.n, []).append(row)
        self._inserted = [row]
        return self

    def _rows(self):
        if hasattr(self, "_inserted"):
            return self._inserted
        rows = list(self.s.get(self.n, []))
        for col, val in self._eq:
            rows = [r for r in rows if str(r.get(col)) == str(val)]
        return rows

    def execute(self):
        rows = self._rows()
        if self._single:
            return _R(rows[0] if rows else None)
        return _R(rows)


def test_create_expense_defaults_to_business_local_today(monkeypatch):
    org = str(uuid.uuid4())
    store = str(uuid.uuid4())
    user = str(uuid.uuid4())
    cat = str(uuid.uuid4())
    state = {
        "expense_categories": [{"id": cat, "organization_id": org}],
        "expenses": [],
    }
    monkeypatch.setattr(expense_service, "_sb", lambda: _Fake(state))
    row = expense_service.create_expense(org, store, user, {
        "category_id": cat,
        "amount": 10,
        "payment_method": "cash",
        "notes": None,
        "expense_date": None,
    })
    assert row["expense_date"] == local_today().isoformat()


def test_create_expense_keeps_explicit_date(monkeypatch):
    org = str(uuid.uuid4())
    store = str(uuid.uuid4())
    user = str(uuid.uuid4())
    cat = str(uuid.uuid4())
    state = {
        "expense_categories": [{"id": cat, "organization_id": org}],
        "expenses": [],
    }
    monkeypatch.setattr(expense_service, "_sb", lambda: _Fake(state))
    row = expense_service.create_expense(org, store, user, {
        "category_id": cat,
        "amount": 10,
        "payment_method": "cash",
        "notes": None,
        "expense_date": "2026-01-15",
    })
    assert row["expense_date"] == "2026-01-15"
