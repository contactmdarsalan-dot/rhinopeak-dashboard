"""
KaroBrain™ Vision Engine
========================
Proprietary multi-layer OCR pipeline for Nepali & English bills.
Built for RhinoPeak Business Dashboard.

Architecture (in order of execution):
  Layer 1 — OpenCV Image Preprocessing
             • Grayscale conversion
             • Adaptive denoising (fastNlMeansDenoising)
             • CLAHE contrast enhancement
             • Adaptive thresholding (Sauvola-style)
             • Auto-deskew (Hough line transform)
             • Smart upscaling (2x if image < 1000px tall)

  Layer 2 — Tesseract OCR (Local, FREE, unlimited users)
             • Bilingual: English + Nepali (Devanagari)
             • Page segmentation mode 6 (uniform block of text)
             • Post-processing: clean artifacts, fix Devanagari breaks

  Layer 3 — Gemini Vision API (Cloud, high-accuracy fallback)
             • Used when Tesseract confidence < threshold
             • Or when KAROBRAIN_OCR_MODE=gemini
             • Bill-context prompt for Nepali receipts

  Layer 4 — Confidence Scoring
             • Word count, numeric content, Devanagari presence
             • Combined score decides whether to escalate to Gemini

No external API costs when running on local mode.
Gemini API only called when local OCR produces low confidence.

© RhinoPeak — KaroBrain™ is a proprietary brand of RhinoPeak.
"""

from __future__ import annotations

import base64
import json
import os
import re
import urllib.request
from pathlib import Path
from typing import Optional


# ─────────────────────────────────────────────────────────
# Load environment from .env file if present
# ─────────────────────────────────────────────────────────
def _load_env() -> None:
    """Load .env file from backend root directory."""
    env_path = Path(__file__).resolve().parents[3] / ".env"
    if not env_path.exists():
        return
    try:
        with open(env_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value
    except Exception:
        pass


_load_env()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
OCR_MODE = os.environ.get("KAROBRAIN_OCR_MODE", "hybrid").strip().lower()
MIN_CONFIDENCE = float(os.environ.get("KAROBRAIN_MIN_CONFIDENCE", "0.55"))

# Tesseract executable path (configurable)
TESSERACT_CMD = os.environ.get(
    "TESSERACT_CMD",
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
)

# ─────────────────────────────────────────────────────────
# Layer 1 — OpenCV Image Preprocessing
# ─────────────────────────────────────────────────────────

def _preprocess_image(image_bytes: bytes):
    """
    Apply OpenCV preprocessing pipeline to improve OCR accuracy.
    Returns processed numpy array (grayscale) ready for Tesseract.
    """
    try:
        import cv2
        import numpy as np

        # Decode image from bytes
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return None

        # ── Step 1: Upscale small images (improves OCR for phone photos) ──
        h, w = img.shape[:2]
        if h < 1000:
            scale = 1000 / h
            img = cv2.resize(img, (int(w * scale), 1000), interpolation=cv2.INTER_CUBIC)

        # ── Step 2: Convert to grayscale ──
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # ── Step 3: CLAHE contrast enhancement (handles uneven lighting) ──
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        gray = clahe.apply(gray)

        # ── Step 4: Denoise (preserves Devanagari strokes) ──
        gray = cv2.fastNlMeansDenoising(gray, h=10, templateWindowSize=7, searchWindowSize=21)

        # ── Step 5: Adaptive threshold (handles shadows & uneven paper) ──
        thresh = cv2.adaptiveThreshold(
            gray, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            blockSize=31,
            C=12,
        )

        # ── Step 6: Auto-deskew using Hough lines ──
        thresh = _deskew(thresh)

        # ── Step 7: Morphological cleanup (remove small noise dots) ──
        kernel = np.ones((1, 1), np.uint8)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)

        return thresh
    except ImportError:
        print("[KaroBrain] OpenCV not available — skipping preprocessing.")
        return None
    except Exception as e:
        print(f"[KaroBrain] Preprocessing error: {e}")
        return None


def _deskew(image):
    """
    Auto-detect and correct text skew using Hough line transform.
    Corrects up to ±15 degrees of rotation from camera tilt.
    """
    try:
        import cv2
        import numpy as np

        # Find edges
        edges = cv2.Canny(image, 50, 150, apertureSize=3)
        # Detect lines
        lines = cv2.HoughLines(edges, 1, np.pi / 180, 200)
        if lines is None:
            return image

        # Calculate median angle
        angles = []
        for rho, theta in lines[:, 0]:
            angle = (theta * 180 / np.pi) - 90
            if -15 < angle < 15:  # only correct small tilts
                angles.append(angle)

        if not angles:
            return image

        median_angle = float(np.median(angles))
        if abs(median_angle) < 0.5:
            return image  # no significant skew

        # Rotate to correct
        (h, w) = image.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, median_angle, 1.0)
        rotated = cv2.warpAffine(
            image, M, (w, h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REPLICATE,
        )
        print(f"[KaroBrain] Deskewed by {median_angle:.2f}°")
        return rotated
    except Exception:
        return image


# ─────────────────────────────────────────────────────────
# Layer 2 — Tesseract OCR (Local, Unlimited)
# ─────────────────────────────────────────────────────────

def _tesseract_ocr(image_bytes: bytes) -> tuple[str, float]:
    """
    Run Tesseract OCR on image bytes.
    Returns (extracted_text, confidence_score).
    Supports English + Nepali (Devanagari) bilingual mode.
    """
    try:
        import pytesseract
        from PIL import Image
        import io
        import numpy as np

        # Set Tesseract path if configured
        if TESSERACT_CMD and Path(TESSERACT_CMD).exists():
            pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD

        # Preprocess with OpenCV first
        preprocessed = _preprocess_image(image_bytes)

        if preprocessed is not None:
            import cv2
            # Convert numpy array back to PIL Image
            pil_image = Image.fromarray(preprocessed)
        else:
            # Fallback: use PIL directly
            pil_image = Image.open(io.BytesIO(image_bytes))
            # Basic enhance with PIL
            from PIL import ImageEnhance, ImageFilter
            pil_image = pil_image.convert("L")
            pil_image = ImageEnhance.Contrast(pil_image).enhance(2.0)
            pil_image = ImageEnhance.Sharpness(pil_image).enhance(1.5)

        # Tesseract config for receipt scanning
        # PSM 6 = uniform block of text (good for receipts)
        # PSM 4 = single column (alternative)
        config = "--psm 6 --oem 3"

        # Try bilingual (English + Nepali) first
        try:
            data = pytesseract.image_to_data(
                pil_image,
                lang="eng+nep",
                config=config,
                output_type=pytesseract.Output.DICT,
            )
        except Exception:
            # Fallback to English only if Nepali lang pack not installed
            print("[KaroBrain] Nepali language pack not found, using English only.")
            data = pytesseract.image_to_data(
                pil_image,
                lang="eng",
                config=config,
                output_type=pytesseract.Output.DICT,
            )

        # Extract text and calculate confidence
        words = []
        confidences = []
        for i, word in enumerate(data["text"]):
            conf = int(data["conf"][i])
            if conf > 10 and word.strip():  # filter noise
                words.append(word)
                confidences.append(conf)

        raw_text = " ".join(words)

        # Reconstruct line breaks using block/line numbers
        lines_dict: dict[tuple, list[str]] = {}
        for i, word in enumerate(data["text"]):
            conf = int(data["conf"][i])
            if conf > 10 and word.strip():
                key = (data["block_num"][i], data["line_num"][i])
                lines_dict.setdefault(key, []).append(word)

        reconstructed = "\n".join(
            " ".join(words) for words in lines_dict.values()
        )

        # Clean up common Tesseract artifacts
        reconstructed = _clean_tesseract_output(reconstructed)

        avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
        score = avg_conf / 100.0  # normalize to 0–1

        print(f"[KaroBrain] Tesseract OCR: {len(words)} words, confidence={score:.2f}")
        return reconstructed, score

    except ImportError:
        print("[KaroBrain] pytesseract not installed. Install with: pip install pytesseract")
        return "", 0.0
    except Exception as e:
        print(f"[KaroBrain] Tesseract error: {e}")
        return "", 0.0


def _clean_tesseract_output(text: str) -> str:
    """
    Clean common Tesseract OCR artifacts from extracted text.
    Fixes common issues with Nepali bills.
    """
    # Remove lines that are just noise (single chars, symbols only)
    lines = text.split("\n")
    cleaned = []
    for line in lines:
        stripped = line.strip()
        # Keep lines with at least 2 meaningful characters
        if len(stripped) >= 2 and re.search(r"[A-Za-z\u0900-\u097F0-9]", stripped):
            cleaned.append(stripped)
        elif stripped in ("---", "===", "___"):
            cleaned.append(stripped)

    # Rejoin and normalize spacing
    result = "\n".join(cleaned)
    # Fix double spaces
    result = re.sub(r" {2,}", " ", result)
    # Fix common OCR confusions for Nepali digits
    result = result.replace("०", "0").replace("१", "1").replace("२", "2")
    result = result.replace("३", "3").replace("४", "4").replace("५", "5")
    result = result.replace("६", "6").replace("७", "7").replace("८", "8")
    result = result.replace("९", "9")

    return result.strip()


# ─────────────────────────────────────────────────────────
# Layer 3 — Gemini Vision API (Cloud Fallback)
# ─────────────────────────────────────────────────────────

_GEMINI_PROMPT = """\
You are KaroBrain™, an expert OCR system for Nepali and English business bills and receipts.
Extract ALL visible text from this bill/receipt image EXACTLY as written.

CRITICAL rules:
- Extract EVERY line of text visible in the image
- Preserve Nepali (Devanagari) script exactly as printed
- Extract ALL numbers, dates, amounts, and product names ACCURATELY
- For jeweller/gold shop bills: extract item name, weight (tola/gram/aana/रती), rate per unit, total amount (रकम/जम्मा)
- For Bikram Sambat dates (e.g. 2081/8/6 or २०८१): extract as-is  
- For bill number (बिल नं / Invoice No / Receipt No): extract the number
- For advance paid (पेस्की / Advance): extract the amount
- For store name, VAT/PAN number: extract exactly
- For each line item: extract name, quantity, unit price, and total
- Output ONLY the raw extracted text, preserving line structure. No commentary. No markdown.
"""


def _gemini_ocr(image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    """
    Use Gemini Vision API for high-accuracy OCR.
    Only called when local OCR confidence is low or in 'gemini' mode.
    """
    if not GEMINI_API_KEY:
        return ""
    try:
        b64data = base64.b64encode(image_bytes).decode("ascii")
        payload = json.dumps({
            "contents": [{
                "parts": [
                    {"text": _GEMINI_PROMPT},
                    {"inline_data": {"mime_type": mime_type, "data": b64data}},
                ]
            }],
            "generationConfig": {
                "temperature": 0.05,
                "maxOutputTokens": 2048,
                "topP": 0.8,
            },
        }).encode("utf-8")

        req = urllib.request.Request(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))

        extracted = result["candidates"][0]["content"]["parts"][0]["text"].strip()
        print(f"[KaroBrain] Gemini Vision OCR: {len(extracted)} chars extracted.")
        return extracted
    except Exception as e:
        print(f"[KaroBrain] Gemini Vision error: {e}")
        return ""


# ─────────────────────────────────────────────────────────
# Layer 4 — Confidence Scoring
# ─────────────────────────────────────────────────────────

def _score_ocr_output(text: str) -> float:
    """
    Score OCR output quality based on:
    - Word count (more words = better extraction)
    - Numeric content (bills have lots of numbers)
    - Devanagari presence (for Nepali bills)
    - Bill structure keywords present
    - Line count (multi-line = structured bill)
    """
    if not text or len(text) < 10:
        return 0.0

    words = text.split()
    word_count = len(words)
    line_count = len([l for l in text.split('\n') if l.strip()])
    has_numbers = bool(re.search(r"\d{2,}", text))
    has_devanagari = bool(re.search(r"[\u0900-\u097F]{3,}", text))
    has_date = bool(re.search(r"\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4}", text))
    has_amount = bool(re.search(r"\d{3,}(?:\.\d{2})?", text))
    has_bill_keywords = bool(re.search(
        r"(total|amount|invoice|receipt|bill|subtotal|tax|vat|pan|रकम|जम्मा|बिल|कुल|भ्याट)",
        text, re.IGNORECASE
    ))
    has_items = bool(re.search(r"x\s*\d|\d+\s*pcs|qty|quantity", text, re.IGNORECASE))

    score = 0.0
    if word_count >= 3:
        score += 0.1
    if word_count >= 10:
        score += 0.15
    if word_count >= 20:
        score += 0.1
    if line_count >= 4:
        score += 0.1
    if has_numbers:
        score += 0.15
    if has_devanagari:
        score += 0.1
    if has_date:
        score += 0.1
    if has_amount:
        score += 0.1
    if has_bill_keywords:
        score += 0.1
    if has_items:
        score += 0.05

    return min(score, 1.0)


# ─────────────────────────────────────────────────────────
# Main Public API
# ─────────────────────────────────────────────────────────

def karobrain_extract(image_data_url: str) -> str:
    """
    KaroBrain™ Vision Engine — Main entry point.

    Runs the full multi-layer OCR pipeline:
    1. Decode base64 image from data URL
    2. Run OpenCV preprocessing
    3. Run Tesseract local OCR (free, unlimited)
    4. If confidence < threshold AND Gemini API key set: run Gemini Vision
    5. Return best extracted text

    Args:
        image_data_url: Base64 data URL (data:image/jpeg;base64,...)

    Returns:
        Extracted text string, or "" if extraction fails.
    """
    if not image_data_url or "," not in image_data_url:
        return ""

    # Parse data URL
    header, b64data = image_data_url.split(",", 1)
    mime_type = "image/jpeg"
    if "image/" in header:
        mime_part = header.split("image/")[1].split(";")[0]
        mime_type = f"image/{mime_part}"

    try:
        image_bytes = base64.b64decode(b64data)
    except Exception as e:
        print(f"[KaroBrain] Failed to decode image: {e}")
        return ""

    print(f"[KaroBrain™] Processing {mime_type} image ({len(image_bytes):,} bytes)")

    # ── Mode: gemini only ──
    if OCR_MODE == "gemini":
        return _gemini_ocr(image_bytes, mime_type)

    # ── Mode: local only ──
    if OCR_MODE == "local":
        text, _ = _tesseract_ocr(image_bytes)
        return text

    # ── Mode: hybrid (default) ──
    # Try local OCR first
    local_text, local_conf = _tesseract_ocr(image_bytes)
    content_score = _score_ocr_output(local_text)
    combined_score = (local_conf * 0.4) + (content_score * 0.6)

    print(f"[KaroBrain™] Local OCR score: {combined_score:.2f} (tesseract={local_conf:.2f}, content={content_score:.2f})")

    # If Tesseract is not installed (local_conf=0), immediately use Gemini if available
    if local_conf == 0.0 and not local_text and GEMINI_API_KEY:
        print(f"[KaroBrain™] Tesseract unavailable. Using Gemini Vision directly...")
        gemini_text = _gemini_ocr(image_bytes, mime_type)
        if gemini_text:
            gemini_score = _score_ocr_output(gemini_text)
            print(f"[KaroBrain™] Gemini Vision extraction successful (score={gemini_score:.2f}).")
            return gemini_text
        print("[KaroBrain™] Gemini also failed. Returning empty.")
        return ""

    # If local OCR is good enough, use it (saves API calls)
    if combined_score >= MIN_CONFIDENCE and local_text and len(local_text.strip()) > 30:
        print("[KaroBrain™] Local OCR quality sufficient. Skipping cloud API.")
        return local_text

    # Local OCR confidence too low — escalate to Gemini Vision
    if GEMINI_API_KEY:
        print(f"[KaroBrain™] Low confidence ({combined_score:.2f}). Escalating to Gemini Vision...")
        gemini_text = _gemini_ocr(image_bytes, mime_type)
        if gemini_text:
            gemini_score = _score_ocr_output(gemini_text)
            print(f"[KaroBrain™] Gemini Vision extraction successful (score={gemini_score:.2f}).")
            # Use Gemini if it scored better
            if gemini_score >= content_score or not local_text:
                return gemini_text
        print("[KaroBrain™] Gemini failed or local OCR was better. Using local result.")

    # Return local result even if low confidence (better than nothing)
    return local_text


def karobrain_status() -> dict:
    """Return current KaroBrain engine status and capabilities."""
    import importlib

    has_cv2 = importlib.util.find_spec("cv2") is not None
    has_tesseract = importlib.util.find_spec("pytesseract") is not None
    has_pil = importlib.util.find_spec("PIL") is not None
    has_gemini = bool(GEMINI_API_KEY)

    # Check Tesseract binary
    tesseract_installed = False
    if has_tesseract:
        try:
            import pytesseract
            if Path(TESSERACT_CMD).exists():
                pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
            ver = pytesseract.get_tesseract_version()
            tesseract_installed = True
        except Exception:
            pass

    return {
        "engine": "KaroBrain™ Vision Engine v1.0",
        "brand": "RhinoPeak",
        "mode": OCR_MODE,
        "layers": {
            "opencv_preprocessing": has_cv2,
            "tesseract_local_ocr": has_tesseract and tesseract_installed,
            "gemini_cloud_ocr": has_gemini,
            "pillow_fallback": has_pil,
        },
        "languages": ["eng", "nep"] if tesseract_installed else ["eng"],
        "unlimited_users": True,
        "api_cost_per_scan": 0.0 if OCR_MODE == "local" else "Gemini free tier",
    }
