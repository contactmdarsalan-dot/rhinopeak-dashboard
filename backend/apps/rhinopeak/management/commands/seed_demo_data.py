from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.rhinopeak.data.mongo import collection, ensure_indexes
from apps.rhinopeak.services.mongo_service import create_audit, normalize_email, put_record


class Command(BaseCommand):
    help = "Seed idempotent demo business data into an existing RhinoPeak workspace owner."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--email", required=True, help="Owner email whose workspace should receive demo data.")

    def handle(self, *args: Any, **options: Any) -> None:
        ensure_indexes()
        email = normalize_email(str(options["email"]))
        user = collection("users").find_one({"emailNormalized": email})
        if not user:
            raise CommandError(f"No workspace owner found for {email}. Register this owner first.")

        workspace_id = str(user["workspaceId"])
        owner_name = str(user.get("name") or email)
        now = timezone.now().isoformat(timespec="seconds")
        today = timezone.localdate()
        date = lambda days: (today - timedelta(days=days)).isoformat()

        collection("settings").update_one(
            {"workspaceId": workspace_id},
            {
                "$set": {
                    "businessName": "RatoPanda Mart",
                    "panVatNumber": "609999999",
                    "currency": "NPR",
                    "language": "ne",
                    "timezone": "Asia/Kathmandu",
                    "fiscalYearStart": "July",
                    "taxRate": 13,
                    "invoicePrefix": "RP",
                    "receiptFooter": "Thank you for shopping with RatoPanda Mart.",
                    "defaultPaymentMethod": "Cash",
                    "updatedAt": now,
                },
                "$setOnInsert": {"createdAt": now},
            },
            upsert=True,
        )

        categories = ["Dairy", "Grocery", "Snacks", "Beverage", "Household"]
        for name in categories:
            put_record(workspace_id, "inventory_categories", {"id": f"demo-cat-{name.lower()}", "name": name, "createdBy": owner_name})

        expense_categories = ["Rent", "Salary", "Transport", "Utilities", "Marketing", "Repair", "Fuel", "Packaging"]
        for name in expense_categories:
            put_record(workspace_id, "expense_categories", {"id": f"demo-exp-cat-{name.lower()}", "name": name, "createdBy": owner_name})

        cash_accounts = [
            {"id": "demo-cash-main", "name": "Shop cash drawer", "type": "Cash", "institution": "", "accountNumber": "", "openingBalance": 45000, "balance": 68250, "active": True, "createdAt": now},
            {"id": "demo-bank-nabil", "name": "Nabil Bank current", "type": "Bank", "institution": "Nabil Bank", "accountNumber": "001-245-8899", "openingBalance": 150000, "balance": 184500, "active": True, "createdAt": now},
            {"id": "demo-wallet-esewa", "name": "eSewa wallet", "type": "Wallet", "institution": "eSewa", "accountNumber": "9800000000", "openingBalance": 8000, "balance": 12680, "active": True, "createdAt": now},
        ]
        for account in cash_accounts:
            put_record(workspace_id, "cash_bank_accounts", account)

        customers = [
            {"id": "demo-cust-sita", "name": "Sita Kirana", "email": "sita@example.com", "phone": "9801111111", "address": "Kathmandu", "notes": "Buys dairy every morning.", "tags": ["repeat", "credit"], "totalSpent": 42600, "orders": 18, "lastOrder": date(1), "segment": "VIP", "birthday": "", "taxId": "PAN-44551", "creditLimit": 25000, "balance": 4200, "createdAt": now},
            {"id": "demo-cust-hari", "name": "Hari Cafe", "email": "hari@example.com", "phone": "9802222222", "address": "Lalitpur", "notes": "Pays weekly.", "tags": ["cafe"], "totalSpent": 31800, "orders": 11, "lastOrder": date(2), "segment": "Returning", "birthday": "", "taxId": "", "creditLimit": 30000, "balance": 0, "createdAt": now},
            {"id": "demo-cust-maya", "name": "Maya Store", "email": "maya@example.com", "phone": "9803333333", "address": "Bhaktapur", "notes": "Prefers FonePay.", "tags": ["retail"], "totalSpent": 17450, "orders": 7, "lastOrder": date(5), "segment": "New", "birthday": "", "taxId": "", "creditLimit": 15000, "balance": 2500, "createdAt": now},
        ]
        for customer in customers:
            put_record(workspace_id, "customers", customer)

        suppliers = [
            {"id": "demo-sup-dairy", "name": "Himal Dairy Suppliers", "phone": "9811111111", "email": "billing@himaldairy.local", "address": "Kavre", "pan": "PAN-88991", "contactPerson": "Ramesh", "payableBalance": 18200, "notes": "Morning delivery.", "createdAt": now},
            {"id": "demo-sup-grocery", "name": "Everest Wholesale", "phone": "9822222222", "email": "accounts@everest.local", "address": "Kalanki", "pan": "PAN-77661", "contactPerson": "Anita", "payableBalance": 0, "notes": "Weekly bulk supply.", "createdAt": now},
        ]
        for supplier in suppliers:
            put_record(workspace_id, "suppliers", supplier)

        parties = [
            {"id": "demo-party-sita", "name": "Sita Kirana", "type": "Customer", "phone": "9801111111", "email": "sita@example.com", "address": "Kathmandu", "pan": "PAN-44551", "openingBalance": 3000, "creditLimit": 25000, "dueDays": 7, "notes": "Weekly payment.", "balance": 4200, "createdAt": now},
            {"id": "demo-party-maya", "name": "Maya Store", "type": "Customer", "phone": "9803333333", "email": "maya@example.com", "address": "Bhaktapur", "pan": "", "openingBalance": 1000, "creditLimit": 15000, "dueDays": 10, "notes": "Follow up on Friday.", "balance": 2500, "createdAt": now},
            {"id": "demo-party-dairy", "name": "Himal Dairy Suppliers", "type": "Supplier", "phone": "9811111111", "email": "billing@himaldairy.local", "address": "Kavre", "pan": "PAN-88991", "openingBalance": 8000, "creditLimit": 0, "dueDays": 5, "notes": "Supplier payable.", "balance": 18200, "createdAt": now},
        ]
        for party in parties:
            put_record(workspace_id, "parties", party)

        products = [
            {"id": "demo-prod-milk", "name": "Buffalo Milk", "sku": "MILK-LTR", "category": "Dairy", "stock": 86, "reorderLevel": 20, "price": 120, "costPrice": 92, "supplier": "Himal Dairy Suppliers", "status": "In Stock", "unit": "liter", "barcode": "8900001001", "brand": "Himal", "location": "Cold shelf", "taxRate": 0, "active": True, "createdAt": now},
            {"id": "demo-prod-rice", "name": "Basmati Rice 25kg", "sku": "RICE-25KG", "category": "Grocery", "stock": 18, "reorderLevel": 8, "price": 3450, "costPrice": 3020, "supplier": "Everest Wholesale", "status": "In Stock", "unit": "bag", "barcode": "8900001002", "brand": "Everest", "location": "Aisle 1", "taxRate": 13, "active": True, "createdAt": now},
            {"id": "demo-prod-noodles", "name": "Instant Noodles", "sku": "NOOD-BOX", "category": "Snacks", "stock": 42, "reorderLevel": 30, "price": 25, "costPrice": 19, "supplier": "Everest Wholesale", "status": "In Stock", "unit": "packet", "barcode": "8900001003", "brand": "QuickBite", "location": "Aisle 2", "taxRate": 13, "active": True, "createdAt": now},
            {"id": "demo-prod-tea", "name": "CTC Tea 500g", "sku": "TEA-500", "category": "Beverage", "stock": 12, "reorderLevel": 15, "price": 360, "costPrice": 285, "supplier": "Everest Wholesale", "status": "Low Stock", "unit": "packet", "barcode": "8900001004", "brand": "Nepal Tea", "location": "Aisle 2", "taxRate": 13, "active": True, "createdAt": now},
        ]
        for product in products:
            put_record(workspace_id, "inventory", product)

        sales = [
            self.sale("demo-sale-001", "RP-1001", "demo-cust-sita", "Sita Kirana", date(1), "Credit", "demo-prod-milk", "Buffalo Milk", 20, 120, 0, 0, owner_name),
            self.sale("demo-sale-002", "RP-1002", "demo-cust-hari", "Hari Cafe", date(1), "FonePay", "demo-prod-rice", "Basmati Rice 25kg", 2, 3450, 200, 871, owner_name),
            self.sale("demo-sale-003", "RP-1003", "demo-cust-maya", "Maya Store", date(2), "Credit", "demo-prod-noodles", "Instant Noodles", 100, 25, 0, 325, owner_name),
            self.sale("demo-sale-004", "RP-1004", "walk-in", "Walk-in customer", date(0), "Cash", "demo-prod-tea", "CTC Tea 500g", 4, 360, 0, 187, owner_name),
        ]
        for sale in sales:
            put_record(workspace_id, "sales", sale)

        purchases = [
            self.purchase("demo-pur-001", "HP-7781", "demo-sup-dairy", "Himal Dairy Suppliers", date(3), "Credit", "demo-prod-milk", "Buffalo Milk", 120, "liter", 92, 0, 0, owner_name),
            self.purchase("demo-pur-002", "EW-4052", "demo-sup-grocery", "Everest Wholesale", date(4), "Bank", "demo-prod-rice", "Basmati Rice 25kg", 10, "bag", 3020, 500, 3861, owner_name),
        ]
        for purchase in purchases:
            put_record(workspace_id, "purchases", purchase)

        expenses = [
            {"id": "demo-exp-rent", "category": "Rent", "vendor": "House owner", "amount": 30000, "taxAmount": 0, "paymentAccountId": "demo-bank-nabil", "paymentMethod": "Bank", "date": date(6), "recurring": True, "note": "Monthly shop rent", "attachmentIds": [], "createdBy": owner_name, "createdAt": now},
            {"id": "demo-exp-fuel", "category": "Fuel", "vendor": "Delivery bike", "amount": 1850, "taxAmount": 0, "paymentAccountId": "demo-cash-main", "paymentMethod": "Cash", "date": date(1), "recurring": False, "note": "Delivery fuel", "attachmentIds": [], "createdBy": owner_name, "createdAt": now},
            {"id": "demo-exp-marketing", "category": "Marketing", "vendor": "Facebook boost", "amount": 2500, "taxAmount": 325, "paymentAccountId": "demo-wallet-esewa", "paymentMethod": "eSewa", "date": date(2), "recurring": False, "note": "Weekend promotion", "attachmentIds": [], "createdBy": owner_name, "createdAt": now},
        ]
        for expense in expenses:
            put_record(workspace_id, "expenses", expense)

        ledger_entries = [
            {"id": "demo-ledger-sita-sale", "partyId": "demo-party-sita", "partyName": "Sita Kirana", "direction": "Receivable", "type": "Sale Credit", "amount": 4200, "date": date(1), "dueDate": date(0), "referenceId": "demo-sale-001", "note": "Milk credit sale", "createdBy": owner_name, "createdAt": now},
            {"id": "demo-ledger-maya-sale", "partyId": "demo-party-maya", "partyName": "Maya Store", "direction": "Receivable", "type": "Sale Credit", "amount": 2500, "date": date(2), "dueDate": date(0), "referenceId": "demo-sale-003", "note": "Noodles credit sale", "createdBy": owner_name, "createdAt": now},
            {"id": "demo-ledger-dairy-purchase", "partyId": "demo-party-dairy", "partyName": "Himal Dairy Suppliers", "direction": "Payable", "type": "Purchase Credit", "amount": 18200, "date": date(3), "dueDate": date(0), "referenceId": "demo-pur-001", "note": "Milk purchase payable", "createdBy": owner_name, "createdAt": now},
        ]
        for entry in ledger_entries:
            put_record(workspace_id, "party_ledger", entry)

        movements = [
            {"id": "demo-move-cash-sale", "accountId": "demo-cash-main", "accountName": "Shop cash drawer", "type": "Receipt", "amount": 1627, "date": date(0), "referenceId": "demo-sale-004", "note": "Cash sale", "createdBy": owner_name, "createdAt": now},
            {"id": "demo-move-bank-rice", "accountId": "demo-bank-nabil", "accountName": "Nabil Bank current", "type": "Payment", "amount": 33561, "date": date(4), "referenceId": "demo-pur-002", "note": "Rice supplier payment", "createdBy": owner_name, "createdAt": now},
            {"id": "demo-move-exp-fuel", "accountId": "demo-cash-main", "accountName": "Shop cash drawer", "type": "Payment", "amount": 1850, "date": date(1), "referenceId": "demo-exp-fuel", "note": "Fuel expense", "createdBy": owner_name, "createdAt": now},
        ]
        for movement in movements:
            put_record(workspace_id, "money_movements", movement)

        documents = [
            {"id": "demo-doc-rent", "recordType": "Expense", "recordId": "demo-exp-rent", "name": "Rent agreement receipt", "fileName": "rent-receipt-demo.pdf", "mimeType": "application/pdf", "size": 184000, "dataUrl": "", "uploadedBy": owner_name, "createdAt": now},
            {"id": "demo-doc-purchase", "recordType": "Purchase", "recordId": "demo-pur-001", "name": "Milk supplier bill", "fileName": "milk-supplier-bill.jpg", "mimeType": "image/jpeg", "size": 214000, "dataUrl": "", "uploadedBy": owner_name, "createdAt": now},
        ]
        for document in documents:
            put_record(workspace_id, "documents", document)

        reminders = [
            {"id": "demo-rem-template", "name": "Credit reminder", "channel": "WhatsApp", "message": "Namaste {name}, your pending amount is {amount}. Please clear by {date}.", "language": "en", "active": True, "createdAt": now},
        ]
        for reminder in reminders:
            put_record(workspace_id, "reminder_templates", reminder)

        create_audit(workspace_id, owner_name, "Seeded demo data", "System", f"Demo data refreshed for {email}.")
        self.stdout.write(self.style.SUCCESS(f"Seeded demo data for {email} in workspace {workspace_id}."))

    @staticmethod
    def sale(record_id: str, invoice_no: str, customer_id: str, customer: str, date: str, payment: str, product_id: str, product_name: str, quantity: float, unit_price: float, discount: float, tax: float, owner_name: str) -> dict[str, Any]:
        amount = (quantity * unit_price) - discount + tax
        return {
            "id": record_id,
            "customerId": customer_id,
            "customer": customer,
            "products": product_name,
            "items": [{"productId": product_id, "productName": product_name, "quantity": quantity, "unitPrice": unit_price, "discount": discount, "tax": tax, "lineTotal": amount}],
            "amount": amount,
            "payment": payment,
            "status": "Completed",
            "date": date,
            "createdBy": owner_name,
            "auditTrail": ["Seeded demo sale"],
            "invoiceNo": invoice_no,
            "currency": "NPR",
            "subtotal": quantity * unit_price,
            "discountTotal": discount,
            "taxTotal": tax,
            "taxableAmount": max(0, (quantity * unit_price) - discount),
            "vatAmount": tax,
            "invoiceType": "Tax Invoice",
            "buyerPan": "",
            "creditDueDate": date if payment == "Credit" else "",
            "creditClearedAt": "",
            "notes": "Seeded demo transaction",
        }

    @staticmethod
    def purchase(record_id: str, bill_no: str, supplier_id: str, supplier_name: str, date: str, payment: str, product_id: str, product_name: str, quantity: float, unit: str, unit_cost: float, discount: float, tax: float, owner_name: str) -> dict[str, Any]:
        subtotal = quantity * unit_cost
        amount = subtotal - discount + tax
        return {
            "id": record_id,
            "supplierId": supplier_id,
            "supplierName": supplier_name,
            "billNo": bill_no,
            "date": date,
            "dueDate": date,
            "items": [{"productId": product_id, "productName": product_name, "quantity": quantity, "unit": unit, "unitCost": unit_cost, "discount": discount, "tax": tax, "lineTotal": amount}],
            "subtotal": subtotal,
            "discountTotal": discount,
            "taxTotal": tax,
            "amount": amount,
            "payment": payment,
            "status": "Received",
            "notes": "Seeded supplier bill",
            "attachmentIds": [],
            "createdBy": owner_name,
            "createdAt": timezone.now().isoformat(timespec="seconds"),
        }
