"""Cart tests — color limit + build-volume clamping."""

from api.tests.helpers import PRODUCT_ID, Result, cart_row, product_row


class TestCart:
    def test_requires_auth(self, client):
        assert client.get("/v1/cart").status_code in (401, 403)

    def test_get_cart_subtotal(self, client, auth_headers, mock_supabase):
        mock_supabase.t("cart_items").push(Result(data=[cart_row(quantity=2)]))
        resp = client.get("/v1/cart", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] == 1
        assert body["subtotal"] == "398.00"

    def test_add_to_cart(self, client, auth_headers, mock_supabase):
        mock_supabase.t("products").push(Result(data=product_row()))
        mock_supabase.t("cart_items").push(Result(data=[cart_row()]))
        resp = client.post(
            "/v1/cart",
            headers=auth_headers,
            json={"product_id": PRODUCT_ID, "quantity": 1},
        )
        assert resp.status_code == 201

    def test_rejects_oversize(self, client, auth_headers, mock_supabase):
        mock_supabase.t("products").push(Result(data=product_row()))
        resp = client.post(
            "/v1/cart",
            headers=auth_headers,
            json={"product_id": PRODUCT_ID, "height_mm": "300.00"},
        )
        assert resp.status_code == 400

    def test_rejects_too_many_colors(self, client, auth_headers, mock_supabase):
        mock_supabase.t("products").push(Result(data=product_row(max_colors=1)))
        resp = client.post(
            "/v1/cart",
            headers=auth_headers,
            json={
                "product_id": PRODUCT_ID,
                "selected_color_ids": [
                    "00000000-0000-0000-0000-0000000000f1",
                    "00000000-0000-0000-0000-0000000000f2",
                ],
            },
        )
        assert resp.status_code == 400
