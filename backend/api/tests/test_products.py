"""Product catalog tests."""

from api.tests.helpers import PRODUCT_ID, Result, product_row


class TestListProducts:
    def test_public_list(self, client, mock_supabase):
        mock_supabase.t("products").push(Result(data=[product_row()], count=1))
        resp = client.get("/v1/products")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["id"] == PRODUCT_ID

    def test_search_and_sort(self, client, mock_supabase):
        mock_supabase.t("products").push(Result(data=[product_row()], count=1))
        resp = client.get("/v1/products?q=benchy&sort=price_asc")
        assert resp.status_code == 200


class TestGetProduct:
    def test_detail_includes_links(self, client, mock_supabase):
        mock_supabase.t("products").push(Result(data=product_row()))
        resp = client.get(f"/v1/products/{PRODUCT_ID}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["categories"] == []
        assert body["colors"] == []

    def test_404_when_missing(self, client, mock_supabase):
        mock_supabase.t("products").push(Result(data=None))
        resp = client.get(f"/v1/products/{PRODUCT_ID}")
        assert resp.status_code == 404


class TestAdminGating:
    def test_create_requires_admin(self, client, auth_headers, mock_supabase):
        resp = client.post(
            "/v1/products",
            headers=auth_headers,
            json={"name": "X", "slug": "x", "weight_grams": "10.00", "base_price": "100.00"},
        )
        assert resp.status_code == 403

    def test_admin_creates(self, client, admin_headers, mock_supabase):
        mock_supabase.t("products").push(Result(data=[product_row()]))
        resp = client.post(
            "/v1/products",
            headers=admin_headers,
            json={"name": "Benchy", "slug": "benchy", "weight_grams": "12.50", "base_price": "199.00"},
        )
        assert resp.status_code == 201
        assert resp.json()["slug"] == "benchy"

    def test_max_colors_validation(self, client, admin_headers, mock_supabase):
        resp = client.post(
            "/v1/products",
            headers=admin_headers,
            json={"name": "B", "slug": "b", "weight_grams": "1.00", "base_price": "1.00", "max_colors": 9},
        )
        assert resp.status_code == 422
