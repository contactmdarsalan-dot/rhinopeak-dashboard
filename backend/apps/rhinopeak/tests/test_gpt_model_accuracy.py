from __future__ import annotations

from django.test import SimpleTestCase

from apps.rhinopeak.services.gpt_model import structure_ocr_text


class GptBillStructuringAccuracyTests(SimpleTestCase):
    def test_structured_bill_extraction_accuracy_on_controlled_ocr_samples(self) -> None:
        nepali_vendor = "\u0930\u093e\u092e \u0921\u0947\u0930\u0940 \u092a\u0938\u0932"
        cases = [
            {
                "name": "simple hotel bill",
                "raw": "\n".join(
                    [
                        "Himalaya Hotel",
                        "Bill No: HH-1001",
                        "Date: 2026-05-20",
                        "Rice x2 500",
                        "Tea 100",
                        "VAT 78",
                        "Total 678",
                        "Cash",
                    ]
                ),
                "expected": {
                    "vendorName": "Himalaya Hotel",
                    "billNumber": "HH-1001",
                    "billDate": "2026-05-20",
                    "paymentMethod": "Cash",
                    "subtotal": 600.0,
                    "vatAmount": 78.0,
                    "discountAmount": 0.0,
                    "totalAmount": 678.0,
                    "items": [
                        {"name": "Rice", "quantity": 2.0, "lineTotal": 500.0},
                        {"name": "Tea", "quantity": 1.0, "lineTotal": 100.0},
                    ],
                },
            },
            {
                "name": "mart bill with discount and wallet payment",
                "raw": "\n".join(
                    [
                        "City Mart NPR",
                        "Invoice No: CM-778",
                        "Date: 2026/05/21",
                        "Rice 5kg 1 x 800.00 800.00",
                        "Oil 1 liter 2 x 250.00 500.00",
                        "Subtotal 1300",
                        "Discount 100",
                        "VAT 156",
                        "Grand Total 1356",
                        "eSewa",
                    ]
                ),
                "expected": {
                    "vendorName": "City Mart NPR",
                    "billNumber": "CM-778",
                    "billDate": "2026-05-21",
                    "paymentMethod": "eSewa",
                    "subtotal": 1300.0,
                    "vatAmount": 156.0,
                    "discountAmount": 100.0,
                    "totalAmount": 1356.0,
                    "items": [
                        {"name": "Rice", "quantity": 1.0, "lineTotal": 800.0},
                        {"name": "Oil", "quantity": 2.0, "lineTotal": 500.0},
                    ],
                },
            },
            {
                "name": "rent receipt with bank payment",
                "raw": "\n".join(
                    [
                        "Office Rent Receipt",
                        "Receipt No: RENT-9",
                        "Date: 21/05/2026",
                        "Rent Payment 1 x 15000 15000",
                        "Total Amount 15000",
                        "Payment Mode Bank",
                    ]
                ),
                "expected": {
                    "vendorName": "Office Rent Receipt",
                    "billNumber": "RENT-9",
                    "billDate": "2026-05-21",
                    "paymentMethod": "Bank",
                    "subtotal": 15000.0,
                    "vatAmount": 0.0,
                    "discountAmount": 0.0,
                    "totalAmount": 15000.0,
                    "items": [
                        {"name": "Rent Payment", "quantity": 1.0, "lineTotal": 15000.0},
                    ],
                },
            },
            {
                "name": "nepali vendor with liter and kg units",
                "raw": "\n".join(
                    [
                        nepali_vendor,
                        "Bill No: RD-12",
                        "Date: 2026-05-22",
                        "Milk 2 liter 240",
                        "Curd 1 kg 180",
                        "Total 420",
                        "Cash",
                    ]
                ),
                "expected": {
                    "vendorName": nepali_vendor,
                    "billNumber": "RD-12",
                    "billDate": "2026-05-22",
                    "paymentMethod": "Cash",
                    "subtotal": 420.0,
                    "vatAmount": 0.0,
                    "discountAmount": 0.0,
                    "totalAmount": 420.0,
                    "items": [
                        {"name": "Milk", "quantity": 2.0, "lineTotal": 240.0},
                        {"name": "Curd", "quantity": 1.0, "lineTotal": 180.0},
                    ],
                },
            },
        ]

        field_total = field_pass = item_total = item_pass = 0
        for case in cases:
            parsed = structure_ocr_text(case["raw"])
            expected = case["expected"]

            for field in (
                "vendorName",
                "billNumber",
                "billDate",
                "paymentMethod",
                "subtotal",
                "vatAmount",
                "discountAmount",
                "totalAmount",
            ):
                field_total += 1
                if self._matches(parsed.get(field), expected[field]):
                    field_pass += 1

            for index, item in enumerate(expected["items"]):
                for field in ("name", "quantity", "lineTotal"):
                    item_total += 1
                    actual = parsed["items"][index].get(field) if index < len(parsed["items"]) else None
                    if self._matches(actual, item[field]):
                        item_pass += 1

        overall_pass = field_pass + item_pass
        overall_total = field_total + item_total
        self.assertGreaterEqual(field_pass / field_total, 0.95)
        self.assertGreaterEqual(item_pass / item_total, 0.95)
        self.assertGreaterEqual(overall_pass / overall_total, 0.95)

    @staticmethod
    def _matches(actual: object, expected: object) -> bool:
        if isinstance(expected, float):
            try:
                return abs(float(actual) - expected) <= 0.01
            except (TypeError, ValueError):
                return False
        return str(actual) == str(expected)
