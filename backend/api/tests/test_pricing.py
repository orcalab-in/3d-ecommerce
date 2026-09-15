"""Pricing calculator tests."""

from decimal import Decimal

from api.services.pricing import compute_quote
from api.tests.helpers import Result, pricing_row


def test_compute_quote_formula():
    # 100 g, 60 min (1 h), rates from pricing_row.
    q = compute_quote(
        config=pricing_row(),
        weight_grams=Decimal("100"),
        print_minutes=60,
        quantity=1,
    )
    # material = 100 * 2.5 = 250; electricity = 0.1 * 1 * 8 = 0.80; labor = 1 * 60 = 60
    assert q["material_cost"] == Decimal("250.00")
    assert q["electricity_cost"] == Decimal("0.80")
    assert q["labor_cost"] == Decimal("60.00")
    # base = 310.80; margin 20% = 62.16; unit = 372.96
    assert q["unit_price"] == Decimal("372.96")


class TestQuoteEndpoint:
    def test_quote_with_weight(self, client, mock_supabase):
        mock_supabase.t("pricing_config").push(Result(data=pricing_row()))
        resp = client.post("/v1/pricing/quote", json={"weight_grams": "100.00", "print_minutes": 60})
        assert resp.status_code == 200
        assert resp.json()["unit_price"] == "372.96"

    def test_quote_requires_weight_or_volume(self, client, mock_supabase):
        resp = client.post("/v1/pricing/quote", json={"print_minutes": 60})
        assert resp.status_code == 422

    def test_get_config(self, client, mock_supabase):
        mock_supabase.t("pricing_config").push(Result(data=pricing_row()))
        resp = client.get("/v1/pricing/config")
        assert resp.status_code == 200

    def test_update_config_requires_admin(self, client, auth_headers, mock_supabase):
        resp = client.patch("/v1/pricing/config", headers=auth_headers, json={"margin_pct": "25.00"})
        assert resp.status_code == 403
