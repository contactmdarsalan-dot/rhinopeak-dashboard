import unittest
from apps.rhinopeak.services.assistant_service import detect_intent

class AssistantServiceTests(unittest.TestCase):
    def test_record_sale_intents(self):
        self.assertEqual(detect_intent("नयाँ सेल्स एड गर"), "record_sale")
        self.assertEqual(detect_intent("सेल्स"), "record_sale")
        self.assertEqual(detect_intent("सेल"), "record_sale")

    def test_expense_intents(self):
        self.assertEqual(detect_intent("खर्च"), "add_expense")
        self.assertEqual(detect_intent("खर्चा"), "add_expense")

    def test_add_product_intents(self):
        self.assertEqual(detect_intent("नयाँ सामान"), "add_product")
