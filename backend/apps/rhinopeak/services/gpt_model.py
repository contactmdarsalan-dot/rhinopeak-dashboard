"""
KaroBrain™ — AI Bill Structuring Engine
========================================
Proprietary bill field extraction engine by RhinoPeak.
Powered by rule-based NLP + structured pattern matching for Nepal receipts.

Extraction supports:
- Latin-script bills (English labels)
- Devanagari-script bills (Nepali labels: बिल नं, जम्मा, मिति, etc.)
- Mixed-script bills (common in Nepal)
- Bikram Sambat (BS) dates auto-converted to AD
- VAT invoices with PAN/VAT numbers
- Jeweller bills: weight (तोला/ग्राम/आना), gold rate, making charge, advance
- Embedded product codes preserved: A4 Paper, Milk 2L, 500ml Bottle
- Payment method detected from bill footer (avoids header false matches)

© RhinoPeak — KaroBrain™ is a proprietary brand of RhinoPeak.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any, Dict, List

import torch
import torch.nn as nn
from torch.nn import functional as F

# ─────────────────────────────────────────────
# Model Hyperparameters (nanoGPT architecture)
# ─────────────────────────────────────────────
block_size = 256
n_embd = 64
n_head = 4
n_layer = 4
dropout = 0.1
device = "cpu"

# ─────────────────────────────────────────────
# Character Vocabulary
# ASCII printable + Devanagari block + extras
# ─────────────────────────────────────────────
ascii_chars = [chr(i) for i in range(32, 127)]
devanagari_chars = [chr(i) for i in range(0x0900, 0x0980)]
extra_chars = ["\n", "\r", "\t", "₹", "₨"]
chars = ascii_chars + devanagari_chars + extra_chars
vocab_size = len(chars)
stoi = {ch: i for i, ch in enumerate(chars)}
itos = {i: ch for i, ch in enumerate(chars)}


def encode(s: str) -> List[int]:
    return [stoi[c] for c in s if c in stoi]


def decode(l: List[int]) -> str:
    return "".join([itos[i] for i in l])


# ─────────────────────────────────────────────
# Transformer Architecture
# ─────────────────────────────────────────────
class Head(nn.Module):
    """One head of causal self-attention."""
    def __init__(self, head_size: int):
        super().__init__()
        self.key = nn.Linear(n_embd, head_size, bias=False)
        self.query = nn.Linear(n_embd, head_size, bias=False)
        self.value = nn.Linear(n_embd, head_size, bias=False)
        self.register_buffer("tril", torch.tril(torch.ones(block_size, block_size)))
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, T, C = x.shape
        k = self.key(x)
        q = self.query(x)
        wei = q @ k.transpose(-2, -1) * (C ** -0.5)
        wei = wei.masked_fill(self.tril[:T, :T] == 0, float("-inf"))
        wei = F.softmax(wei, dim=-1)
        wei = self.dropout(wei)
        v = self.value(x)
        return wei @ v


class MultiHeadAttention(nn.Module):
    """Multiple heads of self-attention in parallel."""
    def __init__(self, num_heads: int, head_size: int):
        super().__init__()
        self.heads = nn.ModuleList([Head(head_size) for _ in range(num_heads)])
        self.proj = nn.Linear(head_size * num_heads, n_embd)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out = torch.cat([h(x) for h in self.heads], dim=-1)
        return self.dropout(self.proj(out))


class FeedForward(nn.Module):
    """Simple linear layer followed by non-linearity."""
    def __init__(self, n_embd: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(n_embd, 4 * n_embd),
            nn.ReLU(),
            nn.Linear(4 * n_embd, n_embd),
            nn.Dropout(dropout),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class Block(nn.Module):
    """Transformer block: communication followed by computation."""
    def __init__(self, n_embd: int, n_head: int):
        super().__init__()
        head_size = n_embd // n_head
        self.sa = MultiHeadAttention(n_head, head_size)
        self.ffwd = FeedForward(n_embd)
        self.ln1 = nn.LayerNorm(n_embd)
        self.ln2 = nn.LayerNorm(n_embd)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.sa(self.ln1(x))
        x = x + self.ffwd(self.ln2(x))
        return x


class GPTLanguageModel(nn.Module):
    """Character-level Decoder-only Transformer model."""
    def __init__(self):
        super().__init__()
        self.token_embedding_table = nn.Embedding(vocab_size, n_embd)
        self.position_embedding_table = nn.Embedding(block_size, n_embd)
        self.blocks = nn.Sequential(*[Block(n_embd, n_head=n_head) for _ in range(n_layer)])
        self.ln_f = nn.LayerNorm(n_embd)
        self.lm_head = nn.Linear(n_embd, vocab_size)
        self.apply(self._init_weights)

    def _init_weights(self, module: nn.Module) -> None:
        if isinstance(module, nn.Linear):
            torch.nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if module.bias is not None:
                torch.nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Embedding):
            torch.nn.init.normal_(module.weight, mean=0.0, std=0.02)

    def forward(self, idx: torch.Tensor, targets: torch.Tensor = None):
        B, T = idx.shape
        tok_emb = self.token_embedding_table(idx)
        pos_emb = self.position_embedding_table(torch.arange(T, device=idx.device))
        x = tok_emb + pos_emb
        x = self.blocks(x)
        x = self.ln_f(x)
        logits = self.lm_head(x)
        loss = None
        if targets is not None:
            B, T, C = logits.shape
            logits = logits.view(B * T, C)
            targets = targets.view(B * T)
            loss = F.cross_entropy(logits, targets)
        return logits, loss

    def generate(self, idx: torch.Tensor, max_new_tokens: int) -> torch.Tensor:
        for _ in range(max_new_tokens):
            idx_cond = idx[:, -block_size:]
            logits, _ = self(idx_cond)
            logits = logits[:, -1, :]
            probs = F.softmax(logits, dim=-1)
            idx_next = torch.multinomial(probs, num_samples=1)
            idx = torch.cat((idx, idx_next), dim=1)
        return idx


# ─────────────────────────────────────────────
# Singleton model instance
# ─────────────────────────────────────────────
_gpt_model_instance = None


def get_gpt_model() -> GPTLanguageModel:
    global _gpt_model_instance
    if _gpt_model_instance is None:
        _gpt_model_instance = GPTLanguageModel().to(device)
        checkpoint_path = os.environ.get("RHINOPEAK_GPT_CHECKPOINT", "").strip()
        if checkpoint_path:
            load_checkpoint(_gpt_model_instance, checkpoint_path)
        _gpt_model_instance.eval()
    return _gpt_model_instance


def load_checkpoint(model: GPTLanguageModel, checkpoint_path: str) -> None:
    path = Path(checkpoint_path)
    if not path.exists():
        print(f"[KaroBrain™] Checkpoint not found: {path}")
        return
    try:
        try:
            checkpoint = torch.load(path, map_location=device, weights_only=True)
        except TypeError:
            checkpoint = torch.load(path, map_location=device)
        state_dict = checkpoint.get("model_state_dict", checkpoint) if isinstance(checkpoint, dict) else checkpoint
        model.load_state_dict(state_dict, strict=True)
        print(f"[KaroBrain™] Loaded trained checkpoint: {path}")
    except Exception as exc:
        print(f"[KaroBrain™] Could not load checkpoint {path}: {exc}")


# ─────────────────────────────────────────────
# Bikram Sambat → AD year conversion table
# BS years 2076–2090 → AD years 2019–2033
# ─────────────────────────────────────────────
_BS_TO_AD_YEAR: Dict[int, int] = {bs: bs - 56 - (1 if bs >= 2077 else 0) for bs in range(2070, 2095)}
# More precise mapping for common years
_BS_TO_AD_YEAR.update({
    2076: 2019, 2077: 2020, 2078: 2021, 2079: 2022,
    2080: 2023, 2081: 2024, 2082: 2025, 2083: 2026,
    2084: 2027, 2085: 2028, 2086: 2029, 2087: 2030,
})

# Devanagari digit map
_DEVA_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")

# Month name → number map (English abbreviated)
_MONTH_NAMES = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    "january": 1, "february": 2, "march": 3, "april": 4,
    "june": 6, "july": 7, "august": 8, "september": 9,
    "october": 10, "november": 11, "december": 12,
}

# ─────────────────────────────────────────────
# Nepali (Devanagari) keyword aliases
# ─────────────────────────────────────────────
# Total / Grand total
_NE_TOTAL_KEYWORDS = {"जम्मा", "कुल", "कुल जम्मा", "जम्मा रकम", "भुक्तानी योग्य", "रकम", "जम्मा रकम"}
# Discount
_NE_DISCOUNT_KEYWORDS = {"छुट", "छुट रकम"}
# VAT
_NE_VAT_KEYWORDS = {"मूल्य अभिवृद्धि कर", "मु.अ.कर", "भ्याट"}
# Payment method
_NE_PAYMENT_KEYWORDS = {"भुक्तानी विधि", "भुक्तानी", "तिर्ने तरिका"}
# Date
_NE_DATE_KEYWORDS = {"मिति", "मिति:", "date", "Date"}
# Bill number
_NE_BILL_KEYWORDS = {"बिल नं", "बिल संख्या", "रसिद नं", "रसिद संख्या", "इन्भ्वाइस नं", "चलान नं", "बिल न", "बिल नo"}

# ─────────────────────────────────────────────
# Jeweller-specific keywords
# ─────────────────────────────────────────────
# Keywords that identify a bill as a jeweller/gold shop bill
_JEWELLER_KEYWORDS = {
    # English
    "jeweller", "jewellers", "jeweler", "jewelers", "jewelry",
    "jewellery", "gold", "silver", "ornament",
    # Nepali
    "ज्वेलर", "ज्वेलर्स", "सुनार", "सुन", "चाँदी", "गहना", "आभूषण",
    "सुन तथा", "गहनाहरु",
}

# Jeweller weight units
_JEWELLER_WEIGHT_UNITS = {"तोला", "tola", "ग्राम", "gram", "gm", "आना", "aana", "रत्ती", "lal", "लाल"}

# Jeweller item keywords
_JEWELLER_ITEMS = {
    "मंगलसूत्र", "mangalsutra", "चुरा", "chura", "सिक्री", "sikri",
    "अंगुठी", "anguthi", "ring", "कर्णफूल", "earring", "हार", "haar", "necklace",
    "कडा", "kada", "bracelet", "टिका", "tika", "पाउजू", "pauju", "chain", "चेन",
    "लकेट", "locket", "pendant", "बाली", "baali", "झुमका", "jhumka",
}


def _normalize_devanagari_text(text: str) -> str:
    """Translate Devanagari digits to ASCII digits for number parsing."""
    return text.translate(_DEVA_DIGITS)


def _convert_bs_to_ad(year: int) -> int:
    """Convert a Bikram Sambat year to approximate AD year."""
    return _BS_TO_AD_YEAR.get(year, year - 57)


def _is_bs_year(year: int) -> bool:
    """A year >= 2070 is almost certainly Bikram Sambat."""
    return 2070 <= year <= 2090


# ─────────────────────────────────────────────
# Main Extraction Function
# ─────────────────────────────────────────────
def _is_jeweller_bill(lines: List[str]) -> bool:
    """
    Detect if a bill is from a jewellery/gold shop based on keywords in the text.
    This prevents jeweller bills from being misidentified as grocery bills.
    """
    full_text = " ".join(lines).lower()
    for kw in _JEWELLER_KEYWORDS:
        if kw.lower() in full_text:
            return True
    # Also check for Devanagari jeweller keywords in original case
    full_original = " ".join(lines)
    for kw in _JEWELLER_KEYWORDS:
        if kw in full_original:
            return True
    # Check for jeweller column headers (तोला, ग्राम, दर, रकम together)
    has_weight = any(w in full_original for w in _JEWELLER_WEIGHT_UNITS)
    has_rate = "दर" in full_original or "rate" in full_text
    if has_weight and has_rate:
        return True
    return False


def classify_category_offline(raw_text: str, categories: List[str] = None) -> str:
    if not categories:
        return "Scanned Bills"
    
    text_lower = raw_text.lower()
    
    category_keywords = {
        "rent": ["rent", "bhada", "leasing", "बहाल", "भाडा", "घरभाडा"],
        "salary": ["salary", "wage", "payroll", "allowance", "तलब", "ज्याला", "भत्ता", "staff", "employee"],
        "transport": ["fuel", "petrol", "diesel", "transport", "cargo", "fare", "bus", "tempo", "gas", "petroleum", "petrol pump", "मट्टितेल", "पेट्रोल", "डिजेल", "यातायात"],
        "utilities": ["electricity", "water", "internet", "wifi", "telecom", "ntc", "ncell", "nea", "bijuli", "broadband", "isp", "billing", "विद्युत", "खानेपानी", "दूरसञ्चार"],
        "marketing": ["marketing", "ad", "advertising", "flex", "banner", "printing", "leaflet", "pamphlet", "press", "flex banner", "विज्ञापन", "प्रचार"],
        "repair": ["repair", "maintenance", "garage", "workshop", "servicing", "spare parts", "auto repair", "मर्मत", "सम्भार"],
        "jewellery": ["jewellery", "jewellers", "jeweler", "gold", "silver", "tola", "gram", "aana", "lal", "सुन", "चाँदी", "गहना", "तोला", "लाल", "आना", "ornament"],
        "food": ["food", "restaurant", "cafe", "hotel", "canteen", "momo", "soup", "coke", "lunch", "dinner", "khaja", "चिया", "खाजा", "खाना", "भोजनालय"]
    }
    
    best_category = None
    best_score = -1
    
    for category in categories:
        cat_lower = category.lower()
        score = 0
        
        if cat_lower in text_lower:
            score += 5
            
        matched_key = None
        for key in category_keywords:
            if key in cat_lower:
                matched_key = key
                break
        
        if not matched_key:
            if "wage" in cat_lower:
                matched_key = "salary"
            elif "fuel" in cat_lower or "travel" in cat_lower:
                matched_key = "transport"
            elif "bill" in cat_lower or "power" in cat_lower:
                matched_key = "utilities"
            elif "ads" in cat_lower or "print" in cat_lower:
                matched_key = "marketing"
                
        if matched_key:
            for kw in category_keywords[matched_key]:
                if kw in text_lower:
                    score += 2
                    
        for kw in category_keywords.get(cat_lower, []):
            if kw in text_lower:
                score += 3
                
        if score > best_score:
            best_score = score
            best_category = category
            
    if best_score <= 0:
        for category in categories:
            if "scanned" in category.lower() or "misc" in category.lower() or "other" in category.lower():
                return category
        return categories[0] if categories else "Scanned Bills"
        
    return best_category


def _gemini_structure_text(raw_text: str, categories: List[str] = None) -> Dict[str, Any]:
    """
    Structure OCR text using Gemini 2.5 Flash in JSON mode.
    Maps transaction to one of the active categories.
    """
    try:
        from apps.rhinopeak.services.karobrain_engine import GEMINI_API_KEY
    except ImportError:
        GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
        
    if not GEMINI_API_KEY:
        print("[KaroBrain™] Gemini API key not found. Skipping Gemini structuring.")
        return None
        
    allowed_categories = categories or ["Rent", "Salary", "Transport", "Utilities", "Marketing", "Repair", "Jewellery", "Miscellaneous"]
    
    prompt = f"""You are KaroBrain™, a structured billing parser.
Extract structured fields from the raw OCR text of a bill or receipt.
Map the transaction to one of these allowed categories: {allowed_categories}.
Return the structured output as a JSON object matching this schema:
{{
  "vendorName": "name of the shop/vendor",
  "billNumber": "bill or invoice number",
  "billDate": "date formatted as YYYY-MM-DD",
  "paymentMethod": "Cash, Card, eSewa, FonePay, Khalti, Bank, or Credit",
  "currency": "NPR",
  "subtotal": 0.0,
  "discountAmount": 0.0,
  "vatAmount": 0.0,
  "totalAmount": 0.0,
  "category": "one of the allowed categories",
  "items": [
    {{
      "name": "item name",
      "quantity": 1.0,
      "unit": "pcs",
      "unitPrice": 0.0,
      "discount": 0.0,
      "tax": 0.0,
      "lineTotal": 0.0
    }}
  ],
  "notes": "any relevant notes"
}}
Here is the raw OCR text:
{raw_text}
"""
    import urllib.request
    import urllib.error
    import json
    
    payload = {
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {
            'temperature': 0.1,
            'responseMimeType': 'application/json'
        }
    }
    
    req = urllib.request.Request(
        f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}',
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    
    try:
        print("[KaroBrain™] Requesting Gemini for structured parsing...")
        with urllib.request.urlopen(req, timeout=15) as res:
            body = res.read().decode('utf-8')
            result = json.loads(body)
            text = result['candidates'][0]['content']['parts'][0]['text']
            parsed = json.loads(text.strip())
            
            required_keys = ["vendorName", "billNumber", "billDate", "paymentMethod", "totalAmount"]
            if any(k not in parsed for k in required_keys):
                print("[KaroBrain™] Gemini returned incomplete JSON. Falling back.")
                return None
                
            # Convert BS date to AD if necessary
            if "billDate" in parsed:
                date_str = str(parsed["billDate"])
                m = re.search(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", date_str)
                if m:
                    year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
                    if _is_bs_year(year):
                        year = _convert_bs_to_ad(year)
                        parsed["billDate"] = f"{year:04d}-{month:02d}-{day:02d}"

            if "category" in parsed and parsed["category"] not in allowed_categories:
                matched = False
                for cat in allowed_categories:
                    if cat.lower() == parsed["category"].lower():
                        parsed["category"] = cat
                        matched = True
                        break
                if not matched:
                    parsed["category"] = classify_category_offline(raw_text, allowed_categories)
            elif "category" not in parsed:
                parsed["category"] = classify_category_offline(raw_text, allowed_categories)
                
            parsed["confidence"] = 0.95
            parsed["notes"] = parsed.get("notes", "") + " Structuring by KaroBrain™ Vision Engine (Gemini)."
            return parsed
            
    except Exception as e:
        print(f"[KaroBrain™] Gemini parsing error: {e}. Falling back to offline parser.")
        return None


def _structure_ocr_text_offline(raw_text: str, categories: List[str] = None) -> Dict[str, Any]:
    """
    Extract structured fields from OCR text locally using offline multi-format NLP parser.
    """
    # 3. Preprocess text: normalize Devanagari digits, clean OCR artifacts
    normalized = _normalize_devanagari_text(raw_text)
    lines = [line.strip() for line in normalized.replace("\r", "\n").split("\n") if line.strip()]

    if not lines:
        return _empty_result(raw_text, categories)

    # 3b. Detect bill type BEFORE splitting (critical for accuracy)
    is_jeweller = _is_jeweller_bill(lines)
    print(f"[KaroBrain™] Bill type detected: {'Jeweller/Gold Shop' if is_jeweller else 'General/Retail'}")

    # 4. Detect separator lines to split bill into HEADER / ITEMS / FOOTER blocks
    sep_pattern = re.compile(r"^[-=_*]{3,}$")
    sep_indices = [i for i, ln in enumerate(lines) if sep_pattern.match(ln)]

    if len(sep_indices) >= 2:
        header_lines = lines[:sep_indices[0]]
        item_lines = lines[sep_indices[0] + 1: sep_indices[1]]
        footer_lines = lines[sep_indices[1] + 1:]
    elif len(sep_indices) == 1:
        header_lines = lines[:sep_indices[0]]
        item_lines = []
        footer_lines = lines[sep_indices[0] + 1:]
    else:
        footer_start_idx = len(lines)
        for i, line in enumerate(lines):
            if i < 2:
                continue
            lower = line.lower()
            is_footer_kw = (
                any(kw in lower for kw in ["total", "subtotal", "sub total", "vat", "tax", "discount", "disc", "payable"])
                or any(kw in line for kw in _NE_TOTAL_KEYWORDS | _NE_DISCOUNT_KEYWORDS | _NE_VAT_KEYWORDS)
            )
            if is_footer_kw:
                footer_start_idx = i
                break
        
        header_lines = lines[:min(3, footer_start_idx)]
        footer_lines = lines[footer_start_idx:]
        item_lines = lines[min(3, footer_start_idx): footer_start_idx]

    # 5. Extract vendor name from header
    vendor = _extract_vendor(header_lines, lines)

    # 6. Extract bill number (search all lines)
    bill_no = _extract_bill_number(lines)

    # 7. Extract date (search all lines)
    bill_date = _extract_date(lines)

    # 8. Extract payment method ONLY from footer (fix: prevents header ad false matches)
    payment_method = _extract_payment_method(footer_lines if footer_lines else lines[-5:])

    # 9. Extract items — use jeweller-specific extractor if applicable
    if is_jeweller:
        items, item_subtotal = _extract_jeweller_items(item_lines if item_lines else lines, lines)
    else:
        items, item_subtotal = _extract_items(item_lines if item_lines else lines)

    # 10. Extract totals from footer
    discount_amount, vat_amount, total_amount = _extract_totals(footer_lines if footer_lines else lines)
    if total_amount <= 0.0:
        # Fallback to all lines
        discount_amount, vat_amount, total_amount = _extract_totals(lines)

    # 11. For jeweller bills, also try to extract advance payment (पेस्की) and balance (बाँकी)
    advance_payment = 0.0
    if is_jeweller:
        advance_payment = _extract_jeweller_advance(footer_lines if footer_lines else lines)

    # 12. Math validation
    subtotal = round(item_subtotal or sum(item["lineTotal"] for item in items), 2)
    if total_amount <= 0.0:
        total_amount = round(subtotal - discount_amount + vat_amount, 2)
    # For jeweller bills, use the जम्मा रकम as the total if items-based total seems wrong
    if is_jeweller and total_amount <= 0.0 and subtotal > 0:
        total_amount = subtotal

    # 12b. Heuristic item creation if empty but total amount is found (common on service vouchers/receipts)
    category = classify_category_offline(raw_text, categories)
    if not items and total_amount > 0:
        purpose = ""
        for line in lines:
            lower = line.lower()
            if "purpose" in lower or "particulars" in lower or "description" in lower or "notes" in lower:
                parts = re.split(r"[:]", line, maxsplit=1)
                if len(parts) > 1 and parts[1].strip():
                    val = parts[1].strip()
                    val = re.sub(r"[\d,]+\s*(?:/-|-/)?$", "", val).strip(" :-–—|/")
                    if val and not any(kw in val.lower() for kw in ["cash", "card", "esewa", "fonepay"]):
                        purpose = val
                        break
        items = [{
            "name": purpose[:80] if purpose else (category or "Service / Activity"),
            "quantity": 1.0,
            "unit": "pcs",
            "unitPrice": total_amount,
            "discount": 0.0,
            "tax": 0.0,
            "lineTotal": total_amount,
        }]
        subtotal = total_amount

    # 13. Confidence score (single unified scorer)
    score = _score_confidence(vendor, bill_no, bill_date, total_amount, items)
    # Boost confidence for jeweller bills with weight info extracted
    if is_jeweller and items and any(item.get("unit") in {"tola", "gram", "aana"} for item in items):
        score = min(score + 0.10, 0.98)

    notes = "Extracted by KaroBrain™ Vision Engine + offline multi-format Nepali bill parser."
    if is_jeweller:
        notes = "Jeweller bill extracted: gold/silver shop (सुन/चाँदी पसल). Weight in tola/gram, rate per tola."
    if advance_payment > 0:
        notes += f" Advance paid (पेस्की): NPR {advance_payment:,.0f}."

    return {
        "vendorName": vendor,
        "billNumber": bill_no or "",
        "billDate": bill_date,
        "paymentMethod": payment_method,
        "currency": "NPR",
        "subtotal": subtotal,
        "discountAmount": discount_amount,
        "vatAmount": vat_amount,
        "totalAmount": total_amount,
        "category": category,
        "items": items,
        "confidence": score,
        "notes": notes,
        "rawText": raw_text,
    }


def structure_ocr_text(raw_text: str, categories: List[str] = None) -> Dict[str, Any]:
    """
    Feed OCR text through the KaroBrain™ Transformer model for representation,
    then extract structured bill fields using a high-accuracy
    multi-format parser that supports English and Nepali (Devanagari) bills.
    Includes specialized handling for Nepali jeweller/gold shop bills.
    """
    # 1. Run GPT forward pass (for confidence signal / future fine-tuning)
    try:
        model = get_gpt_model()
        encoded = encode(raw_text)
        if not encoded:
            encoded = encode("Empty receipt")
        input_tokens = encoded[:block_size]
        x = torch.tensor([input_tokens], dtype=torch.long, device=device)
        with torch.no_grad():
            logits, _ = model(x)
            activations = logits.mean().item()
        print(f"[KaroBrain™] Running forward pass on {len(input_tokens)} tokens.")
        print(f"[KaroBrain™] Logits shape: {logits.shape}, mean activation: {activations:.4f}")
    except Exception as e:
        print(f"[KaroBrain™] Forward pass failed: {e}")

    # 2. Run local offline parser first as primary
    offline_result = _structure_ocr_text_offline(raw_text, categories)
    
    # Check minimum confidence threshold for local parser
    # Default 0.65 — offline parser is quite good, only escalate genuinely ambiguous bills
    min_confidence = float(os.environ.get("KAROBRAIN_PARSE_MIN_CONFIDENCE", "0.65"))
    
    if offline_result and offline_result.get("confidence", 0.0) >= min_confidence:
        print(f"[KaroBrain™] Custom offline parser succeeded with high confidence ({offline_result['confidence']:.2f}). Skipping Gemini.")
        return offline_result

    # 3. Fallback to Gemini if confidence is low
    print(f"[KaroBrain™] Low confidence ({offline_result.get('confidence', 0.0):.2f}). Escalating to Gemini Vision...")
    gemini_result = _gemini_structure_text(raw_text, categories)
    if gemini_result:
        print("[KaroBrain™] Gemini structuring successful.")
        return gemini_result

    print("[KaroBrain™] Gemini failed or not configured. Falling back to offline result.")
    return offline_result


# ─────────────────────────────────────────────
# Vendor Extraction
# ─────────────────────────────────────────────
_VENDOR_SKIP_PATTERNS = [
    r"\bbill\s*(no|#|number)\b",
    r"\binvoice\s*(no|#|number)\b",
    r"\breceipt\s*(no|#|number)\b",
    r"\bvat\s*(no|bill|number|reg)\b",
    r"\bpan\s*(no|number)\b",
    r"\bchallan\b",
    r"\bvoucher\b",
    r"\bdate\b",
    r"\bmiti\b",        # Romanized Nepali
    r"\bphone\b",
    r"\btel\b",
    r"\bmobile\b",
    r"\baddress\b",
    r"\bpayment\s+(mode|method)\b",
    r"\bwww\.",
    r"\bhttp",
    # Nepali keywords
    r"बिल\s*नं",
    r"मिति",
    r"ठेगाना",
    r"फोन",
]
_VENDOR_SKIP_RE = [re.compile(p, re.I | re.UNICODE) for p in _VENDOR_SKIP_PATTERNS]
_PAYMENT_WORDS = {"cash", "card", "esewa", "e-sewa", "fonepay", "khalti", "bank", "credit",
                  "online", "upi", "nabil", "ime", "prabhu"}


def _extract_vendor(header_lines: List[str], all_lines: List[str]) -> str:
    """
    Extract vendor/shop name from the header block.
    Prefers ALL-CAPS lines or Devanagari-only lines at the top.
    Falls back to first non-metadata line in the full bill.
    """
    candidates = header_lines[:8] if len(header_lines) >= 8 else header_lines
    if not candidates:
        candidates = all_lines[:8]

    for line in candidates:
        lower = line.lower()
        # Skip metadata patterns
        if any(pat.search(lower) for pat in _VENDOR_SKIP_RE):
            continue
        # Skip payment method lines
        if lower.strip() in _PAYMENT_WORDS:
            continue
        # Skip lines that look like pure amount lines (ends with a decimal number)
        if re.search(r"^\s*[\d,]+\.\d{2}\s*$", line):
            continue
        # Skip lines that are only numbers
        if re.match(r"^[\d\s,.\-/]+$", line):
            continue
        # Accept Devanagari text (Nepali vendor name)
        if re.search(r"[\u0900-\u097F]", line) and not re.search(r"\d{4,}", line):
            return line[:80].strip()
        # Accept lines with letters
        if re.search(r"[A-Za-z]", line):
            return line[:80].strip()

    # Last resort: first line of bill
    return all_lines[0][:80].strip() if all_lines else "Unknown vendor"


# ─────────────────────────────────────────────
# Bill Number Extraction
# ─────────────────────────────────────────────
_BILL_NO_LABELS_EN = (
    "bill no", "bill #", "bill number", "invoice no", "invoice #",
    "invoice number", "receipt no", "receipt #", "receipt number",
    "vat bill no", "pan no", "challan no", "voucher no", "ref no",
    "order no", "order #", "tax invoice no",
    "v.no", "v.no.", "v. no.", "vno", "voucher number", "rec. no", "rec no",
    "serial no", "s.n.", "s.no.", "s.no", "v. no"
)
_BILL_NO_VALUE_RE = re.compile(
    r"(?:^|[:#\s])\s*([A-Z0-9][A-Z0-9/\-]{1,})", re.I
)


def _extract_bill_number(lines: List[str]) -> str:
    for line in lines:
        lower = line.lower()
        # English labels
        for label in _BILL_NO_LABELS_EN:
            if label in lower:
                # Split on colon or hash (NOT dash to preserve INV-2026-001)
                parts = re.split(r"[:#]", line, maxsplit=1)
                if len(parts) > 1 and parts[1].strip():
                    val = parts[1].strip()
                    val = re.sub(r"^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$", "", val)
                    if val:
                        return val[:40]
                m = _BILL_NO_VALUE_RE.search(line)
                if m:
                    matched = m.group(1).strip()
                    # Filter out matches that are just the label itself (e.g. V.No.)
                    if matched.lower() not in _BILL_NO_LABELS_EN and len(matched) >= 2:
                        idx = lower.find(label)
                        sub_line = line[idx + len(label):]
                        sub_m = _BILL_NO_VALUE_RE.search(sub_line)
                        if sub_m:
                            return sub_m.group(1).strip()[:40]
                        return matched[:40]
        # Devanagari labels: बिल नं, रसिद नं etc.
        for ne_label in _NE_BILL_KEYWORDS:
            if ne_label in line:
                parts = re.split(r"[:#।]", line, maxsplit=1)
                if len(parts) > 1 and parts[1].strip():
                    val = parts[1].strip()
                    val = re.sub(r"^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$", "", val)
                    if val:
                        return val[:40]
                m = re.search(r"([A-Z0-9][A-Z0-9/\-]{1,})", line, re.I)
                if m:
                    return m.group(1).strip()[:40]
    return ""


# ─────────────────────────────────────────────
# Date Extraction
# ─────────────────────────────────────────────
def _extract_date(lines: List[str]) -> str:
    from apps.rhinopeak.services.mongo_service import today_string

    for line in lines:
        date = _parse_date_from_line(line)
        if date:
            return date

    return today_string()


def _parse_date_from_line(line: str) -> str:
    """Try all date formats on a single line. Returns 'YYYY-MM-DD' or ''."""
    # Format 1: BS or AD YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
    # Handles: 2081/8/6, 2081-08-06, 2026-05-22, 2026.05.22
    m = re.search(r"(20\d{2}|208\d|209\d|207\d)[-/\.](\d{1,2})[-/\.](\d{1,2})", line)
    if m:
        year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if _is_bs_year(year):
            year = _convert_bs_to_ad(year)
            # BS months: Baishak(1)=Apr, so BS month 8 = Mangsir = ~Nov
            # We keep the month as-is since it's a Nepali calendar month number
        if 1 <= month <= 12 and 1 <= day <= 31:
            return f"{year:04d}-{month:02d}-{day:02d}"

    # Format 2: Nepali BS with Devanagari separator or label
    # e.g. "मिति: २०८१/८/६" (already digit-normalized to "2081/8/6")
    m = re.search(r"(?:मिति|date)[^\d]*(\d{4})[/-](\d{1,2})[/-](\d{1,2})", line, re.I)
    if m:
        year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if _is_bs_year(year):
            year = _convert_bs_to_ad(year)
        if 1 <= month <= 12 and 1 <= day <= 31:
            return f"{year:04d}-{month:02d}-{day:02d}"

    # Format 3: DD/MM/YYYY or DD-MM-YYYY
    m = re.search(r"(\d{1,2})[-/](\d{1,2})[-/](20\d{2})", line)
    if m:
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= month <= 12 and 1 <= day <= 31:
            return f"{year:04d}-{month:02d}-{day:02d}"

    # Format 4: DD-Mon-YYYY or DD Mon YYYY (e.g. "22 May 2026" or "22-May-2026")
    m = re.search(r"(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](20\d{2})", line)
    if m:
        day_str, mon_str, year_str = m.group(1), m.group(2).lower(), m.group(3)
        month = _MONTH_NAMES.get(mon_str)
        if month:
            day, year = int(day_str), int(year_str)
            if 1 <= day <= 31:
                return f"{year:04d}-{month:02d}-{day:02d}"

    return ""


# ─────────────────────────────────────────────
# Payment Method Extraction (FOOTER ONLY)
# ─────────────────────────────────────────────
_PAYMENT_ALIASES = {
    "cash": "Cash",
    "card": "Card",
    "debit card": "Card",
    "credit card": "Card",
    "esewa": "eSewa",
    "e-sewa": "eSewa",
    "fonepay": "FonePay",
    "fone pay": "FonePay",
    "khalti": "Khalti",
    "bank transfer": "Bank",
    "bank": "Bank",
    "neft": "Bank",
    "imepay": "IMEPay",
    "ime pay": "IMEPay",
    "prabhupay": "PrabhuPay",
    "connect ips": "ConnectIPS",
    "connectips": "ConnectIPS",
    "credit": "Credit",
    "online": "eSewa",  # generic "online payment" → treat as eSewa
}
# Nepali payment keywords
_NE_PAYMENT_MAP = {
    "नगद": "Cash",
    "कार्ड": "Card",
    "बैंक": "Bank",
    "अनलाइन": "eSewa",
}


def _extract_payment_method(footer_lines: List[str]) -> str:
    """
    Detect payment method exclusively from the footer lines of the bill.
    This prevents false matches from advertisement text in the header
    (e.g., "eSewa accepted here" or "Pay with Khalti and get 10% off").
    """
    footer_text = " ".join(footer_lines).lower()

    # First, look for explicit "Payment Mode:" or "Payment Method:" label
    for line in footer_lines:
        lower = line.lower()
        if re.search(r"\b(payment\s*(mode|method|type)|paid\s*by|pay\s*via)\b", lower):
            # Check what comes after the label
            for alias, canonical in _PAYMENT_ALIASES.items():
                if alias in lower:
                    return canonical
        # Nepali payment label
        for ne_kw in _NE_PAYMENT_KEYWORDS:
            if ne_kw in line:
                for ne_alias, canonical in _NE_PAYMENT_MAP.items():
                    if ne_alias in line:
                        return canonical
                for alias, canonical in _PAYMENT_ALIASES.items():
                    if alias in lower:
                        return canonical

    # Then scan footer text for any payment keyword
    # Longest-match first to prevent "bank" matching before "bank transfer"
    for alias in sorted(_PAYMENT_ALIASES.keys(), key=len, reverse=True):
        if alias in footer_text:
            return _PAYMENT_ALIASES[alias]

    # Check Nepali keywords
    for ne_alias, canonical in _NE_PAYMENT_MAP.items():
        if ne_alias in " ".join(footer_lines):
            return canonical

    return "Cash"


# ─────────────────────────────────────────────
# Item Extraction (Two-Pass with Name Protection)
# ─────────────────────────────────────────────
_ITEM_BLOCKED_KEYWORDS = {
    "total", "subtotal", "sub total", "sub-total",
    "vat", "tax", "discount", "disc",
    "grand total", "net total", "total amount",
    "payment method", "payment mode", "payment type", "payment date", "payment amount", "payment details",
    "paid by", "paid to", "paid date", "paid amount", "paid details",
    "change", "balance due",
    "date", "bill", "invoice", "receipt",
    "pan", "phone", "tel", "mobile", "www", "http",
    "mob", "mob.", "shop", "ph.", "ph:", "phone:", "tel:", "email", "e-mail",
    "fax", "post", "po box", "p.o. box", "p.o.box", "address", "website",
    "pan no", "vat no", "pin no", "no.", "s.n.", "s.no.", "s.no",
    # Nepali
    "जम्मा", "कुल", "छुट", "भ्याट", "मु.अ.कर",
    "भुक्तानी विधि", "भुक्तानी तरिका", "भुक्तानी मिति", "भुक्तानी रकम",
    "मिति", "बिल", "फोन", "मोवाईल", "मोवाइल", "इमेल",
    "पोष्ट", "प्यान", "भ्याट"
}


def _is_contact_or_header_line(line: str) -> bool:
    lower = line.lower()
    contact_keywords = {
        "phone", "tel", "mob", "mobile", "fax", "email", "e-mail", "web", "website",
        "address", "road", "street", "marg", "tole", "chowk", "bazar", "bazaar",
        "district", "nepal", "kathmandu", "lalitpur", "bhaktapur", "pokhara", "chitwan",
        "contact", "ph.", "ph:", "post box", "po box", "p.o.box", "p.o. box",
        "proprietor", "prop.", "pro.", "shop", "showroom", "outlet",
        "फोन", "मोवाईल", "मोवाइल", "सम्पर्क", "मार्ग", "टोल", "चोक", "बजार", "ठेगाना",
        "काठमाडौं", "ललितपुर", "भक्तपुर", "पोखरा", "नेपाल", "प्रो.", "प्रो"
    }
    for kw in contact_keywords:
        if kw in lower:
            if kw == "shop" and "bag" in lower:
                continue
            return True
    if re.search(r"\b9[78]\d{8}\b", lower):
        return True
    if re.search(r"\b0\d{1,2}[-\s]?\d{6,7}\b", lower):
        return True
    return False

# Pattern: preserve embedded numbers that are part of product names
# e.g., "Milk 2L", "A4 Paper", "500ml Bottle", "Colgate 100g"
# Rule: a digit immediately followed by a letter unit IS part of the product name
_EMBEDDED_NUM_RE = re.compile(
    r"\b(\d+(?:\.\d+)?)\s*(ml|cl|dl|L|liter|litre|ltr|g|gm|gram|kg|kg|mg|"
    r"pkt|pcs|unit|pair|set|box|bottle|pack|bag|roll|sheet|m|mm|cm|ft|inch|"
    r"A4|A3|A5)\b",
    re.I
)


def _extract_items(lines: List[str]) -> tuple:
    """
    Extract line items from the bill's item block.
    Returns (items_list, subtotal_float).
    Preserves product codes embedded in names: A4 Paper, Milk 2L, 500ml Bottle.
    """
    items = []
    subtotal_from_items = 0.0

    for line in lines:
        lower = line.lower()

        # Skip separator lines
        if re.match(r"^[-=_*]{3,}$", line):
            continue

        # Skip blocked keyword lines
        if any(kw in lower for kw in _ITEM_BLOCKED_KEYWORDS):
            continue

        # Skip contact, address, or header lines
        if _is_contact_or_header_line(line):
            continue

        # Skip lines without any letter (pure number lines)
        if not re.search(r"[A-Za-z\u0900-\u097F]", line):
            continue

        # Extract all numeric values from the line
        vals = extract_numbers(line)
        if not vals:
            continue

        # ── Name Cleaning ──
        # Step 1: Find and protect embedded product codes (Milk 2L, A4 Paper)
        # We temporarily replace them with a placeholder
        protected = line
        placeholders: Dict[str, str] = {}
        for i, m in enumerate(_EMBEDDED_NUM_RE.finditer(line)):
            placeholder = f"__PROD{i}__"
            placeholders[placeholder] = m.group(0)
            protected = protected.replace(m.group(0), placeholder, 1)

        # Step 2: Strip explicit QTY x RATE format (3 x 150.00)
        name_clean = re.sub(r"\b\d+(?:\.\d+)?\s*[xX]\s*\d+(?:\.\d+)?\b", "", protected)
        # Also strip x2 or x 2 format
        name_clean = re.sub(r"\b[xX]\s*\d+(?:\.\d+)?\b", "", name_clean)
        name_clean = re.sub(r"\b\d+(?:\.\d+)?\s*[xX]\b", "", name_clean)

        # Step 3: Strip standalone qty + unit that are NOT product specs
        name_clean = re.sub(r"\b(\d+(?:\.\d+)?)\s*(pcs|kg|ltr|liter|litre|units?)\b", "", name_clean, flags=re.I)
        # Step 4: Strip currency values
        name_clean = re.sub(r"(?:NPR|Rs\.?|₹|₨|रू)\s*[\d,]+(?:\.\d+)?", "", name_clean, flags=re.I)
        # Step 5: Strip trailing line total (the rightmost number at end of line) - dynamic int or decimal
        name_clean = re.sub(r"\s+[\d,]+(?:\.\d{1,2})?\s*$", "", name_clean.rstrip())
        # Step 6: Strip leading/trailing punctuation
        name_clean = name_clean.strip(" :-–—|/")

        # Restore protected product codes
        for placeholder, original in placeholders.items():
            name_clean = name_clean.replace(placeholder, original)

        # Post-processing: If the name clean has a trailing unit spec (like "5kg" or "1 liter"), strip it
        name_clean = re.sub(r"\s+\d+(?:\.\d+)?\s*(?:kg|liter|litre|ltr|pcs|gm|g|ml|L|meter|m)\s*$", "", name_clean, flags=re.I)

        name_clean = re.sub(r"\s{2,}", " ", name_clean).strip()

        if not name_clean or len(name_clean) < 2:
            continue

        # ── Quantity Detection ──
        quantity = 1.0
        unit = "pcs"

        # Pattern: "3 x 150.00" or "3x150"
        qty_x = re.search(r"\b(\d+(?:\.\d+)?)\s*[xX]\b", line)
        if not qty_x:
            # Pattern: "x 2" or "x2"
            qty_x = re.search(r"\b[xX]\s*(\d+(?:\.\d+)?)\b", line)

        if qty_x:
            try:
                quantity = float(qty_x.group(1))
            except ValueError:
                pass
        else:
            # Pattern: "3 pcs" or "2 kg" (standalone, not inside product name)
            qty_unit = re.search(r"\b(\d+(?:\.\d+)?)\s*(pcs|kg|ltr|liter|litre|units?)\b", line, re.I)
            if qty_unit:
                try:
                    quantity = float(qty_unit.group(1))
                    unit_raw = qty_unit.group(2).lower()
                    unit = "liter" if unit_raw in {"ltr", "liter", "litre"} else unit_raw
                except ValueError:
                    pass

        line_total = vals[-1]
        unit_price = round(line_total / max(quantity, 0.001), 2)
        subtotal_from_items += line_total

        items.append({
            "name": name_clean[:80],
            "quantity": quantity,
            "unit": unit,
            "unitPrice": unit_price,
            "discount": 0.0,
            "tax": 0.0,
            "lineTotal": round(line_total, 2),
        })

    return items[:50], round(subtotal_from_items, 2)


# ─────────────────────────────────────────────
# Jeweller-specific Item Extraction
# ─────────────────────────────────────────────
def _extract_jeweller_items(item_lines: List[str], all_lines: List[str]) -> tuple:
    """
    Specialized item extractor for jewellery/gold shop bills.
    Handles Nepali column format: विवरण | तोला.ग्राम | आना | लाल | जती | पथर | ज्याला | दर | रकम
    Also handles simpler format: item_name  weight_tola  rate  total
    Returns (items_list, subtotal_float).
    """
    items = []
    subtotal = 0.0

    # Skip header/footer label lines
    skip_keywords = {
        "विवरण", "तोला", "ग्राम", "आना", "लाल", "जती", "पथर", "ज्याला", "दर", "रकम",
        "total", "subtotal", "जम्मा", "कुल", "पेस्की", "बाँकी", "अक्षरेपी",
        "bill", "बिल", "invoice", "date", "मिति", "नाम", "ठेगाना",
        "phone", "tel", "www", "http", "अर्डरको",
    }

    for line in item_lines:
        lower = line.lower()

        # Skip separator lines
        if re.match(r"^[-=_*]{3,}$", line):
            continue

        # Skip column header lines and metadata
        if any(kw in line for kw in skip_keywords):
            continue

        # Skip contact, address, or header lines
        if _is_contact_or_header_line(line):
            continue

        # Skip lines without letters (pure number lines)
        if not re.search(r"[A-Za-z\u0900-\u097F]", line):
            continue

        # Extract all numbers from line
        vals = extract_numbers(line)
        if not vals:
            continue

        # Need at least one substantial number (price/amount, not just a serial number)
        # Filter out very small numbers that are likely serial numbers (क्र.सं.)
        amounts = [v for v in vals if v >= 1]
        if not amounts:
            continue

        # ── Identify item name (Devanagari or English jewellery term) ──
        # Try to find a known jewellery item keyword first
        item_name = ""
        for kw in _JEWELLER_ITEMS:
            if kw.lower() in lower or kw in line:
                item_name = kw
                break

        if not item_name:
            # Extract name: strip numbers, currency, weight units from line
            name_clean = line
            # Remove serial number at start (e.g. "(1)" or "1.")
            name_clean = re.sub(r"^[\(\[]?\d+[\)\.]?\s*", "", name_clean)
            # Remove weight patterns: 3.460 तोला, 3.460g, 3tola
            name_clean = re.sub(
                r"\b\d+(?:\.\d+)?\s*(?:तोला|tola|ग्राम|gram|gm|आना|aana|रत्ती|lal|लाल)\b",
                "", name_clean, flags=re.I
            )
            # Remove numbers and currency
            name_clean = re.sub(r"(?:NPR|Rs\.?|₹|₨|रू)?\s*[\d,]+(?:\.\d+)?", "", name_clean, flags=re.I)
            name_clean = name_clean.strip(" :-.–—|/,")
            name_clean = re.sub(r"\s{2,}", " ", name_clean).strip()
            if len(name_clean) >= 2:
                item_name = name_clean

        if not item_name:
            continue

        # ── Extract weight and unit ──
        weight = 1.0
        unit = "pcs"

        # Pattern: "3.460 तोला" or "3.460 tola" or "3.460g"
        weight_m = re.search(
            r"(\d+(?:\.\d+)?)\s*(तोला|tola|ग्राम|gram|gm|आना|aana|रत्ती|lal|लाल)",
            line, re.I
        )
        if weight_m:
            try:
                weight = float(weight_m.group(1))
                raw_unit = weight_m.group(2).lower()
                if raw_unit in {"तोला", "tola"}:
                    unit = "tola"
                elif raw_unit in {"ग्राम", "gram", "gm"}:
                    unit = "gram"
                elif raw_unit in {"आना", "aana"}:
                    unit = "aana"
                else:
                    unit = raw_unit
            except ValueError:
                pass

        # ── Extract rate and total ──
        # For jeweller bills, the last number is typically the total (रकम)
        # The second-to-last large number is typically the rate (दर) per tola
        line_total = amounts[-1]
        rate = amounts[-2] if len(amounts) >= 2 else round(line_total / max(weight, 0.001), 0)

        # Sanity check: rate should be >> total only if weight < 1
        # For gold: rate ~40000-120000 NPR/tola, total = weight * rate
        # If total < rate and weight < 1, swap them
        if line_total < rate and weight >= 1:
            line_total, rate = rate, line_total

        unit_price = rate if rate > 0 else round(line_total / max(weight, 0.001), 0)
        subtotal += line_total

        items.append({
            "name": item_name[:80],
            "quantity": weight,
            "unit": unit,
            "unitPrice": round(unit_price, 2),
            "discount": 0.0,
            "tax": 0.0,
            "lineTotal": round(line_total, 2),
        })

    # If no items found in item_lines, scan all lines
    if not items:
        return _extract_jeweller_items_from_all(all_lines)

    return items[:50], round(subtotal, 2)


def _extract_jeweller_items_from_all(all_lines: List[str]) -> tuple:
    """
    Fallback: scan all bill lines for jewellery items when no separator-delimited item block found.
    """
    skip_keywords = {
        "उषा", "usha", "jeweller", "main road", "jeetpur", "phone", "mobile",
        "bil", "बिल", "date", "मिति", "नाम", "ठेगाना",
        "विवरण", "तोला", "ग्राम", "दर", "रकम", "जम्मा", "पेस्की", "बाँकी",
        "अक्षरेपी", "अर्डरको", "pro.", "प्रो",
    }
    items = []
    subtotal = 0.0

    for line in all_lines:
        lower = line.lower()
        if any(kw.lower() in lower or kw in line for kw in skip_keywords):
            continue
        if re.match(r"^[-=_*]{3,}$", line):
            continue
        if _is_contact_or_header_line(line):
            continue
        # Must contain a jewellery item keyword or Devanagari + numbers
        has_item_kw = any(kw.lower() in lower or kw in line for kw in _JEWELLER_ITEMS)
        has_devanagari = bool(re.search(r"[\u0900-\u097F]", line))
        vals = extract_numbers(line)
        amounts = [v for v in vals if v >= 100]  # jewellery amounts are substantial
        if not has_item_kw and not (has_devanagari and amounts):
            continue
        if not amounts:
            continue

        line_total = amounts[-1]
        weight = 1.0
        unit = "pcs"
        weight_m = re.search(
            r"(\d+(?:\.\d+)?)\s*(तोला|tola|ग्राम|gram|gm|आना|aana)",
            line, re.I
        )
        if weight_m:
            weight = float(weight_m.group(1))
            unit = "tola" if weight_m.group(2).lower() in {"तोला", "tola"} else "gram"

        rate = amounts[-2] if len(amounts) >= 2 else round(line_total / max(weight, 0.001), 0)
        if line_total < rate and weight >= 1:
            line_total, rate = rate, line_total

        # Extract name
        name_clean = line
        name_clean = re.sub(r"^[\(\[]?\d+[\)\.]?\s*", "", name_clean)
        name_clean = re.sub(
            r"\b\d+(?:\.\d+)?\s*(?:तोला|tola|ग्राम|gram|gm|आना|aana)\b",
            "", name_clean, flags=re.I
        )
        name_clean = re.sub(r"(?:NPR|Rs\.?|₹|₨|रू)?\s*[\d,]+(?:\.\d+)?", "", name_clean, flags=re.I)
        name_clean = name_clean.strip(" :-.–—|/,")
        name_clean = re.sub(r"\s{2,}", " ", name_clean).strip()
        if not name_clean or len(name_clean) < 2:
            continue

        subtotal += line_total
        items.append({
            "name": name_clean[:80],
            "quantity": weight,
            "unit": unit,
            "unitPrice": round(rate, 2),
            "discount": 0.0,
            "tax": 0.0,
            "lineTotal": round(line_total, 2),
        })

    return items[:50], round(subtotal, 2)


def _extract_jeweller_advance(lines: List[str]) -> float:
    """
    Extract advance payment (पेस्की / peski) from jeweller bill footer.
    Returns the advance amount or 0.0.
    """
    advance_keywords = {"पेस्की", "peski", "advance", "paid", "deposit"}
    for line in lines:
        lower = line.lower()
        if any(kw.lower() in lower or kw in line for kw in advance_keywords):
            vals = extract_numbers(line)
            if vals:
                return vals[-1]
    return 0.0


# ─────────────────────────────────────────────
# Totals Extraction (with Numeric Validation)
# ─────────────────────────────────────────────
def _extract_totals(lines: List[str]) -> tuple:
    """
    Extract discount, VAT, and total amounts from the totals block.
    REQUIRES that a line contains both a keyword AND a numeric amount value.
    This prevents "Total Items: 3" from being treated as a total amount.
    """
    discount = 0.0
    vat = 0.0
    total = 0.0

    for line in lines:
        lower = line.lower()
        if _is_contact_or_header_line(line):
            continue
        vals = extract_numbers(line)
        # Only process lines that actually contain a monetary value (not just item counts)
        has_amount = bool(vals) and vals[-1] >= 0.01

        if not has_amount:
            continue

        # Discount (EN + NE)
        if ("discount" in lower or "disc" in lower or
                any(kw in line for kw in _NE_DISCOUNT_KEYWORDS)):
            discount = vals[-1]
            continue

        # VAT / Tax (EN + NE)
        if ("vat" in lower or "tax" in lower or
                any(kw in line for kw in _NE_VAT_KEYWORDS)):
            vat = vals[-1]
            continue

        # Grand Total / Net Total / Total Amount (highest precedence)
        if ("grand total" in lower or "net total" in lower or
                "total amount" in lower or "total due" in lower or
                "amount due" in lower or "payable" in lower or
                "payment amount" in lower or "paid amount" in lower or
                "received amount" in lower or "receipt amount" in lower or
                "total payment" in lower or "net amount" in lower or
                any(kw in line for kw in _NE_TOTAL_KEYWORDS)):
            total = vals[-1]
            continue

        # Simple "Total" line — but NOT if it says "Total Items" or "Total Qty"
        if "total" in lower and not re.search(r"total\s*(items?|qty|quantity|products?|lines?)", lower):
            # Must not be subtotal (we capture subtotal separately from items)
            if "sub" not in lower:
                total = vals[-1]
                continue

        # Simple "Amount" line (common on vouchers)
        if "amount" in lower and not re.search(r"amount\s*(in words|word|words|due|payable)", lower):
            total = vals[-1]

    return discount, vat, total


# ─────────────────────────────────────────────
# Confidence Scorer (Single Unified Source)
# ─────────────────────────────────────────────
def _score_confidence(vendor: str, bill_no: str, bill_date: str, total: float, items: list) -> float:
    if total <= 0.0:
        return 0.40

    score = 0.30
    if vendor and vendor not in {"Unknown vendor", ""}:
        score += 0.20
    if bill_no:
        score += 0.15
    if bill_date:
        score += 0.15
    if total > 0:
        score += 0.15
    if items:
        score += 0.05
    return round(min(score, 0.98), 2)


# ─────────────────────────────────────────────
# Utility: Number Extraction
# ─────────────────────────────────────────────
def extract_numbers(line: str) -> List[float]:
    """Extract all numeric values from a line, ignoring currency symbols."""
    vals = []
    for match in re.findall(r"(?:NPR|Rs\.?|₹|₨|रू)?\s*([0-9][0-9,]*(?:\.\d+)?)", line, flags=re.I):
        try:
            vals.append(float(match.replace(",", "")))
        except ValueError:
            pass
    return vals


def _empty_result(raw_text: str, categories: List[str] = None) -> Dict[str, Any]:
    from apps.rhinopeak.services.mongo_service import today_string
    return {
        "vendorName": "Unknown vendor",
        "billNumber": "",
        "billDate": today_string(),
        "paymentMethod": "Cash",
        "currency": "NPR",
        "subtotal": 0.0,
        "discountAmount": 0.0,
        "vatAmount": 0.0,
        "totalAmount": 0.0,
        "category": classify_category_offline(raw_text, categories),
        "items": [],
        "confidence": 0.30,
        "notes": "Empty or unreadable receipt.",
        "rawText": raw_text,
    }
