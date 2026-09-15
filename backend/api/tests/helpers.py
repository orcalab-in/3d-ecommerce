"""Shared test helpers: mock result builder + sample data factories.

The SupabaseMock mimics the supabase-py fluent query builder: every chaining
method returns self, and .execute() pops the next queued Result. Configure a
table's responses with `mock_supabase.t("items").push(Result(data=[...]))`.
"""

USER_ID = "00000000-0000-0000-0000-000000000001"
PRODUCT_ID = "00000000-0000-0000-0000-0000000000a1"
CATEGORY_ID = "00000000-0000-0000-0000-0000000000c1"
COLOR_ID = "00000000-0000-0000-0000-0000000000f1"
ADDRESS_ID = "00000000-0000-0000-0000-0000000000d1"
CART_ID = "00000000-0000-0000-0000-0000000000e1"
ORDER_ID = "00000000-0000-0000-0000-0000000000b1"
PRICING_ID = "00000000-0000-0000-0000-0000000000aa"

NOW = "2024-01-15T10:00:00+00:00"
TODAY = "2024-01-15"


class Result:
    """Mimics a Supabase query result."""

    def __init__(self, data, count=None):
        self.data = data
        self.count = count


class TableMock:
    """Query-builder-aware mock — every chaining method returns self, execute() pops a queue."""

    def __init__(self):
        self._queue: list[Result] = []
        self.calls: list[tuple] = []  # (method_name, args, kwargs)

    def push(self, *results: Result) -> "TableMock":
        self._queue.extend(results)
        return self

    def execute(self) -> Result:
        if self._queue:
            return self._queue.pop(0)
        return Result(data=[])

    def __getattr__(self, name: str):
        if name.startswith("_"):
            raise AttributeError(name)

        def method(*args, **kwargs):
            self.calls.append((name, args, kwargs))
            return self

        return method


class SupabaseMock:
    """Top-level mock that dispatches table() calls to per-table TableMocks."""

    def __init__(self):
        self._tables: dict[str, TableMock] = {}

    def table(self, name: str) -> TableMock:
        if name not in self._tables:
            self._tables[name] = TableMock()
        return self._tables[name]

    def t(self, name: str) -> TableMock:
        """Shorthand: configure table and return its mock."""
        return self.table(name)


# ---------------------------------------------------------------------------
# Sample row factories — return dicts matching DB column names
# ---------------------------------------------------------------------------

def user_row(**overrides):
    return {
        "id": USER_ID,
        "google_id": "google-123",
        "name": "Test User",
        "email": "test@example.com",
        "picture_url": None,
        "phone": None,
        "role": "customer",
        "created_at": NOW,
        "updated_at": NOW,
        **overrides,
    }


def category_row(**overrides):
    return {
        "id": CATEGORY_ID,
        "name": "Miniatures",
        "slug": "miniatures",
        "description": None,
        "parent_id": None,
        "sort_order": 1,
        "created_at": NOW,
        "updated_at": NOW,
        **overrides,
    }


def color_row(**overrides):
    return {
        "id": COLOR_ID,
        "name": "Black",
        "hex_code": "#1A1A1A",
        "in_stock": True,
        "created_at": NOW,
        "updated_at": NOW,
        **overrides,
    }


def product_row(**overrides):
    return {
        "id": PRODUCT_ID,
        "name": "Benchy",
        "slug": "benchy",
        "description": "Calibration boat",
        "weight_grams": "12.50",
        "base_price": "199.00",
        "currency": "INR",
        "status": "active",
        "preview_image_url": None,
        "model_file_url": None,
        "est_print_minutes": 90,
        "width_mm": "60.00",
        "depth_mm": "31.00",
        "height_mm": "48.00",
        "max_colors": 2,
        "featured": False,
        "created_at": NOW,
        "updated_at": NOW,
        **overrides,
    }


def address_row(**overrides):
    return {
        "id": ADDRESS_ID,
        "user_id": USER_ID,
        "label": "Home",
        "recipient_name": "Test User",
        "phone": "9999999999",
        "line1": "1 Test St",
        "line2": None,
        "city": "Pune",
        "state": "Maharashtra",
        "pincode": "411001",
        "is_default": True,
        "created_at": NOW,
        "updated_at": NOW,
        **overrides,
    }


def cart_row(**overrides):
    return {
        "id": CART_ID,
        "user_id": USER_ID,
        "product_id": PRODUCT_ID,
        "quantity": 1,
        "selected_color_ids": [],
        "scale": "1.0",
        "width_mm": None,
        "depth_mm": None,
        "height_mm": None,
        "unit_price": "199.00",
        "created_at": NOW,
        "updated_at": NOW,
        **overrides,
    }


def order_row(**overrides):
    return {
        "id": ORDER_ID,
        "user_id": USER_ID,
        "address_id": ADDRESS_ID,
        "status": "confirmed",
        "subtotal": "199.00",
        "shipping_fee": "49.00",
        "total": "248.00",
        "expected_delivery_date": TODAY,
        "placed_at": NOW,
        "created_at": NOW,
        "updated_at": NOW,
        **overrides,
    }


def pricing_row(**overrides):
    return {
        "id": PRICING_ID,
        "filament_price_per_gram": "2.5000",
        "electricity_rate_per_kwh": "8.0000",
        "printer_power_watts": "100.00",
        "labor_rate_per_hour": "60.00",
        "margin_pct": "20.00",
        "is_active": True,
        "created_at": NOW,
        "updated_at": NOW,
        **overrides,
    }
