"""Report schemas (read-only aggregations, tax = 0 in Phase 2)."""
from pydantic import BaseModel


class SalesSummary(BaseModel):
    total: float
    count: int
    average: float
    by_day: list[dict] = []
    by_method: list[dict] = []


class ProductSalesRow(BaseModel):
    product_id: str
    product_name: str
    quantity: float
    revenue: float


class ProfitSummary(BaseModel):
    revenue: float
    cogs: float
    gross_profit: float


class InventorySummary(BaseModel):
    lines: int
    stock_value: float
    low_stock: int


class ExpenseSummary(BaseModel):
    total: float
    count: int = 0
    average: float = 0
    by_category: list[dict] = []
    by_method: list[dict] = []
    by_day: list[dict] = []


class UtangSummary(BaseModel):
    total_outstanding: float
    customers: list[dict] = []
