"""Categories, colors and delivery tests."""

from api.tests.helpers import CATEGORY_ID, Result, category_row, color_row


class TestCategories:
    def test_public_list(self, client, mock_supabase):
        mock_supabase.t("categories").push(Result(data=[category_row()], count=1))
        resp = client.get("/v1/categories")
        assert resp.status_code == 200
        assert resp.json()["items"][0]["slug"] == "miniatures"

    def test_create_requires_admin(self, client, auth_headers, mock_supabase):
        resp = client.post(
            "/v1/categories",
            headers=auth_headers,
            json={"name": "New", "slug": "new"},
        )
        assert resp.status_code == 403

    def test_admin_creates(self, client, admin_headers, mock_supabase):
        mock_supabase.t("categories").push(Result(data=[category_row(name="New", slug="new")]))
        resp = client.post(
            "/v1/categories",
            headers=admin_headers,
            json={"name": "New", "slug": "new"},
        )
        assert resp.status_code == 201


class TestColors:
    def test_public_list(self, client, mock_supabase):
        mock_supabase.t("color_palette").push(Result(data=[color_row()], count=1))
        resp = client.get("/v1/colors")
        assert resp.status_code == 200
        assert resp.json()["items"][0]["hex_code"] == "#1A1A1A"


class TestDelivery:
    def test_not_serviceable(self, client, mock_supabase):
        mock_supabase.t("serviceable_pincodes").push(Result(data=None))
        resp = client.get("/v1/delivery/check?pincode=999999")
        assert resp.status_code == 200
        assert resp.json()["serviceable"] is False

    def test_serviceable(self, client, mock_supabase):
        mock_supabase.t("serviceable_pincodes").push(
            Result(data={"pincode": "411001", "city": "Pune", "state": "MH", "eta_days": 5, "is_active": True})
        )
        resp = client.get("/v1/delivery/check?pincode=411001")
        assert resp.status_code == 200
        body = resp.json()
        assert body["serviceable"] is True
        assert body["eta_days"] == 5
