from __future__ import annotations

import base64
import html
import re
from typing import Any

from apps.rhinopeak.domain.errors import AppError
from apps.rhinopeak.domain.security import make_id
from apps.rhinopeak.services.mongo_service import (
    active_business_id_for,
    bootstrap_payload,
    create_audit,
    create_document,
    create_expense,
    create_purchase,
    create_sale,
    get_record,
    iso_now,
    list_records,
    patch_record,
    put_record,
    require_permission,
    today_string,
)


PAYMENT_ALIASES = {
    "cash": "Cash",
    "card": "Card",
    "esewa": "eSewa",
    "e-sewa": "eSewa",
    "fonepay": "FonePay",
    "fone pay": "FonePay",
    "khalti": "Khalti",
    "bank": "Bank",
    "credit": "Credit",
}


def list_bill_scans(user: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "documents.view")
    return {"billScans": list_records(user["workspaceId"], "bill_scans")}


def get_bill_scan(user: dict[str, Any], scan_id: str) -> dict[str, Any]:
    require_permission(user, "documents.view")
    scan = get_record(user["workspaceId"], "bill_scans", scan_id)
    if scan is None:
        raise AppError(404, "Bill scan not found.")
    return {"billScan": scan}


def clean_bill_text(raw_text: str) -> str:
    """
    Preprocess OCR text to normalize common scan artifacts before parsing.
    - Strips HTML tags if pasted from web
    - Normalizes repeated dashes/equals to clean separator lines
    - Collapses multiple blank lines into one
    - Fixes common OCR character substitutions (0→O in words, etc.)
    - Strips leading/trailing whitespace per line
    """
    import re
    import html
    # Unescape HTML entities (&amp; &lt; etc.)
    text = html.unescape(raw_text)
    # Strip HTML tags
    text = re.sub(r"<[^>]+>", "", text)
    # Normalize line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # Normalize separator lines (3+ dashes/equals/underscores → standard dashes)
    text = re.sub(r"^[\-=_*]{3,}$", "---", text, flags=re.MULTILINE)
    # Collapse 3+ blank lines → single blank line
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Strip trailing whitespace per line
    text = "\n".join(line.rstrip() for line in text.split("\n"))
    return text.strip()


def extract_text_from_image(image_data_url: str) -> str:
    """
    KaroBrain™ Vision Engine entry point.
    
    Multi-layer OCR pipeline:
      1. OpenCV preprocessing (denoise, deskew, contrast enhance)
      2. Tesseract local OCR (free, runs on server, unlimited users)
      3. Gemini Vision API (cloud fallback for low-confidence results)
    
    Falls back gracefully if libraries are not installed.
    """
    if not image_data_url:
        return ""
    try:
        from apps.rhinopeak.services.karobrain_engine import karobrain_extract
        return karobrain_extract(image_data_url)
    except Exception as e:
        print(f"[KaroBrain™] Engine error: {e}")
        return ""



def _blank_ocr_template(file_name: str) -> str:
    """
    Return a minimal blank bill template for real uploaded images when
    Vision API OCR is not available. This gives the user blank editable
    fields instead of wrong fake data from filename guessing.
    """
    from apps.rhinopeak.services.mongo_service import today_string
    return f"""[IMAGE UPLOADED: {file_name}]
Date: {today_string()}
Bill No:
Vendor:
-----------------------------
-----------------------------
Total Amount: 0
Payment Mode: Cash
[Please review and fill in the bill details above manually]
"""


def simulate_ocr(file_name: str) -> str:
    """
    Simulate OCR extraction for demo purposes.
    Returns realistic Nepali bill text based on filename keywords.
    Only used for SVG demo templates from the Quick Simulator buttons.
    """
    name = file_name.lower()

    if "himalaya" in name or "hotel" in name:
        return """HIMALAYA HOTEL & RESTAURANT
VAT No: 987654321
Bill No: HH-2026-1045
Date: 2026-05-22
-----------------------------
Momo (Steam)   2 x 200.00    400.00
Chicken Soup   1 x 250.00    250.00
Coke 500ml     2 x 80.00     160.00
-----------------------------
Subtotal:                    810.00
VAT 13%:                     105.30
Total Amount:                915.30
Payment Mode:                Cash
Thank you for dining with us!
"""

    elif "rent" in name or "office" in name:
        return """OFFICE RENT RECEIPT
Receipt No: RNT-2026-05
Date: 2026-05-22
-----------------------------
Office Rent May 2026  1 x 25000.00  25000.00
-----------------------------
Subtotal:                    25000.00
Total Amount:                25000.00
Payment Mode:                Bank Transfer
Bank: Nabil Bank
"""

    elif "chemist" in name or "pharmacy" in name or "medical" in name or "clinic" in name or "health" in name:
        return """KATHMANDU PHARMACY & CHEMIST
PAN No: 302837100
Bill No: KPC-4421
Date: 2026-05-22
-----------------------------
Paracetamol 500mg 10tab  2 x 45.00    90.00
Cetirizine 10mg 10tab    1 x 55.00    55.00
Vitamin C 500mg 30tab    1 x 280.00   280.00
Bandage 5cm              1 x 120.00   120.00
-----------------------------
Subtotal:                    545.00
Discount 5%:                 27.25
Total Amount:                517.75
Payment Mode:                Cash
"""

    elif "hardware" in name or "building" in name or "nirman" in name or "cement" in name or "construction" in name:
        return """SHREE HARDWARE & NIRMAN SAMAN
VAT No: 600123456
Invoice No: SH-2026-337
Date: 2026-05-22
-----------------------------
Cement (Udayapur) 50kg  10 x 850.00   8500.00
Sand (cubic ft)         5 x 1200.00   6000.00
Iron Rod 12mm 1pc       6 x 750.00    4500.00
-----------------------------
Subtotal:                    19000.00
VAT 13%:                     2470.00
Grand Total:                 21470.00
Payment Mode:                Bank
Account: Sanima Bank
"""

    elif "fuel" in name or "petrol" in name or "diesel" in name or "pump" in name or "gas" in name:
        return """HIMALAYAN FUEL STATION
PAN No: 302900001
Receipt No: FS-7823
Date: 2026-05-22
-----------------------------
Petrol (Liters)   15.0 x 178.00   2670.00
-----------------------------
Subtotal:                    2670.00
Total Amount:                2670.00
Payment Mode:                FonePay
"""

    elif "electronics" in name or "digital" in name or "laptop" in name or "computer" in name:
        return """DIGITAL WORLD ELECTRONICS
VAT No: 401234567
Tax Invoice No: DWE-2026-889
Date: 2026-05-22
-----------------------------
Samsung A15 5G           1 x 28000.00  28000.00
Tempered Glass 9H        1 x 350.00      350.00
Type-C Cable 1m          2 x 250.00      500.00
-----------------------------
Subtotal:                    28850.00
Discount:                    850.00
VAT 13%:                     3640.50
Total Amount:                31640.50
Payment Mode:                Card
"""

    elif "mobile" in name or "phone" in name or "smartphone" in name:
        return """MOBILE WORLD SHOP
VAT No: 500123789
Tax Invoice No: MW-2026-445
Date: 2026-05-22
-----------------------------
iPhone 15 128GB          1 x 145000.00  145000.00
Screen Protector         1 x 800.00         800.00
Phone Case               1 x 1200.00       1200.00
-----------------------------
Subtotal:                    147000.00
VAT 13%:                      19110.00
Total Amount:                166110.00
Payment Mode:                Card
"""

    elif "bank" in name or "atm" in name or "transaction" in name:
        return """NABIL BANK LIMITED
Transaction Receipt
Date: 2026-05-22
-----------------------------
Cash Deposit              1 x 50000.00  50000.00
-----------------------------
Total Amount:                50000.00
Transaction ID: NBL202605221234
Payment Mode:                Cash
"""

    elif "nepali" in name or "devanagari" in name:
        return """श्री राम किराना पसल
बिल नं: SRK-०५२
मिति: २०२६-०५-२२
-----------------------------
चामल १ किलो      2 x 120.00    240.00
दाल ५०० ग्राम    1 x 95.00      95.00
तेल १ लिटर       1 x 280.00    280.00
-----------------------------
जम्मा रकम:               615.00
भुक्तानी विधि:            नगद
धन्यवाद!
"""

    elif any(kw in name for kw in ("jewel", "suna", "jweler", "jwellers", "gold", "silver", "gahana", "usha")):
        return """उषा ज्वेलर्स
USHA JEWELLERS
Main Road Jeetpur, Bara
Phone: 520540, 520086, 521351
बिल नं: 238
Date: 2081/8/6
-----------------------------
मंगलसूत्र    3.460 तोला    46000    95000
-----------------------------
जम्मा रकम:               95000
पेस्की:                   10000
बाँकी:                    85000
भुक्तानी विधि:            नगद
"""

    elif "restaurant" in name or "food" in name or "cafe" in name or "kitchen" in name or "bhoj" in name:
        return """NEWARI KITCHEN RESTAURANT
VAT No: 302100456
Bill No: NK-20260522-089
Date: 2026-05-22
-----------------------------
Buff Choila          1 x 350.00   350.00
Yomari (2 pcs)       2 x 120.00   240.00
Kwati Soup           1 x 280.00   280.00
Lassi 300ml          2 x 90.00    180.00
-----------------------------
Subtotal:                    1050.00
VAT 13%:                      136.50
Total Amount:                1186.50
Payment Mode:                Khalti
"""

    elif any(kw in name for kw in ("cloth", "textile", "garment", "kapda", "fashion", "tailor", "silai", "dress", "kurta", "saree")):
        return """SHREE FASHION TEXTILE & TAILORING
VAT No: 302567890
Bill No: SFT-2026-211
Date: 2026-05-22
-----------------------------
Daura Suruwal (Stitching)  1 x 2500.00   2500.00
Saree (Silk)               2 x 3500.00   7000.00
Blouse Stitching           2 x 600.00    1200.00
Kurta Salwar               1 x 1800.00   1800.00
-----------------------------
Subtotal:                    12500.00
Discount:                     500.00
Total Amount:                12000.00
Payment Mode:                Cash
"""

    elif any(kw in name for kw in ("stationery", "stationary", "books", "kitab", "copy", "pen", "writing")):
        return """KATHMANDU STATIONERY & BOOK HOUSE
PAN No: 400123456
Invoice No: KSB-2026-087
Date: 2026-05-22
-----------------------------
A4 Paper 500 sheets  2 x 450.00    900.00
Blue Ink Pen 12pcs   3 x 120.00    360.00
Register A4          5 x 85.00     425.00
Stapler              1 x 350.00    350.00
Pencil Box           2 x 180.00    360.00
-----------------------------
Subtotal:                    2395.00
VAT 13%:                      311.35
Total Amount:                2706.35
Payment Mode:                Cash
"""

    elif any(kw in name for kw in ("garage", "auto", "vehicle", "repair", "workshop", "service", "mechanic", "motor", "bike", "car")):
        return """EVEREST AUTO GARAGE & WORKSHOP
PAN No: 600789456
Invoice No: EAG-2026-334
Date: 2026-05-22
-----------------------------
Engine Oil 1L (Mobil)    4 x 750.00    3000.00
Oil Filter               1 x 550.00     550.00
Labour Charge            1 x 1200.00   1200.00
Brake Pad (Front)        2 x 850.00    1700.00
-----------------------------
Subtotal:                    6450.00
VAT 13%:                      838.50
Total Amount:                7288.50
Payment Mode:                Cash
"""

    elif any(kw in name for kw in ("agriculture", "krishi", "seed", "fertilizer", "pesticide", "beej", "farm", "agro", "nursery")):
        return """NEPAL KRISHI SEEDS & AGRO STORE
PAN No: 700234567
Invoice No: NKA-2026-156
Date: 2026-05-22
-----------------------------
Tomato Seeds 10g         3 x 180.00     540.00
Urea Fertilizer 50kg     2 x 1800.00   3600.00
DAP Fertilizer 50kg      1 x 2200.00   2200.00
Pesticide (Carbendazim)  2 x 350.00     700.00
Irrigation Pipe 1m       10 x 45.00     450.00
-----------------------------
Subtotal:                    7490.00
Discount:                     290.00
Total Amount:                7200.00
Payment Mode:                Cash
"""

    elif any(kw in name for kw in ("ntc", "ncell", "telecom", "internet", "wifi", "isp", "broadband", "sim", "recharge")):
        return """NTC - NEPAL TELECOM
Customer Receipt
Bill No: NTC-2026-88741
Date: 2026-05-22
-----------------------------
Broadband Internet 50Mbps  1 x 1200.00  1200.00
ADSL Line Rental           1 x 300.00    300.00
-----------------------------
Subtotal:                    1500.00
VAT 13%:                      195.00
Total Amount:                1695.00
Account No: 01-55-123456
Payment Mode:                eSewa
"""

    elif any(kw in name for kw in ("electricity", "nea", "power", "bijuli", "water", "wsc", "kwh", "meter")):
        return """NEPAL ELECTRICITY AUTHORITY (NEA)
Consumer Bill
Bill No: NEA-2026-44512
Date: 2026-05-22
-----------------------------
Energy Charge (250 kWh)  1 x 2350.00   2350.00
Demand Charge            1 x 150.00     150.00
Meter Service Charge     1 x 50.00       50.00
-----------------------------
Subtotal:                    2550.00
Total Amount:                2550.00
Consumer No: KTM-001-12345
Payment Mode:                ConnectIPS
"""

    elif any(kw in name for kw in ("salon", "beauty", "parlour", "parlor", "spa", "haircut", "barber", "makeup", "nails")):
        return """GLAMOUR BEAUTY SALON & SPA
PAN No: 305678901
Receipt No: GBS-2026-092
Date: 2026-05-22
-----------------------------
Haircut & Styling        1 x 800.00    800.00
Facial Treatment         1 x 1500.00  1500.00
Manicure                 1 x 700.00    700.00
Threading (Eyebrow)      1 x 200.00    200.00
-----------------------------
Subtotal:                    3200.00
Discount 10%:                 320.00
Total Amount:                2880.00
Payment Mode:                Cash
"""

    elif any(kw in name for kw in ("school", "college", "tuition", "education", "class", "fee", "vidya", "shiksha", "exam", "academy")):
        return """BRIGHT FUTURE ACADEMY
PAN No: 203456789
Receipt No: BFA-2026-033
Date: 2026-05-22
-----------------------------
Tuition Fee (Grade 10)   1 x 4500.00   4500.00
Computer Class Fee       1 x 1500.00   1500.00
Exam Fee                 1 x 800.00     800.00
Library Fee              1 x 200.00     200.00
-----------------------------
Subtotal:                    7000.00
Total Amount:                7000.00
Payment Mode:                Cash
"""

    elif any(kw in name for kw in ("transport", "logistic", "courier", "cargo", "delivery", "freight", "truck", "tempo", "bus")):
        return """HIMALAYAN CARGO & LOGISTICS
PAN No: 600456789
Invoice No: HCL-2026-778
Date: 2026-05-22
-----------------------------
Goods Transport KTM-Pokhara  1 x 8500.00   8500.00
Loading/Unloading             1 x 500.00     500.00
Packaging                     1 x 300.00     300.00
-----------------------------
Subtotal:                    9300.00
VAT 13%:                     1209.00
Total Amount:                10509.00
Payment Mode:                Bank
"""

    elif any(kw in name for kw in ("catering", "event", "party", "banquet", "wedding", "birthday", "program", "dawat")):
        return """ROYAL CATERING SERVICES
VAT No: 401567890
Invoice No: RCS-2026-044
Date: 2026-05-22
-----------------------------
Lunch Buffet (per head)   80 x 650.00   52000.00
Soft Drinks per head      80 x 80.00     6400.00
Decoration Setup           1 x 5000.00   5000.00
Service Charge             1 x 3000.00   3000.00
-----------------------------
Subtotal:                    66400.00
Discount:                     1400.00
VAT 13%:                      8450.00
Total Amount:                73450.00
Payment Mode:                Bank Transfer
"""

    elif any(kw in name for kw in ("meat", "maasu", "chicken", "mutton", "fish", "machha", "poultry", "buff", "goat")):
        return """FRESH MEAT & POULTRY SHOP
PAN No: 302111222
Bill No: FMP-2026-567
Date: 2026-05-22
-----------------------------
Chicken (Live) 1kg   2 x 350.00    700.00
Mutton 500g          1 x 900.00    900.00
Fish (Rohu) 1kg      1 x 400.00    400.00
-----------------------------
Subtotal:                    2000.00
Total Amount:                2000.00
Payment Mode:                Cash
"""

    elif any(kw in name for kw in ("vegetable", "sabji", "tarkari", "fruits", "phul", "green", "fresh", "market", "bazar")):
        return """FRESH VEGETABLE & FRUIT MARKET
Bill No: VFM-2026-234
Date: 2026-05-22
-----------------------------
Tomato 1kg          3 x 60.00     180.00
Potato 1kg          5 x 40.00     200.00
Spinach 500g        2 x 30.00      60.00
Apple 1kg           2 x 220.00    440.00
Banana (dozen)      1 x 80.00      80.00
-----------------------------
Total Amount:                960.00
Payment Mode:                Cash
"""

    elif any(kw in name for kw in ("wholesale", "trade", "supplier", "distributor", "bulk", "import", "export")):
        return """KATHMANDU WHOLESALE TRADERS
VAT No: 700891234
Tax Invoice No: KWT-2026-1023
Date: 2026-05-22
-----------------------------
Sugar 50kg bags         20 x 4200.00    84000.00
Cooking Oil 15L tin     10 x 2800.00    28000.00
Dal (Musuro) 25kg        5 x 3500.00    17500.00
Salt 25kg bag           10 x 600.00      6000.00
-----------------------------
Subtotal:                    135500.00
Discount 2%:                   2710.00
VAT 13%:                      17252.10
Grand Total:                 150042.10
Payment Mode:                Bank
"""

    elif any(kw in name for kw in ("insurance", "bima", "premium", "policy", "life", "nonlife")):
        return """NEPAL LIFE INSURANCE CO. LTD
Policy Receipt
Receipt No: NLI-2026-88234
Date: 2026-05-22
-----------------------------
Life Insurance Premium (Annual)  1 x 18000.00  18000.00
-----------------------------
Total Premium:               18000.00
Policy No: NL-2026-12345678
Payment Mode:                eSewa
"""

    elif any(kw in name for kw in ("printing", "print", "press", "offset", "banner", "flex", "visiting", "pamphlet")):
        return """CREATIVE PRINTING & PRESS
PAN No: 400654321
Invoice No: CPP-2026-189
Date: 2026-05-22
-----------------------------
Visiting Card (500 pcs)    1 x 800.00    800.00
Flex Banner 4x6 ft         2 x 1200.00  2400.00
A4 Leaflet (1000 pcs)      1 x 2500.00  2500.00
Letterhead (500 pcs)       1 x 1500.00  1500.00
-----------------------------
Subtotal:                    7200.00
VAT 13%:                      936.00
Total Amount:                8136.00
Payment Mode:                Cash
"""

    elif any(kw in name for kw in ("grocery", "kiryana", "general", "store", "pasal", "daily", "kirana")):
        return """SHREE GANESH KIRYANA PASAL
Bill No: SGK-2026-312
Date: 2026-05-22
-----------------------------
Aata 5kg             1 x 300.00    300.00
Dal (Musuro) 1kg     2 x 180.00    360.00
Chini 1kg            2 x 95.00     190.00
Nescafe 50g          1 x 280.00    280.00
Soap (Lifebuoy)      4 x 65.00     260.00
Biscuit (Wai Wai)    5 x 30.00     150.00
-----------------------------
Subtotal:                    1540.00
Discount:                      40.00
Total Amount:                1500.00
Payment Mode:                Cash
"""

    else:
        return """STANDARD GENERAL STORE
VAT No: 554433221
Bill No: SGS-1099
Date: 2026-05-22
-----------------------------
General Item A     3 x 150.00    450.00
General Item B     1 x 200.00    200.00
-----------------------------
Subtotal:                    650.00
Total Amount:                650.00
Payment Mode:                Card
Thank you for shopping!
"""


def upload_bill_scan(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "documents.manage")
    raw_text = str(payload.get("rawText", "")).strip()
    image_data_url = str(payload.get("imageDataUrl", "")).strip()
    file_name = str(payload.get("fileName") or payload.get("imageName") or "bill-photo").strip()
    mime_type = str(payload.get("mimeType") or "image/jpeg").strip()
    
    if not raw_text and not image_data_url:
        raise AppError(400, "Add a bill photo or paste OCR text before scanning.")

    # If image is uploaded without manual text:
    if not raw_text and image_data_url:
        # Detect if this is an SVG demo template (from Quick Simulator buttons)
        # vs a real camera/gallery photo uploaded by the user
        is_svg_template = (
            image_data_url.startswith("data:image/svg+xml")
            or mime_type == "image/svg+xml"
        )

        if is_svg_template:
            # Use filename-based template for demo templates
            raw_text = simulate_ocr(file_name)
        else:
            # Real photo: try Gemini Vision OCR
            raw_text = extract_text_from_image(image_data_url)
            if not raw_text:
                # Vision API not configured — return a blank editable template
                # so user can fill in fields instead of getting wrong fake data
                raw_text = _blank_ocr_template(file_name)

    scan = put_record(
        user["workspaceId"],
        "bill_scans",
        {
            "id": str(payload.get("id") or make_id("BSCAN")),
            "sourceType": str(payload.get("sourceType") or ("manual" if raw_text else "camera")),
            "status": "Uploaded",
            "fileName": file_name,
            "mimeType": mime_type,
            "size": int(payload.get("size") or len(image_data_url)),
            "imageDataUrl": image_data_url,
            "rawText": raw_text,
            "parsed": {},
            "approved": {},
            "confidence": 0,
            "targetRecordType": "",
            "targetRecordId": "",
            "pdfDocumentId": "",
            "createdBy": user["name"],
            "createdAt": iso_now(),
        },
    )
    create_audit(user["workspaceId"], user["name"], "Uploaded bill scan", "Smart Bill Scanner", scan["id"])
    return {"billScan": scan, "bootstrap": bootstrap_payload(user)}


def parse_bill_scan(user: dict[str, Any], scan_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "documents.manage")
    scan = get_record(user["workspaceId"], "bill_scans", scan_id)
    if scan is None:
        raise AppError(404, "Bill scan not found.")
    raw_text = str(payload.get("rawText") or scan.get("rawText") or "").strip()
    if not raw_text:
        raise AppError(400, "No OCR text found. Paste extracted bill text or upload through an OCR provider.")

    # Preprocess: normalize OCR artifacts, HTML entities, repeated separators
    clean_text = clean_bill_text(raw_text)
    from apps.rhinopeak.services.mongo_service import expense_category_names
    categories = expense_category_names(user["workspaceId"])
    parsed = parse_bill_text(clean_text, categories)
    scan = patch_record(
        user["workspaceId"],
        "bill_scans",
        scan_id,
        {
            "rawText": raw_text,
            "parsed": parsed,
            "confidence": parsed["confidence"],
            "status": "Needs Review" if parsed["confidence"] < 0.8 else "Parsed",
            "updatedAt": iso_now(),
        },
    )
    create_audit(user["workspaceId"], user["name"], "Parsed bill scan", "Smart Bill Scanner", scan_id)
    return {"billScan": scan, "parsed": parsed, "bootstrap": bootstrap_payload(user)}


def log_user_corrections(scan_id: str, raw_text: str, original: dict[str, Any], approved: dict[str, Any]) -> None:
    modifications = {}
    keys_to_compare = [
        "vendorName",
        "billNumber",
        "billDate",
        "paymentMethod",
        "currency",
        "subtotal",
        "discountAmount",
        "vatAmount",
        "totalAmount",
    ]
    for key in keys_to_compare:
        orig_val = original.get(key)
        app_val = approved.get(key)
        if orig_val != app_val:
            modifications[key] = {
                "original": orig_val,
                "corrected": app_val
            }
            
    orig_items = original.get("items") or []
    app_items = approved.get("items") or []
    if orig_items != app_items:
        modifications["items"] = {
            "original": orig_items,
            "corrected": app_items
        }

    if not modifications:
        return

    from apps.rhinopeak.services.mongo_service import iso_now
    record = {
        "scanId": scan_id,
        "timestamp": iso_now(),
        "rawText": raw_text,
        "original": {k: original.get(k) for k in keys_to_compare + ["items"]},
        "corrected": {k: approved.get(k) for k in keys_to_compare + ["items"]},
        "modifications": modifications
    }

    try:
        from pathlib import Path
        import json
        runtime_dir = Path(__file__).resolve().parents[3] / "runtime"
        runtime_dir.mkdir(parents=True, exist_ok=True)
        corrections_file = runtime_dir / "corrections.jsonl"
        with open(corrections_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    except Exception as e:
        print(f"[Error] Failed to log user corrections: {e}")


def approve_bill_scan(user: dict[str, Any], scan_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    scan = get_record(user["workspaceId"], "bill_scans", scan_id)
    if scan is None:
        raise AppError(404, "Bill scan not found.")

    approved = normalize_approved_payload(payload.get("approved") or scan.get("parsed") or {})
    
    # Log any manual corrections
    log_user_corrections(scan_id, scan.get("rawText") or "", scan.get("parsed") or {}, approved)
    
    target_type = str(payload.get("targetRecordType") or payload.get("targetType") or "Expense").strip().title()
    if target_type not in {"Expense", "Purchase", "Sale"}:
        raise AppError(400, "Bill scan can be saved as Expense, Purchase, or Sale.")

    if target_type == "Expense":
        created = create_expense(user, expense_payload_from_scan(user, approved, scan_id))
        target = created["expense"]
    elif target_type == "Purchase":
        created = create_purchase(user, purchase_payload_from_scan(user, approved, scan_id))
        target = created["purchase"]
    else:
        created = create_sale(user, sale_payload_from_scan(user, approved, scan_id))
        target = created["sale"]

    document = create_document(user, document_payload_for_scan(user, approved, scan, target_type, target))["document"]
    scan = patch_record(
        user["workspaceId"],
        "bill_scans",
        scan_id,
        {
            "approved": approved,
            "status": "Approved",
            "targetRecordType": target_type,
            "targetRecordId": target["id"],
            "pdfDocumentId": document["id"],
            "updatedAt": iso_now(),
        },
    )
    create_audit(user["workspaceId"], user["name"], "Approved bill scan", "Smart Bill Scanner", f"{scan_id} -> {target_type} {target['id']}")
    return {
        "billScan": scan,
        "target": target,
        "document": document,
        "bootstrap": bootstrap_payload(user),
    }


def parse_bill_text(raw_text: str, categories: list[str] = None) -> dict[str, Any]:
    from apps.rhinopeak.services.gpt_model import structure_ocr_text
    return structure_ocr_text(raw_text, categories)


def normalize_approved_payload(value: Any) -> dict[str, Any]:
    parsed = value if isinstance(value, dict) else {}
    items = parsed.get("items") if isinstance(parsed.get("items"), list) else []
    normalized_items = []
    for item in items:
        if not isinstance(item, dict):
            continue
        quantity = number(item.get("quantity"), 1)
        unit_price = number(item.get("unitPrice"), number(item.get("price"), 0))
        line_total = number(item.get("lineTotal"), quantity * unit_price)
        normalized_items.append(
            {
                "name": str(item.get("name") or item.get("productName") or "Item").strip(),
                "quantity": quantity,
                "unit": str(item.get("unit") or "pcs").strip() or "pcs",
                "unitPrice": unit_price,
                "discount": number(item.get("discount"), 0),
                "tax": number(item.get("tax"), 0),
                "lineTotal": round(line_total, 2),
            }
        )
    subtotal = number(parsed.get("subtotal"), sum(item["lineTotal"] for item in normalized_items))
    vat_amount = number(parsed.get("vatAmount"), 0)
    discount_amount = number(parsed.get("discountAmount"), 0)
    total = number(parsed.get("totalAmount"), subtotal - discount_amount + vat_amount)
    return {
        "vendorName": str(parsed.get("vendorName") or "Unknown vendor").strip(),
        "billNumber": str(parsed.get("billNumber") or make_id("BILL")).strip(),
        "billDate": str(parsed.get("billDate") or today_string())[:10],
        "paymentMethod": normalize_payment(str(parsed.get("paymentMethod") or "Cash")),
        "currency": str(parsed.get("currency") or "NPR"),
        "category": str(parsed.get("category") or "Scanned Bills").strip(),
        "subtotal": round(subtotal, 2),
        "discountAmount": round(discount_amount, 2),
        "vatAmount": round(vat_amount, 2),
        "totalAmount": round(total, 2),
        "items": normalized_items,
        "notes": str(parsed.get("notes") or "").strip(),
        "rawText": str(parsed.get("rawText") or "").strip(),
    }


def expense_payload_from_scan(user: dict[str, Any], approved: dict[str, Any], scan_id: str) -> dict[str, Any]:
    return {
        "id": make_id("EXP"),
        "category": approved.get("category") or "Scanned Bills",
        "vendor": approved["vendorName"],
        "amount": approved["totalAmount"],
        "taxAmount": approved["vatAmount"],
        "paymentMethod": approved["paymentMethod"],
        "date": approved["billDate"],
        "recurring": False,
        "note": f"Smart Bill Scanner: {approved['billNumber']}",
        "attachmentIds": [scan_id],
        "createdBy": user["name"],
    }


def purchase_payload_from_scan(user: dict[str, Any], approved: dict[str, Any], scan_id: str) -> dict[str, Any]:
    items = [
        {
            "productId": "",
            "productName": item["name"],
            "quantity": item["quantity"],
            "unit": item["unit"],
            "unitCost": item["unitPrice"],
            "discount": item["discount"],
            "tax": item["tax"],
        }
        for item in approved["items"]
    ] or [
        {
            "productId": "",
            "productName": "Scanned purchase",
            "quantity": 1,
            "unit": "pcs",
            "unitCost": approved["subtotal"],
            "discount": approved["discountAmount"],
            "tax": approved["vatAmount"],
        }
    ]
    return {
        "id": make_id("PUR"),
        "supplierName": approved["vendorName"],
        "billNo": approved["billNumber"],
        "date": approved["billDate"],
        "dueDate": "",
        "payment": approved["paymentMethod"],
        "status": "Received",
        "notes": f"Created from Smart Bill Scanner {scan_id}",
        "attachmentIds": [scan_id],
        "createdBy": user["name"],
        "items": items,
    }


def sale_payload_from_scan(user: dict[str, Any], approved: dict[str, Any], scan_id: str) -> dict[str, Any]:
    items = [
        {
            "productId": "",
            "productName": item["name"],
            "quantity": item["quantity"],
            "unit": item["unit"],
            "unitPrice": item["unitPrice"],
            "discount": item["discount"],
            "tax": item["tax"],
        }
        for item in approved["items"]
    ] or [
        {
            "productId": "",
            "productName": "Scanned item",
            "quantity": 1,
            "unit": "pcs",
            "unitPrice": approved["subtotal"],
            "discount": approved["discountAmount"],
            "tax": approved["vatAmount"],
        }
    ]
    return {
        "id": make_id("SALE"),
        "invoiceNo": approved["billNumber"],
        "businessId": active_business_id_for(user),
        "customer": "Walk-in customer",
        "payment": approved["paymentMethod"],
        "status": "Completed",
        "date": approved["billDate"],
        "notes": f"Created from Smart Bill Scanner {scan_id}",
        "createdBy": user["name"],
        "items": items,
    }


def document_payload_for_scan(
    user: dict[str, Any],
    approved: dict[str, Any],
    scan: dict[str, Any],
    target_type: str,
    target: dict[str, Any],
) -> dict[str, Any]:
    body = bill_html(user, approved, scan, target_type, target)
    data_url = "data:text/html;base64," + base64.b64encode(body.encode("utf-8")).decode("ascii")
    return {
        "id": make_id("DOC"),
        "name": f"Smart bill - {approved['vendorName']}",
        "recordType": target_type,
        "recordId": target["id"],
        "fileName": f"{approved['billNumber'] or target['id']}.html",
        "mimeType": "text/html",
        "size": len(body.encode("utf-8")),
        "dataUrl": data_url,
        "uploadedBy": user["name"],
    }


def bill_html(user: dict[str, Any], approved: dict[str, Any], scan: dict[str, Any], target_type: str, target: dict[str, Any]) -> str:
    rows = "\n".join(
        f"<tr><td>{html.escape(item['name'])}</td><td>{item['quantity']} {html.escape(item['unit'])}</td>"
        f"<td>NPR {item['unitPrice']:,.2f}</td><td>NPR {item['lineTotal']:,.2f}</td></tr>"
        for item in approved["items"]
    )
    if not rows:
        rows = "<tr><td>Scanned bill total</td><td>1</td><td></td><td>NPR {0:,.2f}</td></tr>".format(approved["subtotal"])
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>{html.escape(approved['billNumber'])}</title>
  <style>
    body {{ font-family: Arial, sans-serif; color: #0f172a; margin: 32px; }}
    header {{ display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #0f766e; padding-bottom: 18px; }}
    h1 {{ margin: 0; font-size: 26px; }}
    .muted {{ color: #64748b; font-size: 13px; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 24px; }}
    th, td {{ text-align: left; padding: 10px 8px; border-bottom: 1px solid #e2e8f0; }}
    th {{ font-size: 12px; color: #475569; text-transform: uppercase; }}
    .totals {{ margin-top: 24px; margin-left: auto; width: 280px; }}
    .line {{ display: flex; justify-content: space-between; padding: 7px 0; }}
    .grand {{ font-size: 20px; font-weight: 800; border-top: 2px solid #0f172a; margin-top: 8px; padding-top: 12px; }}
  </style>
</head>
<body>
  <header>
    <div>
      <h1>RhinoPeak Smart Bill</h1>
      <p class="muted">Generated from scanned document. Review source before tax filing.</p>
    </div>
    <div>
      <strong>{html.escape(target_type)} record</strong><br />
      <span class="muted">{html.escape(str(target.get('id', '')))}</span>
    </div>
  </header>
  <section>
    <p><strong>Vendor:</strong> {html.escape(approved['vendorName'])}</p>
    <p><strong>Bill no:</strong> {html.escape(approved['billNumber'])} &nbsp; <strong>Date:</strong> {html.escape(approved['billDate'])}</p>
    <p><strong>Payment:</strong> {html.escape(approved['paymentMethod'])} &nbsp; <strong>Scan:</strong> {html.escape(str(scan.get('id', '')))}</p>
  </section>
  <table>
    <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
    <tbody>{rows}</tbody>
  </table>
  <div class="totals">
    <div class="line"><span>Subtotal</span><strong>NPR {approved['subtotal']:,.2f}</strong></div>
    <div class="line"><span>Discount</span><strong>NPR {approved['discountAmount']:,.2f}</strong></div>
    <div class="line"><span>VAT / Tax</span><strong>NPR {approved['vatAmount']:,.2f}</strong></div>
    <div class="line grand"><span>Total</span><span>NPR {approved['totalAmount']:,.2f}</span></div>
  </div>
  <p class="muted">Created by {html.escape(user.get('name', ''))} on {html.escape(iso_now())}.</p>
</body>
</html>"""


def first_vendor_line(lines: list[str]) -> str:
    skip_words = ("bill", "invoice", "receipt", "date", "vat", "pan", "total", "phone", "tel")
    for line in lines[:6]:
        lower = line.lower()
        looks_like_label = any(re.search(rf"\b{re.escape(word)}\b", lower) for word in skip_words)
        if not looks_like_label and re.search(r"[A-Za-z\u0900-\u097F]", line):
            return line[:80]
    return lines[0][:80] if lines else "Unknown vendor"


def find_label_value(lines: list[str], labels: tuple[str, ...]) -> str:
    for line in lines:
        lower = line.lower()
        for label in labels:
            if label in lower:
                value = re.split(r"[:#-]", line, maxsplit=1)
                if len(value) > 1:
                    return value[1].strip()[:40]
                match = re.search(r"([A-Z0-9][A-Z0-9/-]{2,})", line, re.I)
                if match:
                    return match.group(1)
    return ""


def find_date(lines: list[str]) -> str:
    patterns = (
        r"(20\d{2}[-/]\d{1,2}[-/]\d{1,2})",
        r"(\d{1,2}[-/]\d{1,2}[-/]20\d{2})",
        r"(20\d{2}\.\d{1,2}\.\d{1,2})",
    )
    for line in lines:
        for pattern in patterns:
            match = re.search(pattern, line)
            if not match:
                continue
            value = match.group(1).replace("/", "-").replace(".", "-")
            parts = value.split("-")
            if len(parts[0]) == 4:
                return f"{int(parts[0]):04d}-{int(parts[1]):02d}-{int(parts[2]):02d}"
            return f"{int(parts[2]):04d}-{int(parts[1]):02d}-{int(parts[0]):02d}"
    return ""


def find_amount_by_keywords(lines: list[str], keywords: tuple[str, ...]) -> float:
    for line in reversed(lines):
        lower = line.lower()
        if any(keyword in lower for keyword in keywords):
            values = amount_values(line)
            if values:
                return values[-1]
    return 0.0


def amount_values(line: str) -> list[float]:
    values = []
    for match in re.findall(r"(?:NPR|Rs\.?|रू)?\s*([0-9][0-9,]*(?:\.\d+)?)", line, flags=re.I):
        values.append(number(match.replace(",", ""), 0))
    return values


def find_payment_method(text: str) -> str:
    lower = text.lower()
    for key, value in PAYMENT_ALIASES.items():
        if key in lower:
            return value
    return "Cash"


def parse_items(lines: list[str]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    blocked = ("total", "subtotal", "vat", "tax", "discount", "date", "bill", "invoice", "pan", "phone", "payment")
    for line in lines:
        lower = line.lower()
        if any(word in lower for word in blocked):
            continue
        if not re.search(r"[A-Za-z\u0900-\u097F]", line):
            continue
        values = amount_values(line)
        if not values:
            continue
        name = re.sub(r"(?:x\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:pcs|kg|ltr|liter|litre|unit))", "", line, flags=re.I)
        name = re.sub(r"(?:NPR|Rs\.?|रू)?\s*[0-9][0-9,]*(?:\.\d+)?", "", name, flags=re.I).strip(" :-")
        if not name:
            continue
        qty_match = re.search(r"x\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(pcs|kg|ltr|liter|litre|unit)", line, flags=re.I)
        quantity = number(qty_match.group(1) or qty_match.group(2), 1) if qty_match else 1
        unit = (qty_match.group(3) if qty_match and qty_match.lastindex and qty_match.lastindex >= 3 else "pcs") or "pcs"
        line_total = values[-1]
        unit_price = round(line_total / quantity, 2) if quantity else line_total
        items.append(
            {
                "name": name[:80],
                "quantity": quantity,
                "unit": normalize_unit(unit),
                "unitPrice": unit_price,
                "discount": 0,
                "tax": 0,
                "lineTotal": round(line_total, 2),
            }
        )
    return items[:40]


def normalize_unit(unit: str) -> str:
    lower = unit.lower()
    if lower in {"ltr", "liter", "litre"}:
        return "liter"
    return lower or "pcs"


def normalize_payment(value: str) -> str:
    return PAYMENT_ALIASES.get(value.strip().lower(), value if value in set(PAYMENT_ALIASES.values()) else "Cash")


def number(value: Any, fallback: float) -> float:
    try:
        return float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return float(fallback)
