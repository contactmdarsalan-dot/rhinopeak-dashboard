from __future__ import annotations

import json
import uuid
from typing import Any

from django.test import Client, SimpleTestCase, override_settings

from apps.rhinopeak.data.mongo import collection, ensure_indexes, mongo_client, mongo_db
from apps.rhinopeak.domain.security import hash_password, hash_token


class RhinoPeakApiTestCase(SimpleTestCase):
    maxDiff = None
    platform_setup_token = "test-platform-setup-token"

    @classmethod
    def setUpClass(cls) -> None:
        cls.mongo_database_name = f"rhinopeak_test_{uuid.uuid4().hex}"
        cls.settings_override = override_settings(
            MONGO_DB_NAME=cls.mongo_database_name,
            PLATFORM_SETUP_TOKEN=cls.platform_setup_token,
            EXPOSE_RESET_TOKEN=True,
        )
        cls.settings_override.enable()
        mongo_client.cache_clear()
        super().setUpClass()

    @classmethod
    def tearDownClass(cls) -> None:
        try:
            mongo_client().drop_database(cls.mongo_database_name)
            mongo_client.cache_clear()
        finally:
            super().tearDownClass()
            cls.settings_override.disable()

    def setUp(self) -> None:
        mongo_client().drop_database(self.mongo_database_name)
        ensure_indexes()
        self.client = Client()
        self.suffix = uuid.uuid4().hex[:10]

    def api(
        self,
        method: str,
        path: str,
        data: dict[str, Any] | None = None,
        token: str | None = None,
    ):
        headers = {}
        if token:
            headers["HTTP_AUTHORIZATION"] = f"Bearer {token}"
        url = f"/api{path}"
        if method.upper() == "GET":
            return self.client.get(url, **headers)
        return self.client.generic(
            method.upper(),
            url,
            data=json.dumps(data or {}),
            content_type="application/json",
            **headers,
        )

    def payload(self, response) -> dict[str, Any]:
        content = response.content.decode("utf-8")
        return json.loads(content) if content else {}

    def assert_status(self, response, status_code: int) -> dict[str, Any]:
        self.assertEqual(response.status_code, status_code, response.content.decode("utf-8"))
        return self.payload(response)

    def register_owner(self, email: str | None = None, business_name: str | None = None) -> dict[str, Any]:
        email = email or f"owner-{self.suffix}@rhinopeak.test"
        business_name = business_name or f"QA Mart {self.suffix}"
        response = self.api(
            "POST",
            "/auth/register",
            {
                "name": "QA Owner",
                "email": email,
                "password": "QaPass12345!",
                "businessName": business_name,
            },
        )
        data = self.assert_status(response, 200)
        self.assertEqual(data["user"]["email"], email)
        self.assertIn("accessToken", data["session"])
        return data

    def auth_token(self) -> str:
        return self.register_owner()["session"]["accessToken"]


class AuthAndCoreApiTests(RhinoPeakApiTestCase):
    def test_auth_lifecycle_health_schema_mobile_and_logout(self) -> None:
        health = self.assert_status(self.api("GET", "/health"), 200)
        self.assertTrue(health["ok"])
        self.assertEqual(health["database"], "mongodb")
        self.assertEqual(health["databaseName"], self.mongo_database_name)

        schema = self.assert_status(self.api("GET", "/schema/audit"), 200)
        self.assertEqual(schema["missingCollectionCount"], 0)
        self.assertEqual(schema["missingFieldCount"], 0)

        unauthenticated = self.assert_status(self.api("GET", "/bootstrap"), 401)
        self.assertIn("bearer", unauthenticated["error"].lower())

        invalid_register = self.assert_status(
            self.api(
                "POST",
                "/auth/register",
                {
                    "name": "Bad Owner",
                    "email": f"bad-{self.suffix}@rhinopeak.test",
                    "password": "short",
                    "businessName": "Bad Business",
                },
            ),
            400,
        )
        self.assertIn("Password", invalid_register["error"])

        email = f"owner-{self.suffix}@rhinopeak.test"
        registered = self.register_owner(email=email)
        access_token = registered["session"]["accessToken"]
        refresh_token = registered["session"]["refreshToken"]

        duplicate = self.assert_status(
            self.api(
                "POST",
                "/auth/register",
                {
                    "name": "Duplicate Owner",
                    "email": email,
                    "password": "QaPass12345!",
                    "businessName": "Duplicate Business",
                },
            ),
            409,
        )
        self.assertIn("already exists", duplicate["error"])

        invalid_login = self.assert_status(
            self.api("POST", "/auth/login", {"email": email, "password": "WrongPassword123!"}),
            401,
        )
        self.assertIn("Invalid", invalid_login["error"])

        logged_in = self.assert_status(
            self.api("POST", "/auth/login", {"email": email, "password": "QaPass12345!"}),
            200,
        )
        self.assertEqual(logged_in["user"]["role"], "Owner")

        refreshed = self.assert_status(
            self.api("POST", "/auth/refresh", {"refreshToken": refresh_token}),
            200,
        )
        access_token = refreshed["session"]["accessToken"]
        refresh_token = refreshed["session"]["refreshToken"]

        bootstrap = self.assert_status(self.api("GET", "/bootstrap", token=access_token), 200)
        self.assertIn("Owner", [role["name"] for role in bootstrap["bootstrap"]["roleDefinitions"]])

        mobile = self.assert_status(self.api("GET", "/mobile/bootstrap", token=access_token), 200)
        self.assertTrue(mobile["mobile"]["offlineCache"])
        self.assertEqual(mobile["mobile"]["recommendedSyncSeconds"], 30)

        reset_request = self.assert_status(
            self.api("POST", "/auth/password/request", {"email": email}),
            200,
        )
        self.assertTrue(reset_request["ok"])
        self.assertRegex(reset_request["resetToken"], r"^\d{6}$")

        reset = self.assert_status(
            self.api(
                "POST",
                "/auth/password/reset",
                {
                    "email": email,
                    "token": reset_request["resetToken"],
                    "password": "QaPass54321!",
                },
            ),
            200,
        )
        self.assertTrue(reset["ok"])

        revoked = self.assert_status(self.api("GET", "/bootstrap", token=access_token), 401)
        self.assertIn("Invalid", revoked["error"])

        logged_in_after_reset = self.assert_status(
            self.api("POST", "/auth/login", {"email": email, "password": "QaPass54321!"}),
            200,
        )
        access_token = logged_in_after_reset["session"]["accessToken"]
        refresh_token = logged_in_after_reset["session"]["refreshToken"]

        logged_out = self.assert_status(
            self.api("POST", "/auth/logout", {"refreshToken": refresh_token}, token=access_token),
            200,
        )
        self.assertTrue(logged_out["ok"])
        self.assert_status(self.api("GET", "/bootstrap", token=access_token), 401)


class TenantWorkflowApiTests(RhinoPeakApiTestCase):
    def test_mobile_namespace_exposes_crud_and_sync_aliases(self) -> None:
        token = self.auth_token()
        customer_id = f"mobile-cust-{self.suffix}"

        created = self.assert_status(
            self.api(
                "POST",
                "/mobile/customers",
                {
                    "id": customer_id,
                    "name": "Mobile CRUD Customer",
                    "phone": "9800000999",
                    "balance": 100,
                },
                token=token,
            ),
            200,
        )
        self.assertEqual(created["customer"]["id"], customer_id)

        updated = self.assert_status(
            self.api("PATCH", f"/mobile/customers/{customer_id}", {"balance": 250}, token=token),
            200,
        )
        self.assertEqual(updated["customer"]["balance"], 250)

        detail = self.assert_status(
            self.api("GET", f"/mobile/details/customers/{customer_id}", token=token),
            200,
        )["detail"]
        self.assertEqual(detail["record"]["name"], "Mobile CRUD Customer")

        sync = self.assert_status(
            self.api(
                "POST",
                "/mobile/sync/push",
                {
                    "id": f"mobile-sync-{self.suffix}",
                    "operationKey": f"mobile-sync-{self.suffix}",
                    "entity": "customers",
                    "entityId": customer_id,
                    "action": "update",
                    "payload": {"balance": 250},
                },
                token=token,
            ),
            200,
        )
        self.assertEqual(sync["operation"]["status"], "Synced")
        self.assertGreaterEqual(
            len(self.assert_status(self.api("GET", "/mobile/sync/pull", token=token), 200)["bootstrap"]["syncOperations"]),
            1,
        )

        deleted = self.assert_status(self.api("DELETE", f"/mobile/customers/{customer_id}", token=token), 200)
        self.assertTrue(deleted["ok"])

    def test_smart_bill_scanner_upload_parse_and_approve_flow(self) -> None:
        token = self.auth_token()
        raw_text = "\n".join(
            [
                "Himalaya Hotel",
                f"Bill No: HH-{self.suffix}",
                "Date: 2026-05-20",
                "Rice x2 500",
                "Tea 100",
                "VAT 78",
                "Total 678",
                "Cash",
            ]
        )

        uploaded = self.assert_status(
            self.api(
                "POST",
                "/mobile/bill-scans/upload",
                {
                    "sourceType": "manual",
                    "fileName": "sample-bill.txt",
                    "mimeType": "text/plain",
                    "rawText": raw_text,
                },
                token=token,
            ),
            200,
        )
        scan_id = uploaded["billScan"]["id"]
        self.assertEqual(uploaded["billScan"]["status"], "Uploaded")
        self.assertGreaterEqual(len(uploaded["bootstrap"]["billScans"]), 1)

        parsed = self.assert_status(
            self.api("POST", f"/mobile/bill-scans/{scan_id}/parse", {"rawText": raw_text}, token=token),
            200,
        )
        self.assertEqual(parsed["parsed"]["vendorName"], "Himalaya Hotel")
        self.assertEqual(parsed["parsed"]["billNumber"], f"HH-{self.suffix}")
        self.assertEqual(parsed["parsed"]["totalAmount"], 678)
        self.assertGreaterEqual(len(parsed["parsed"]["items"]), 2)

        approved = self.assert_status(
            self.api(
                "POST",
                f"/mobile/bill-scans/{scan_id}/approve",
                {
                    "targetRecordType": "Expense",
                    "approved": parsed["parsed"],
                },
                token=token,
            ),
            200,
        )
        self.assertEqual(approved["billScan"]["status"], "Approved")
        self.assertEqual(approved["target"]["amount"], 678)
        self.assertEqual(approved["document"]["mimeType"], "text/html")
        self.assertEqual(approved["bootstrap"]["expenses"][0]["vendor"], "Himalaya Hotel")
        self.assertEqual(approved["bootstrap"]["billScans"][0]["targetRecordType"], "Expense")

        detail = self.assert_status(self.api("GET", f"/details/bill-scans/{scan_id}", token=token), 200)["detail"]
        self.assertEqual(detail["record"]["id"], scan_id)

    def test_detail_endpoint_returns_record_and_related_rows(self) -> None:
        token = self.auth_token()
        suffix = self.suffix
        product_id = f"prd-detail-{suffix}"
        sale_id = f"sale-detail-{suffix}"

        self.assert_status(
            self.api(
                "POST",
                "/inventory",
                {
                    "id": product_id,
                    "name": "Detail Milk",
                    "category": "Dairy",
                    "unit": "liter",
                    "stock": 20,
                    "reorderLevel": 5,
                    "price": 120,
                    "costPrice": 90,
                },
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
                    "customer": "Detail Customer",
                    "payment": "Cash",
                    "status": "Completed",
                    "date": "2026-05-20",
                    "items": [
                        {
                            "productId": product_id,
                            "productName": "Detail Milk",
                            "quantity": 2,
                            "unit": "liter",
                            "unitPrice": 120,
                            "costPrice": 90,
                            "discount": 0,
                            "tax": 31.2,
                        }
                    ],
                },
                token=token,
            ),
            200,
        )

        sale_detail = self.assert_status(self.api("GET", f"/details/sales/{sale_id}", token=token), 200)["detail"]
        self.assertEqual(sale_detail["record"]["id"], sale_id)
        self.assertIn("journalEntries", sale_detail["related"])
        self.assertIn("inventoryMovements", sale_detail["related"])

        product_detail = self.assert_status(self.api("GET", f"/details/inventory/{product_id}", token=token), 200)["detail"]
        self.assertEqual(product_detail["record"]["id"], product_id)
        self.assertIn("sales", product_detail["related"])

        self.assert_status(self.api("GET", "/details/inventory/missing-product", token=token), 404)

    def test_tenant_crud_workflows_accounting_guards_billing_and_schema(self) -> None:
        token = self.auth_token()
        today = "2026-05-20"
        suffix = self.suffix
        product_id = f"prd-milk-{suffix}"
        customer_id = f"cust-{suffix}"
        party_id = f"party-{suffix}"
        supplier_id = f"sup-{suffix}"
        cash_id = f"cash-{suffix}"
        milk_category = f"QA Dairy {suffix}"
        rent_category = f"QA Rent {suffix}"

        settings = self.assert_status(
            self.api(
                "PATCH",
                "/settings",
                {
                    "businessName": f"QA Mart Updated {suffix}",
                    "language": "ne",
                    "timezone": "Asia/Kathmandu",
                    "taxRate": 13,
                    "invoicePrefix": f"QA{suffix}",
                },
                token=token,
            ),
            200,
        )
        self.assertEqual(settings["settings"]["language"], "ne")

        temp_category = f"QA Temp Category {suffix}"
        temp_category_renamed = f"QA Temp Category Renamed {suffix}"
        self.assertIn(
            temp_category,
            self.assert_status(self.api("POST", "/inventory/categories", {"name": temp_category}, token=token), 200)["categories"],
        )
        self.assertIn(
            temp_category_renamed,
            self.assert_status(
                self.api("PATCH", f"/inventory/categories/{temp_category}", {"name": temp_category_renamed}, token=token),
                200,
            )["categories"],
        )
        deleted_categories = self.assert_status(
            self.api("DELETE", f"/inventory/categories/{temp_category_renamed}", token=token),
            200,
        )
        self.assertNotIn(temp_category_renamed, deleted_categories["categories"])
        self.assertIn(
            milk_category,
            self.assert_status(self.api("POST", "/inventory/categories", {"name": milk_category}, token=token), 200)["categories"],
        )

        supplier = self.assert_status(
            self.api(
                "POST",
                "/suppliers",
                {
                    "id": supplier_id,
                    "name": "QA Dairy Supplier",
                    "phone": "9800000001",
                    "email": f"supplier-{suffix}@rhinopeak.test",
                    "address": "Kathmandu",
                    "pan": "QA-PAN-1",
                    "contactPerson": "QA Supplier",
                    "payableBalance": 0,
                    "notes": "QA supplier",
                },
                token=token,
            ),
            200,
        )
        self.assertEqual(supplier["supplier"]["id"], supplier_id)
        patched_supplier = self.assert_status(
            self.api("PATCH", f"/suppliers/{supplier_id}", {"phone": "9800000002"}, token=token),
            200,
        )
        self.assertEqual(patched_supplier["supplier"]["phone"], "9800000002")
        delete_supplier_id = f"sup-delete-{suffix}"
        self.assert_status(
            self.api("POST", "/suppliers", {"id": delete_supplier_id, "name": "Delete Supplier"}, token=token),
            200,
        )
        self.assertTrue(
            self.assert_status(self.api("DELETE", f"/suppliers/{delete_supplier_id}", token=token), 200)["ok"]
        )

        product = self.assert_status(
            self.api(
                "POST",
                "/inventory",
                {
                    "id": product_id,
                    "name": "QA Test Milk",
                    "description": "Milk measured in liters",
                    "sku": f"MILK-{suffix}",
                    "barcode": f"QAMILK{suffix}",
                    "brand": "QA Dairy",
                    "category": milk_category,
                    "unit": "liter",
                    "stock": 50,
                    "reorderLevel": 5,
                    "price": 130,
                    "costPrice": 95,
                    "taxRate": 13,
                    "supplier": "QA Dairy Supplier",
                    "location": "Cold shelf",
                    "active": True,
                },
                token=token,
            ),
            200,
        )
        self.assertEqual(product["product"]["unit"], "liter")
        self.assertEqual(
            self.assert_status(self.api("PATCH", f"/inventory/{product_id}", {"price": 135}, token=token), 200)["record"]["price"],
            135,
        )
        delete_product_id = f"prd-delete-{suffix}"
        self.assert_status(
            self.api("POST", "/inventory", {"id": delete_product_id, "name": "Delete Product", "stock": 1, "reorderLevel": 1}, token=token),
            200,
        )
        self.assertTrue(self.assert_status(self.api("DELETE", f"/inventory/{delete_product_id}", token=token), 200)["ok"])

        movement_id = f"mov-{suffix}"
        movement = self.assert_status(
            self.api(
                "POST",
                "/inventory/movements",
                {"id": movement_id, "productId": product_id, "delta": 10, "reason": "Stock In", "note": "QA refill"},
                token=token,
            ),
            200,
        )
        self.assertEqual(movement["movement"]["delta"], 10)
        self.assertEqual(
            self.assert_status(self.api("PATCH", f"/inventory-movements/{movement_id}", {"note": "QA refill updated"}, token=token), 200)["record"]["note"],
            "QA refill updated",
        )
        delete_movement_id = f"mov-delete-{suffix}"
        self.assert_status(
            self.api(
                "POST",
                "/inventory/movements",
                {"id": delete_movement_id, "productId": product_id, "delta": 1, "reason": "Correction", "note": "Delete movement"},
                token=token,
            ),
            200,
        )
        self.assertTrue(self.assert_status(self.api("DELETE", f"/inventory-movements/{delete_movement_id}", token=token), 200)["ok"])
        self.assert_status(self.api("DELETE", f"/inventory/categories/{milk_category}", token=token), 409)

        customer = self.assert_status(
            self.api(
                "POST",
                "/customers",
                {
                    "id": customer_id,
                    "name": "QA Credit Customer",
                    "company": "QA Shop",
                    "email": f"customer-{suffix}@rhinopeak.test",
                    "phone": "9800000003",
                    "address": "Lalitpur",
                    "source": "QA",
                    "taxId": "QA-CUST-PAN",
                    "tags": ["qa", "credit"],
                    "creditLimit": 10000,
                    "balance": 0,
                    "preferredLanguage": "ne",
                },
                token=token,
            ),
            200,
        )
        self.assertEqual(customer["customer"]["preferredLanguage"], "ne")
        self.assertEqual(
            self.assert_status(self.api("PATCH", f"/customers/{customer_id}", {"segment": "Regular"}, token=token), 200)["customer"]["segment"],
            "Regular",
        )
        delete_customer_id = f"cust-delete-{suffix}"
        self.assert_status(self.api("POST", "/customers", {"id": delete_customer_id, "name": "Delete Customer"}, token=token), 200)
        self.assertTrue(self.assert_status(self.api("DELETE", f"/customers/{delete_customer_id}", token=token), 200)["ok"])
        credit = self.assert_status(
            self.api(
                "POST",
                "/credit-ledger",
                {
                    "id": f"crd-{suffix}",
                    "customerId": customer_id,
                    "customerName": "QA Credit Customer",
                    "type": "Credit Sale",
                    "amount": 500,
                    "date": today,
                    "dueDate": today,
                    "paymentMethod": "Credit",
                    "note": "QA credit",
                },
                token=token,
            ),
            200,
        )
        self.assertEqual(credit["entry"]["amount"], 500)
        self.assertEqual(
            self.assert_status(self.api("PATCH", f"/credit-ledger/crd-{suffix}", {"note": "QA credit updated"}, token=token), 200)["record"]["note"],
            "QA credit updated",
        )

        party = self.assert_status(
            self.api(
                "POST",
                "/parties",
                {
                    "id": party_id,
                    "name": "QA Wholesale Party",
                    "type": "Customer",
                    "phone": "9800000004",
                    "email": f"party-{suffix}@rhinopeak.test",
                    "address": "Bhaktapur",
                    "pan": "QA-PARTY-PAN",
                    "openingBalance": 0,
                    "creditLimit": 15000,
                    "dueDays": 15,
                    "notes": "QA party",
                },
                token=token,
            ),
            200,
        )
        self.assertEqual(party["party"]["id"], party_id)
        self.assertEqual(
            self.assert_status(self.api("PATCH", f"/parties/{party_id}", {"dueDays": 20}, token=token), 200)["party"]["dueDays"],
            20,
        )
        party_ledger = self.assert_status(
            self.api(
                "POST",
                "/party-ledger",
                {
                    "id": f"plg-{suffix}",
                    "partyId": party_id,
                    "partyName": "QA Wholesale Party",
                    "direction": "Receivable",
                    "type": "Sale Credit",
                    "amount": 1200,
                    "date": today,
                    "dueDate": today,
                    "note": "QA ledger",
                },
                token=token,
            ),
            200,
        )
        self.assertEqual(party_ledger["entry"]["partyId"], party_id)
        delete_party_id = f"party-delete-{suffix}"
        self.assert_status(self.api("POST", "/parties", {"id": delete_party_id, "name": "Delete Party"}, token=token), 200)
        self.assertTrue(self.assert_status(self.api("DELETE", f"/parties/{delete_party_id}", token=token), 200)["ok"])

        cash = self.assert_status(
            self.api(
                "POST",
                "/cash-bank-accounts",
                {
                    "id": cash_id,
                    "name": "QA Cash Box",
                    "type": "Cash",
                    "institution": "Counter",
                    "accountNumber": "",
                    "openingBalance": 5000,
                    "balance": 5000,
                    "active": True,
                },
                token=token,
            ),
            200,
        )
        self.assertEqual(cash["account"]["id"], cash_id)
        self.assertEqual(
            self.assert_status(
                self.api("PATCH", f"/cash-bank-accounts/{cash_id}", {"institution": "Main counter"}, token=token),
                200,
            )["account"]["institution"],
            "Main counter",
        )
        money_movement_id = f"movm-{suffix}"
        self.assert_status(
            self.api(
                "POST",
                "/money-movements",
                {
                    "id": money_movement_id,
                    "accountId": cash_id,
                    "accountName": "QA Cash Box",
                    "type": "Receipt",
                    "amount": 1000,
                    "date": today,
                    "partyId": party_id,
                    "partyName": "QA Wholesale Party",
                    "referenceId": "QA-Receipt",
                    "note": "QA receipt",
                },
                token=token,
            ),
            200,
        )
        self.assertEqual(
            self.assert_status(self.api("PATCH", f"/money-movements/{money_movement_id}", {"note": "QA receipt updated"}, token=token), 200)["record"]["note"],
            "QA receipt updated",
        )
        self.assert_status(self.api("DELETE", f"/cash-bank-accounts/{cash_id}", token=token), 409)
        empty_cash_id = f"cash-empty-{suffix}"
        self.assert_status(self.api("POST", "/cash-bank-accounts", {"id": empty_cash_id, "name": "Empty Bank"}, token=token), 200)
        self.assertTrue(self.assert_status(self.api("DELETE", f"/cash-bank-accounts/{empty_cash_id}", token=token), 200)["ok"])

        purchase = self.assert_status(
            self.api(
                "POST",
                "/purchases",
                {
                    "id": f"pur-{suffix}",
                    "supplierId": supplier_id,
                    "supplierName": "QA Dairy Supplier",
                    "billNo": f"PB-QA-{suffix}",
                    "date": today,
                    "dueDate": today,
                    "items": [
                        {
                            "productId": product_id,
                            "productName": "QA Test Milk",
                            "quantity": 4,
                            "unit": "liter",
                            "unitCost": 95,
                            "discount": 0,
                            "tax": 49.4,
                        }
                    ],
                    "subtotal": 380,
                    "discountTotal": 0,
                    "taxTotal": 49.4,
                    "amount": 429.4,
                    "payment": "Credit",
                    "status": "Received",
                    "notes": "QA purchase",
                    "attachmentIds": [],
                },
                token=token,
            ),
            200,
        )
        self.assertGreaterEqual(len(purchase["bootstrap"]["journalEntries"]), 1)
        self.assertEqual(
            self.assert_status(
                self.api("PATCH", f"/purchases/pur-{suffix}", {"notes": "QA purchase updated"}, token=token),
                200,
            )["purchase"]["notes"],
            "QA purchase updated",
        )

        temp_expense_category = f"QA Temp Expense {suffix}"
        renamed_expense_category = f"QA Temp Expense Renamed {suffix}"
        self.assertIn(
            temp_expense_category,
            self.assert_status(self.api("POST", "/expenses/categories", {"name": temp_expense_category}, token=token), 200)["categories"],
        )
        self.assertIn(
            renamed_expense_category,
            self.assert_status(
                self.api("PATCH", f"/expenses/categories/{temp_expense_category}", {"name": renamed_expense_category}, token=token),
                200,
            )["categories"],
        )
        self.assertNotIn(
            renamed_expense_category,
            self.assert_status(self.api("DELETE", f"/expenses/categories/{renamed_expense_category}", token=token), 200)["categories"],
        )
        self.assertIn(
            rent_category,
            self.assert_status(self.api("POST", "/expenses/categories", {"name": rent_category}, token=token), 200)["categories"],
        )
        expense = self.assert_status(
            self.api(
                "POST",
                "/expenses",
                {
                    "id": f"exp-{suffix}",
                    "category": rent_category,
                    "vendor": "QA Landlord",
                    "amount": 1130,
                    "taxAmount": 130,
                    "paymentAccountId": cash_id,
                    "paymentMethod": "Cash",
                    "date": today,
                    "recurring": False,
                    "note": "QA rent expense",
                    "attachmentIds": [],
                },
                token=token,
            ),
            200,
        )
        self.assertEqual(expense["expense"]["amount"], 1130)
        self.assertEqual(
            self.assert_status(self.api("PATCH", f"/expenses/exp-{suffix}", {"note": "QA rent expense updated"}, token=token), 200)["expense"]["note"],
            "QA rent expense updated",
        )
        self.assert_status(self.api("DELETE", f"/expenses/categories/{rent_category}", token=token), 409)

        sale = self.assert_status(
            self.api(
                "POST",
                "/sales",
                {
                    "id": f"sale-{suffix}",
                    "invoiceNo": f"RP-QA-{suffix}",
                    "customerId": customer_id,
                    "customer": "QA Credit Customer",
                    "payment": "Credit",
                    "status": "Completed",
                    "date": today,
                    "creditDueDate": today,
                    "notes": "QA credit sale",
                    "items": [
                        {
                            "productId": product_id,
                            "productName": "QA Test Milk",
                            "quantity": 2,
                            "unit": "liter",
                            "unitPrice": 130,
                            "costPrice": 95,
                            "discount": 0,
                            "tax": 33.8,
                        }
                    ],
                },
                token=token,
            ),
            200,
        )
        self.assertEqual(sale["sale"]["amount"], 293.8)
        self.assertEqual(
            self.assert_status(self.api("PATCH", f"/sales/sale-{suffix}", {"notes": "QA sale updated"}, token=token), 200)["sale"]["notes"],
            "QA sale updated",
        )
        self.assertTrue(self.assert_status(self.api("DELETE", f"/sales/sale-{suffix}", token=token), 200)["ok"])

        document = self.assert_status(
            self.api(
                "POST",
                "/documents",
                {
                    "id": f"doc-{suffix}",
                    "name": "QA Invoice Copy",
                    "recordType": "sales",
                    "recordId": f"sale-{suffix}",
                    "fileName": "qa-invoice.html",
                    "mimeType": "text/html",
                    "size": 128,
                    "dataUrl": "data:text/html;base64,PGRpdi8+",
                },
                token=token,
            ),
            200,
        )
        self.assertEqual(document["document"]["fileName"], "qa-invoice.html")
        self.assertEqual(
            self.assert_status(self.api("PATCH", f"/documents/doc-{suffix}", {"name": "QA Invoice Updated"}, token=token), 200)["record"]["name"],
            "QA Invoice Updated",
        )
        self.assertTrue(self.assert_status(self.api("DELETE", f"/documents/doc-{suffix}", token=token), 200)["ok"])

        reminder_template = self.assert_status(
            self.api(
                "POST",
                "/reminder-templates",
                {
                    "id": f"rmt-{suffix}",
                    "name": "QA Nepali Credit Reminder",
                    "channel": "SMS",
                    "language": "ne",
                    "message": "\u0915\u0943\u092a\u092f\u093e \u092c\u093e\u0901\u0915\u0940 \u0930\u0915\u092e \u0924\u093f\u0930\u094d\u0928\u0941\u0939\u094b\u0938\u094d\u0964",
                    "daysOffset": 0,
                    "active": True,
                },
                token=token,
            ),
            200,
        )
        self.assertEqual(reminder_template["template"]["language"], "ne")
        self.assertEqual(
            self.assert_status(self.api("PATCH", f"/reminder-templates/rmt-{suffix}", {"active": False}, token=token), 200)["record"]["active"],
            False,
        )
        self.assertEqual(
            self.assert_status(
                self.api(
                    "POST",
                    "/reminders",
                    {
                        "id": f"rml-{suffix}",
                        "partyId": party_id,
                        "partyName": "QA Wholesale Party",
                        "channel": "SMS",
                        "message": "QA reminder",
                        "amount": 1200,
                        "dueDate": today,
                        "status": "Sent",
                    },
                    token=token,
                ),
                200,
            )["log"]["status"],
            "Sent",
        )
        self.assertEqual(
            self.assert_status(self.api("PATCH", f"/reminders/rml-{suffix}", {"status": "Draft"}, token=token), 200)["record"]["status"],
            "Draft",
        )

        sync = self.assert_status(
            self.api(
                "POST",
                "/sync/push",
                {
                    "id": f"syn-{suffix}",
                    "operationKey": f"qa-sync-{suffix}",
                    "entity": "inventory",
                    "entityId": product_id,
                    "action": "update",
                    "payload": {"note": "QA sync"},
                },
                token=token,
            ),
            200,
        )
        self.assertEqual(sync["operation"]["status"], "Synced")
        self.assertEqual(
            self.assert_status(self.api("PATCH", f"/sync-operations/syn-{suffix}", {"status": "Pending"}, token=token), 200)["record"]["status"],
            "Pending",
        )
        self.assertGreaterEqual(
            len(self.assert_status(self.api("GET", "/sync/pull", token=token), 200)["bootstrap"]["syncOperations"]),
            1,
        )

        report = self.assert_status(
            self.api(
                "POST",
                "/reports",
                {
                    "id": f"rpt-{suffix}",
                    "title": "QA Monthly Summary",
                    "type": "Sales",
                    "template": "Executive",
                    "range": "Today",
                    "status": "Ready",
                    "format": "HTML",
                    "downloadUrl": "",
                    "scheduledAt": "",
                },
                token=token,
            ),
            200,
        )
        self.assertEqual(report["report"]["format"], "HTML")
        self.assertEqual(
            self.assert_status(self.api("PATCH", f"/reports/rpt-{suffix}", {"status": "Scheduled"}, token=token), 200)["record"]["status"],
            "Scheduled",
        )
        self.assertTrue(self.assert_status(self.api("DELETE", f"/reports/rpt-{suffix}", token=token), 200)["ok"])

        billing = self.assert_status(
            self.api(
                "PATCH",
                "/billing/plan",
                {
                    "plan": "pro",
                    "billingCycle": "monthly",
                    "record": {
                        "id": f"bill-{suffix}",
                        "description": "QA Pro upgrade",
                        "gateway": "eSewa",
                        "plan": "pro",
                        "billingCycle": "monthly",
                        "amount": 1499,
                        "currency": "NPR",
                        "invoiceNo": f"BILL-QA-{suffix}",
                        "date": today,
                        "paidAt": today,
                        "status": "Paid",
                    },
                },
                token=token,
            ),
            200,
        )
        self.assertEqual(billing["bootstrap"]["plan"], "pro")
        self.assert_status(self.api("PATCH", "/billing/plan", {"plan": "enterprise", "billingCycle": "monthly"}, token=token), 400)

        final_schema = self.assert_status(self.api("GET", "/schema/audit"), 200)
        self.assertEqual(final_schema["missingCollectionCount"], 0)
        self.assertEqual(final_schema["missingFieldCount"], 0)


class RbacAndTenantIsolationTests(RhinoPeakApiTestCase):
    def test_custom_roles_permission_enforcement_and_tenant_isolation(self) -> None:
        first = self.register_owner(email=f"tenant-a-{self.suffix}@rhinopeak.test", business_name="Tenant A")
        owner_token = first["session"]["accessToken"]
        suffix = self.suffix
        customer_id = f"cust-isolated-{suffix}"
        sale_id = f"sale-isolated-{suffix}"

        self.assert_status(
            self.api("POST", "/customers", {"id": customer_id, "name": "Tenant A Customer"}, token=owner_token),
            200,
        )
        self.assert_status(
            self.api(
                "POST",
                "/sales",
                {
                    "id": sale_id,
                    "customerId": customer_id,
                    "customer": "Tenant A Customer",
                    "items": [{"productName": "Service", "quantity": 1, "unitPrice": 100, "tax": 13}],
                },
                token=owner_token,
            ),
            200,
        )

        role_id = f"role-limited-{suffix}"
        role = self.assert_status(
            self.api(
                "POST",
                "/roles",
                {
                    "id": role_id,
                    "name": f"QA Limited {suffix}",
                    "description": "Can only view dashboard.",
                    "permissions": ["dashboard.view"],
                },
                token=owner_token,
            ),
            200,
        )
        self.assertEqual(role["role"]["id"], role_id)

        updated_role_name = f"QA Limited Updated {suffix}"
        self.assertEqual(
            self.assert_status(
                self.api("PATCH", f"/roles/{role_id}", {"name": updated_role_name, "permissions": ["dashboard.view"]}, token=owner_token),
                200,
            )["role"]["name"],
            updated_role_name,
        )

        invited_id = f"usr-limited-{suffix}"
        invited = self.assert_status(
            self.api(
                "POST",
                "/users/invite",
                {
                    "id": invited_id,
                    "name": "Limited User",
                    "email": f"limited-{suffix}@rhinopeak.test",
                    "role": updated_role_name,
                },
                token=owner_token,
            ),
            200,
        )
        self.assertEqual(invited["user"]["status"], "Invited")

        salt, digest = hash_password("QaPass12345!")
        collection("users").update_one(
            {"id": invited_id},
            {"$set": {"passwordSalt": salt, "passwordHash": digest, "status": "Active"}},
        )
        limited_login = self.assert_status(
            self.api("POST", "/auth/login", {"email": f"limited-{suffix}@rhinopeak.test", "password": "QaPass12345!"}),
            200,
        )
        limited_token = limited_login["session"]["accessToken"]

        forbidden = self.assert_status(
            self.api(
                "POST",
                "/inventory",
                {"id": f"forbidden-product-{suffix}", "name": "Forbidden Product"},
                token=limited_token,
            ),
            403,
        )
        self.assertIn("inventory.manage", forbidden["error"])

        self.assertEqual(
            self.assert_status(
                self.api("PATCH", f"/users/{invited_id}/role", {"role": "Staff"}, token=owner_token),
                200,
            )["user"]["role"],
            "Staff",
        )
        self.assertTrue(self.assert_status(self.api("DELETE", f"/roles/{role_id}", token=owner_token), 200)["ok"])

        second = self.register_owner(email=f"tenant-b-{suffix}@rhinopeak.test", business_name="Tenant B")
        second_token = second["session"]["accessToken"]
        self.assert_status(
            self.api("PATCH", f"/customers/{customer_id}", {"name": "Cross Tenant Edit"}, token=second_token),
            404,
        )
        self.assert_status(self.api("DELETE", f"/sales/{sale_id}", token=second_token), 404)


class PlatformOwnerApiTests(RhinoPeakApiTestCase):
    def test_platform_owner_crud_for_admins_tenants_flags_tickets_and_sessions(self) -> None:
        suffix = self.suffix
        invalid_setup = self.assert_status(
            self.api(
                "POST",
                "/platform/auth/setup-owner",
                {
                    "setupToken": "wrong-token",
                    "name": "Platform Owner",
                    "email": f"platform-owner-{suffix}@rhinopeak.test",
                    "password": "Platform12345!",
                },
            ),
            403,
        )
        self.assertIn("Invalid", invalid_setup["error"])

        owner_email = f"platform-owner-{suffix}@rhinopeak.test"
        setup = self.assert_status(
            self.api(
                "POST",
                "/platform/auth/setup-owner",
                {
                    "setupToken": self.platform_setup_token,
                    "name": "Platform Owner",
                    "email": owner_email,
                    "password": "Platform12345!",
                },
            ),
            200,
        )
        owner_token = setup["session"]["accessToken"]
        self.assertEqual(setup["bootstrap"]["admin"]["role"], "Platform Owner")
        self.assertTrue(self.assert_status(self.api("GET", "/platform/auth/state"), 200)["ownerExists"])
        self.assert_status(
            self.api(
                "POST",
                "/platform/auth/setup-owner",
                {
                    "setupToken": self.platform_setup_token,
                    "name": "Second Owner",
                    "email": f"second-owner-{suffix}@rhinopeak.test",
                    "password": "Platform12345!",
                },
            ),
            409,
        )
        self.assert_status(
            self.api("POST", "/platform/auth/login", {"email": owner_email, "password": "bad-password"}),
            401,
        )

        login = self.assert_status(
            self.api("POST", "/platform/auth/login", {"email": owner_email, "password": "Platform12345!"}),
            200,
        )
        owner_token = login["session"]["accessToken"]

        admin = self.assert_status(
            self.api(
                "POST",
                "/platform/admins",
                {
                    "name": "QA Super Admin",
                    "email": f"platform-admin-{suffix}@rhinopeak.test",
                    "password": "Temporary12345!",
                    "role": "Super Admin",
                },
                token=owner_token,
            ),
            200,
        )
        admin_id = admin["admin"]["id"]
        self.assertEqual(admin["admin"]["role"], "Super Admin")
        patched_admin = self.assert_status(
            self.api("PATCH", f"/platform/admins/{admin_id}", {"role": "Support Admin", "status": "Active"}, token=owner_token),
            200,
        )
        self.assertEqual(patched_admin["admin"]["role"], "Support Admin")

        org = self.assert_status(
            self.api(
                "POST",
                "/platform/organizations",
                {
                    "businessName": f"QA Platform Tenant {suffix}",
                    "ownerName": "Tenant Owner",
                    "ownerEmail": f"platform-tenant-{suffix}@rhinopeak.test",
                    "password": "TenantPass12345!",
                    "plan": "pro",
                    "status": "Trial",
                    "category": "Retail",
                    "address": "Kathmandu",
                },
                token=owner_token,
            ),
            200,
        )
        org_id = org["organization"]["id"]
        self.assertEqual(org["organization"]["plan"], "pro")
        expired = self.assert_status(
            self.api("PATCH", f"/platform/organizations/{org_id}", {"status": "Expired"}, token=owner_token),
            200,
        )
        self.assertEqual(expired["organization"]["subscriptionStatus"], "expired")

        flag = self.assert_status(
            self.api(
                "POST",
                "/platform/feature-flags",
                {
                    "name": f"QA Flag {suffix}",
                    "description": "QA rollout",
                    "area": "Platform",
                    "enabled": False,
                    "rollout": 10,
                    "risk": "Low",
                },
                token=owner_token,
            ),
            200,
        )
        flag_id = flag["featureFlag"]["id"]
        patched_flag = self.assert_status(
            self.api("PATCH", f"/platform/feature-flags/{flag_id}", {"enabled": True, "rollout": 80}, token=owner_token),
            200,
        )
        self.assertTrue(patched_flag["featureFlag"]["enabled"])
        self.assertTrue(self.assert_status(self.api("DELETE", f"/platform/feature-flags/{flag_id}", token=owner_token), 200)["ok"])

        ticket = self.assert_status(
            self.api(
                "POST",
                "/platform/support-tickets",
                {"orgId": org_id, "subject": "QA support case", "priority": "High"},
                token=owner_token,
            ),
            200,
        )
        ticket_id = ticket["supportTicket"]["id"]
        patched_ticket = self.assert_status(
            self.api("PATCH", f"/platform/support-tickets/{ticket_id}", {"status": "Resolved"}, token=owner_token),
            200,
        )
        self.assertEqual(patched_ticket["supportTicket"]["status"], "Resolved")
        self.assertTrue(self.assert_status(self.api("DELETE", f"/platform/support-tickets/{ticket_id}", token=owner_token), 200)["ok"])

        bootstrap = self.assert_status(self.api("GET", "/platform/bootstrap", token=owner_token), 200)
        self.assertGreaterEqual(bootstrap["bootstrap"]["metrics"]["expiredTenants"], 1)
        self.assertGreaterEqual(len(bootstrap["bootstrap"]["securitySessions"]), 1)

        self.assertTrue(self.assert_status(self.api("DELETE", f"/platform/admins/{admin_id}", token=owner_token), 200)["ok"])
        self.assertTrue(self.assert_status(self.api("DELETE", f"/platform/organizations/{org_id}", token=owner_token), 200)["ok"])

        session_ids = {session["id"] for session in bootstrap["bootstrap"]["securitySessions"]}
        session_id = hash_token(owner_token)
        self.assertIn(session_id, session_ids)
        self.assertTrue(self.assert_status(self.api("PATCH", f"/platform/sessions/{session_id}", {}, token=owner_token), 200)["ok"])
        self.assert_status(self.api("GET", "/platform/bootstrap", token=owner_token), 401)
