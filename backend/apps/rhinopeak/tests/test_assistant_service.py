from __future__ import annotations

from django.test import SimpleTestCase

from apps.rhinopeak.services.assistant_service import parse_assistant_command
from apps.rhinopeak.tests.test_api import RhinoPeakApiTestCase


class AssistantCommandParserTests(SimpleTestCase):
    def test_known_voice_commands_map_to_expected_intents(self) -> None:
        cases = [
            ("scan this VAT bill", "scan_bill"),
            ("add expense NPR 500 rent paid cash", "add_expense"),
            ("खर्च ५०० भाडा नगद", "add_expense"),
            ("add customer Maya Store phone 9803333333", "add_customer"),
            ("ग्राहक थप राम पसल 9801111111", "add_customer"),
            ("add supplier Himal Dairy Suppliers 9811111111", "add_supplier"),
            ("add product milk 20 liter", "add_product"),
            ("record sale NPR 1200 to Hari Cafe cash", "record_sale"),
            ("payment received NPR 2500 from Maya Store", "record_payment"),
            ("create report for this month", "create_report"),
        ]

        for transcript, intent in cases:
            with self.subTest(transcript=transcript):
                command = parse_assistant_command({"transcript": transcript})
                self.assertEqual(command["intent"], intent)
                self.assertGreaterEqual(command["confidence"], 0.7)

    def test_unknown_command_stays_low_confidence_and_non_executable(self) -> None:
        command = parse_assistant_command({"transcript": "please make everything perfect"})

        self.assertEqual(command["intent"], "unknown")
        self.assertLess(command["confidence"], 0.5)
        self.assertFalse(command["canExecute"])
        self.assertTrue(command["warnings"])

    def test_business_questions_are_read_only_answers(self) -> None:
        for transcript in ["What is my total sale?", "Miro total sale kothiyo."]:
            with self.subTest(transcript=transcript):
                command = parse_assistant_command({"transcript": transcript})

                self.assertEqual(command["intent"], "business_question")
                self.assertEqual(command["slots"]["questionType"], "sales_total")
                self.assertFalse(command["requiresConfirmation"])
                self.assertFalse(command["canExecute"])
                self.assertFalse(command["warnings"])

    def test_nepali_digits_are_normalized_for_amount_detection(self) -> None:
        command = parse_assistant_command({"transcript": "खर्च रु १२३४ ढुवानी"})

        self.assertEqual(command["intent"], "add_expense")
        self.assertEqual(command["slots"]["amount"], 1234)
        self.assertEqual(command["language"], "ne")


class AssistantCommandApiTests(RhinoPeakApiTestCase):
    def test_parse_command_requires_login(self) -> None:
        response = self.api("POST", "/assistant/command", {"transcript": "add customer Test"})
        self.assert_status(response, 401)

    def test_business_question_returns_saved_sales_total(self) -> None:
        token = self.auth_token()
        for sale_id, amount in [("assistant-sale-1", 1200), ("assistant-sale-2", 800)]:
            self.assert_status(
                self.api(
                    "POST",
                    "/sales",
                    {
                        "id": f"{sale_id}-{self.suffix}",
                        "customer": "Assistant QA Customer",
                        "status": "Completed",
                        "items": [{"productName": "QA Item", "quantity": 1, "unitPrice": amount, "tax": 0}],
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
                    "id": f"assistant-refund-{self.suffix}",
                    "customer": "Assistant QA Customer",
                    "status": "Refunded",
                    "items": [{"productName": "Refunded Item", "quantity": 1, "unitPrice": 999, "tax": 0}],
                },
                token=token,
            ),
            200,
        )

        for transcript in ["What is my total sale?", "Miro total sale kothiyo."]:
            with self.subTest(transcript=transcript):
                command = self.assert_status(
                    self.api("POST", "/assistant/command", {"transcript": transcript}, token=token),
                    200,
                )["assistantCommand"]

                self.assertEqual(command["intent"], "business_question")
                self.assertEqual(command["executionStatus"], "Answered")
                self.assertEqual(command["slots"]["salesTotal"], 2000)
                self.assertEqual(command["slots"]["salesCount"], 2)
                self.assertIn("NPR 2,000", command["reply"])

    def test_confirmed_customer_command_creates_customer(self) -> None:
        token = self.auth_token()
        draft = self.assert_status(
            self.api("POST", "/assistant/command", {"transcript": "add customer Maya Store 9803333333"}, token=token),
            200,
        )["assistantCommand"]

        self.assertEqual(draft["intent"], "add_customer")
        self.assertTrue(draft["canExecute"])
        self.assertEqual(draft["executionStatus"], "Draft")

        executed = self.assert_status(
            self.api(
                "POST",
                "/assistant/command",
                {"transcript": "add customer Maya Store 9803333333", "confirm": True},
                token=token,
            ),
            200,
        )

        command = executed["assistantCommand"]
        self.assertEqual(command["executionStatus"], "Executed")
        self.assertEqual(command["result"]["customer"]["name"], "Maya Store")
        self.assertTrue(any(customer["name"] == "Maya Store" for customer in executed["bootstrap"]["customers"]))

    def test_confirmed_expense_command_creates_expense(self) -> None:
        token = self.auth_token()
        executed = self.assert_status(
            self.api(
                "POST",
                "/assistant/command",
                {"transcript": "add expense NPR 1200 rent paid cash", "confirm": True},
                token=token,
            ),
            200,
        )

        expense = executed["assistantCommand"]["result"]["expense"]
        self.assertEqual(expense["category"], "Rent")
        self.assertEqual(expense["amount"], 1200)
        self.assertTrue(any(item["amount"] == 1200 for item in executed["bootstrap"]["expenses"]))

    def test_incomplete_confirmed_command_is_rejected(self) -> None:
        token = self.auth_token()
        response = self.api("POST", "/assistant/command", {"transcript": "add expense for rent", "confirm": True}, token=token)

        error = self.assert_status(response, 400)
        self.assertIn("Amount is required", error["error"])
