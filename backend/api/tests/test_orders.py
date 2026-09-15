"""Order checkout + tracking tests."""

from api.tests.helpers import (
    ADDRESS_ID,
    ORDER_ID,
    Result,
    address_row,
    cart_row,
    order_row,
)


class TestOrders:
    def test_requires_auth(self, client):
        assert client.get("/v1/orders").status_code in (401, 403)

    def test_list_orders(self, client, auth_headers, mock_supabase):
        mock_supabase.t("orders").push(Result(data=[order_row()], count=1))
        resp = client.get("/v1/orders", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

    def test_checkout_empty_cart(self, client, auth_headers, mock_supabase):
        mock_supabase.t("addresses").push(Result(data=address_row()))
        mock_supabase.t("cart_items").push(Result(data=[]))
        resp = client.post("/v1/orders", headers=auth_headers, json={"address_id": ADDRESS_ID})
        assert resp.status_code == 400

    def test_checkout_creates_order(self, client, auth_headers, mock_supabase):
        mock_supabase.t("addresses").push(Result(data=address_row()))
        mock_supabase.t("cart_items").push(Result(data=[cart_row()]))
        mock_supabase.t("products").push(
            Result(data=[{"id": cart_row()["product_id"], "name": "Benchy", "est_print_minutes": 90}])
        )
        mock_supabase.t("orders").push(Result(data=[order_row()]))
        mock_supabase.t("order_items").push(
            Result(data=[{
                "id": "00000000-0000-0000-0000-0000000000aa",
                "order_id": ORDER_ID,
                "product_id": cart_row()["product_id"],
                "stl_upload_id": None,
                "name_snapshot": "Benchy",
                "quantity": 1,
                "unit_price": "199.00",
                "selected_color_ids": [],
                "width_mm": None,
                "depth_mm": None,
                "height_mm": None,
                "created_at": order_row()["created_at"],
            }])
        )
        mock_supabase.t("print_jobs").push(Result(data=[], count=0))
        resp = client.post("/v1/orders", headers=auth_headers, json={"address_id": ADDRESS_ID})
        assert resp.status_code == 201
        assert resp.json()["id"] == ORDER_ID
