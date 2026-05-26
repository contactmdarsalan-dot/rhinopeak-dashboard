from __future__ import annotations

from apps.rhinopeak.tests.test_api import RhinoPeakApiTestCase


class TenantIsolationTests(RhinoPeakApiTestCase):
    def _seed_sale(self, token: str, suffix: str) -> tuple[str, str]:
        customer_id = f"tenant-customer-{suffix}"
        sale_id = f"tenant-sale-{suffix}"
        self.assert_status(
            self.api(
                "POST",
                "/customers",
                {"id": customer_id, "name": f"Tenant Customer {suffix}"},
                token=token,
            ),
            200,
        )
        self.assert_status(
            self.api(
                "POST",
                "/sales",
                {
                    "id": sale_id,
                    "customerId": customer_id,
                    "customer": f"Tenant Customer {suffix}",
                    "items": [{"productName": "Consulting", "quantity": 1, "unitPrice": 250, "tax": 0}],
                },
                token=token,
            ),
            200,
        )
        return customer_id, sale_id

    def test_workspace_a_cannot_read_workspace_b_sales(self) -> None:
        tenant_a = self.register_owner(email=f"tenant-a-read-{self.suffix}@rhinopeak.test")
        tenant_b = self.register_owner(email=f"tenant-b-read-{self.suffix}@rhinopeak.test")
        _, tenant_b_sale_id = self._seed_sale(tenant_b["session"]["accessToken"], f"b-{self.suffix}")

        self.assert_status(
            self.api("GET", f"/details/sales/{tenant_b_sale_id}", token=tenant_a["session"]["accessToken"]),
            404,
        )

    def test_cross_workspace_mutations_return_404(self) -> None:
        tenant_a = self.register_owner(email=f"tenant-a-write-{self.suffix}@rhinopeak.test")
        tenant_b = self.register_owner(email=f"tenant-b-write-{self.suffix}@rhinopeak.test")
        tenant_b_customer_id, tenant_b_sale_id = self._seed_sale(
            tenant_b["session"]["accessToken"],
            f"b-write-{self.suffix}",
        )

        tenant_a_token = tenant_a["session"]["accessToken"]
        self.assert_status(
            self.api("PATCH", f"/customers/{tenant_b_customer_id}", {"name": "Cross Tenant"}, token=tenant_a_token),
            404,
        )
        self.assert_status(self.api("DELETE", f"/sales/{tenant_b_sale_id}", token=tenant_a_token), 404)

    def test_platform_admin_token_cannot_access_tenant_data_routes(self) -> None:
        tenant = self.register_owner(email=f"tenant-owner-{self.suffix}@rhinopeak.test")
        _, sale_id = self._seed_sale(tenant["session"]["accessToken"], f"platform-{self.suffix}")

        setup = self.assert_status(
            self.api(
                "POST",
                "/platform/auth/setup-owner",
                {
                    "setupToken": self.platform_setup_token,
                    "name": "Platform Owner",
                    "email": f"platform-isolation-{self.suffix}@rhinopeak.test",
                    "password": "Platform12345!",
                },
            ),
            200,
        )
        platform_token = setup["session"]["accessToken"]

        self.assert_status(self.api("GET", "/bootstrap", token=platform_token), 401)
        self.assert_status(self.api("GET", f"/details/sales/{sale_id}", token=platform_token), 401)
