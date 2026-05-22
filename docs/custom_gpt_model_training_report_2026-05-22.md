# RhinoPeak Custom GPT Model Accuracy And Training Report

Date: May 22, 2026  
Feature area: Smart Bill Scanner / AI document intelligence  
Goal: Move from demo-grade OCR text parsing toward production-grade receipt and invoice extraction.

## Executive Summary

The current custom GPT service is useful as an experimental local transformer, but it is not yet a trained production extraction model. It runs a PyTorch decoder-only transformer forward pass and then extracts bill fields with deterministic parsing rules.

I improved the model service in two practical ways:

- Added Devanagari vocabulary support so Nepali text is no longer dropped before the transformer pass.
- Added optional trained checkpoint loading through `RHINOPEAK_GPT_CHECKPOINT`.

Current controlled OCR-text evaluation passes 100% on the repo sample set, but this is not the same as 99% real-world photo accuracy. Real-world accuracy must be measured on labeled receipt/invoice images from actual mobile captures.

## Current Model Audit

File reviewed:

- `backend/apps/rhinopeak/services/gpt_model.py`

Current behavior:

1. OCR text is encoded into character tokens.
2. A small GPT-style transformer runs a forward pass.
3. The final structured JSON is produced by parser logic, not by generated GPT output.
4. No trained checkpoint is committed in the repo.

Model architecture:

| Area | Current Value |
| --- | --- |
| Model type | Decoder-only character transformer |
| Layers | 4 |
| Attention heads | 4 |
| Embedding size | 64 |
| Context length | 256 characters |
| Device | CPU |
| Checkpoint support | Added through `RHINOPEAK_GPT_CHECKPOINT` |
| Nepali character support | Added Devanagari vocabulary |

Important conclusion:

The current model cannot honestly be called 99% accurate on real bills until it is trained and evaluated against labeled real-world receipt/invoice images.

## Accuracy Test Completed

Test file:

- `backend/apps/rhinopeak/tests/test_gpt_model_accuracy.py`

Command:

```powershell
cd backend
python manage.py test apps.rhinopeak.tests.test_gpt_model_accuracy --verbosity 1
```

Result:

| Metric | Result |
| --- | --- |
| Field extraction accuracy | 32 / 32, 100% |
| Item extraction accuracy | 21 / 21, 100% |
| Overall controlled-sample accuracy | 53 / 53, 100% |

Covered samples:

- Hotel bill with VAT.
- Retail bill with discount and eSewa.
- Rent receipt with bank payment.
- Nepali vendor name with liter/kg quantities.

Limit:

These are controlled OCR text samples. They do not measure camera blur, shadows, handwriting, torn paper, bad angles, OCR mistakes, table layout confusion, or real Nepali VAT bill variation.

## Real Online Datasets Found

| Dataset / Source | What It Provides | Use In RhinoPeak | Notes |
| --- | --- | --- | --- |
| [ICDAR 2019 SROIE paper](https://arxiv.org/abs/2103.10213) | Scanned receipt OCR and key information extraction benchmark with 1000 annotated receipt images | Baseline receipt OCR and key field extraction | Good starting point for vendor/date/total extraction |
| [ICDAR 2019 SROIE challenge page](https://rrc.cvc.uab.es/?ch=13&com=news&id=75&view=data) | Competition source for receipt OCR tasks | Dataset access and challenge definitions | Check registration and license terms before production use |
| [SROIE dataset on Kaggle](https://www.kaggle.com/datasets/ryanznie/sroie-datasetv2-with-labels) | Organized SROIE v2 with images, OCR text, and labels | Training/evaluation adapter source | Kaggle account/license review required |
| [CORD paper](https://openreview.net/pdf?id=SJl3z659UH) | Consolidated Receipt Dataset with box/text annotations and multi-level semantic labels | Better line-item and layout learning | Includes store, payment, menu, subtotal, total classes |
| [WildReceipt via MMOCR docs](https://mmocr.readthedocs.io/en/v0.6.3/datasets/kie.html) | Key information extraction dataset preparation path | KIE benchmark and open-set experiments | Useful for layout-aware extraction evaluation |
| [Hugging Face ocr-invoice-data](https://huggingface.co/datasets/philschmid/ocr-invoice-data) | Invoice and receipt OCR image/text dataset, 2,238 rows shown on dataset card | Broader invoice-like samples | Needs license and field-schema inspection |
| [Hugging Face Nepali OCR dataset](https://huggingface.co/datasets/gauravgiri/nepali-ocr-dataset) | 18.8k Nepali image-text OCR rows | Nepali character recognition support | Not invoice-specific, useful for Nepali OCR robustness |
| [Nepali Tesseract preprocessing paper](https://zenodo.org/records/4361896) | Research on improving Nepali OCR via preprocessing | Camera preprocessing pipeline design | Reports improved OCR on high/medium/low quality images |
| [merocaro Nepal invoice OCR market reference](https://www.merocaro.com/) | Nepal-specific invoice OCR positioning and workflow | Product and UX validation | Confirms VAT/PAN, review, and audit-ready workflow demand |

## Recommended 99% Accuracy Definition

Do not define 99% as raw model exact match on every field from every photo. That is not realistic for real-world mobile bills.

Use this production definition instead:

| Layer | Target |
| --- | --- |
| High-confidence printed bill field extraction | 95%+ exact match |
| Numeric fields after validation rules | 98%+ within NPR 1 tolerance |
| Human-reviewed saved records | 99%+ correctness |
| Low-confidence auto-save rate | 0%; always review |
| Critical fields requiring validation | Vendor, PAN/VAT, bill date, subtotal, VAT, total, payment method |

This gets the business result users care about: records are correct before they enter accounting.

## Training Architecture Recommendation

The best architecture is not to train a GPT from scratch. Use a layered document AI pipeline:

```text
Image / PDF
  -> preprocessing
  -> OCR engine
  -> layout-aware extraction model
  -> RhinoPeak validation rules
  -> editable review screen
  -> database save + PDF/document record
```

Recommended model path:

1. MVP baseline: current parser + OCR provider.
2. Strong open-source baseline: PaddleOCR or Google Vision for OCR.
3. Layout-aware extractor: LayoutLMv3, Donut, or a small VLM fine-tuned on receipt/invoice examples.
4. Nepal specialization: fine-tune with private Nepal VAT/PAN bills collected from pilot users.
5. Confidence gating: auto-fill fields, but require review when confidence or validation fails.

## Canonical Training Schema

Every dataset should be converted into this format:

```json
{
  "document_id": "receipt-0001",
  "image_path": "data/raw/sroie/img/0001.jpg",
  "ocr_text": "raw OCR text here",
  "language": "en",
  "country": "NP",
  "target": {
    "vendorName": "Himalaya Hotel",
    "panVatNumber": "123456789",
    "billNumber": "HH-1001",
    "billDate": "2026-05-20",
    "paymentMethod": "Cash",
    "subtotal": 600,
    "discountAmount": 0,
    "vatAmount": 78,
    "totalAmount": 678,
    "items": [
      {
        "name": "Rice",
        "quantity": 2,
        "unit": "pcs",
        "unitPrice": 250,
        "lineTotal": 500
      }
    ]
  }
}
```

## Training Plan

### Phase 1: Data Foundation

1. Download and license-check SROIE, CORD, WildReceipt, invoice OCR data, and Nepali OCR data.
2. Convert every source into the canonical JSONL schema.
3. Create train/validation/test splits by vendor and layout, not random rows only.
4. Add private Nepal pilot dataset with at least 500 real VAT/PAN bills before claiming Nepal accuracy.

### Phase 2: Baseline Evaluation

1. Run current RhinoPeak parser on every OCR text sample.
2. Measure field exact match, numeric tolerance, item line F1, and document-level success.
3. Store failure categories: vendor miss, date miss, VAT mismatch, table item miss, OCR noise.

### Phase 3: Model Training

1. Train a layout-aware model or VLM on public receipt datasets.
2. Fine-tune on Nepal VAT/PAN examples.
3. Keep a holdout set of real Nepali bills that is never used for training.
4. Add threshold-based review rules.

### Phase 4: Production Hardening

1. Add asynchronous processing with Celery/RQ.
2. Save raw image, OCR text, extracted JSON, confidence, and corrections.
3. Use user corrections as future training data.
4. Keep audit trails for tax/accounting records.

## Required Metrics

| Metric | Why It Matters |
| --- | --- |
| OCR character error rate | Measures text extraction quality |
| Field exact match | Measures vendor/date/total correctness |
| Numeric tolerance accuracy | Prevents accounting mistakes |
| Item line precision/recall/F1 | Measures product table extraction |
| Document success rate | Measures fully usable scans |
| Human correction rate | Measures real workflow friction |
| Auto-save rejection rate | Prevents bad records |

## Honest 99% Verdict

Current status:

- Controlled OCR text samples: 100% after parser fixes.
- Real-world photo bills: not measured yet.
- Trained custom GPT checkpoint: not available yet.
- Public data sources: identified.
- Production 99% claim: not valid yet.

Path to 99% business correctness:

Use model extraction plus human review and validation rules. A pure unreviewed local character GPT should not be trusted with tax/accounting data at 99% until it is trained, benchmarked, and proven on a large holdout set.

## Gap Audit: What Was Missing

I rechecked this report against a production AI checklist. The first version covered datasets, architecture, and metrics, but it was missing several important details needed before training or claiming high accuracy.

### 1. Dataset Licensing And Consent

Before using any online dataset or pilot business document, record:

| Field | Required Decision |
| --- | --- |
| Dataset license | Can it be used for commercial SaaS training or only research? |
| Redistribution rules | Can derived annotations/checkpoints be stored or shipped? |
| PII handling | Are names, phone numbers, PAN/VAT numbers, and addresses anonymized? |
| Customer consent | Did pilot users agree that their bills can improve the model? |
| Data retention | How long original images and OCR text are kept |

Action: add a `dataset_manifest.json` for every dataset before training starts.

### 2. Annotation Guidelines

Accuracy depends on consistent labels. The project still needs a human annotation guide.

Required rules:

- Vendor name: use the legal seller/shop name, not branch slogans or headers.
- PAN/VAT number: preserve only digits; flag missing or invalid length.
- Bill number: keep original casing and separators.
- Date: normalize to `YYYY-MM-DD`, preserve original raw date separately.
- VAT: distinguish VAT amount from VAT percentage.
- Discount: separate bill-level discount from item-level discount.
- Items: label item name, quantity, unit, unit price, tax, discount, and line total.
- Payment method: normalize to Cash, Bank, Card, eSewa, Khalti, FonePay, Credit, or Unknown.
- Unknown fields: use `null` or empty string consistently, never hallucinate.

Action: create `docs/ai_bill_annotation_guidelines.md` before labeling Nepal pilot bills.

### 3. Evaluation Sample Size For 99%

A 99% claim needs enough test documents. A tiny test set can show 100% but still prove very little.

Minimum locked holdout targets:

| Evaluation Set | Minimum Size |
| --- | --- |
| Clean printed English/Nepali bills | 500 documents |
| Noisy mobile photos | 500 documents |
| Nepal VAT/PAN invoices | 500 documents |
| Handwritten or semi-handwritten receipts | 200 documents |
| Out-of-distribution vendors/layouts | 200 documents |

For marketing-level confidence, use at least 1,000+ locked holdout bills and report confidence intervals, not only a single percentage.

### 4. Field-Level Confidence And Blocking Rules

The app should not treat every extracted value equally.

Blocking rules:

- If total does not equal subtotal - discount + VAT within tolerance, force review.
- If VAT is present but PAN/VAT number is missing, force review.
- If bill date is missing or future-dated, force review.
- If vendor is `Unknown vendor`, force review.
- If duplicate vendor + bill number + total exists, warn before save.
- If OCR text is too short, mark scan as failed or needs review.

Action: save confidence per field, not only one overall confidence score.

### 5. Model Versioning And Registry

Every prediction should record:

```json
{
  "ocrProvider": "google_vision",
  "ocrModelVersion": "api-2026-05",
  "extractorProvider": "rhinopeak_local",
  "extractorModelVersion": "gpt-receipt-v0.1.0",
  "checkpointSha256": "..."
}
```

This is required for auditability. If a customer asks why a bill was parsed incorrectly, the system must know which model produced it.

### 6. Checkpoint Security

PyTorch checkpoint loading can be risky if files are untrusted. Only load checkpoints from a trusted local path controlled by the deployment process.

Required safeguards:

- Store checkpoint SHA-256 in the release manifest.
- Do not allow workspace users to upload model files.
- Use a fixed model directory such as `backend/runtime/models/`.
- Verify checksum before loading.
- Keep `RHINOPEAK_GPT_CHECKPOINT` as an ops-only environment variable.

### 7. Baseline Comparison

Do not train a custom model without comparing it to strong baselines.

Required baselines:

1. Current deterministic parser.
2. Google Vision OCR + parser.
3. PaddleOCR + parser.
4. OCR + LLM structured extraction.
5. Layout-aware model or VLM.

The custom model should only replace a baseline if it is more accurate, cheaper, faster, or more private.

### 8. Latency, Cost, And Hardware Budget

Accuracy alone is not enough for SaaS.

Targets:

| Metric | Target |
| --- | --- |
| Upload accepted | Under 1 second |
| OCR completed | Under 8 seconds for normal receipt |
| Structured extraction completed | Under 4 seconds after OCR |
| Total preview time | Under 12 seconds |
| CPU fallback parser | Under 500 ms |
| Per-scan provider cost | Track by workspace |

If OCR/AI exceeds these limits, move processing to a background worker and notify the user when review is ready.

### 9. Monitoring And Drift Detection

After launch, track:

- Correction rate by field.
- Correction rate by vendor.
- OCR failure rate by device.
- Average confidence by bill type.
- Duplicate scan warnings.
- Model version versus corrected fields.
- Low-confidence rate over time.

If correction rate rises, the model is drifting or seeing new document layouts.

### 10. Red-Team And Abuse Tests

Before production, test:

- Prompt-injection text printed on receipts.
- Fake totals that do not match line items.
- Duplicate bills.
- Cropped or rotated bills.
- Multiple bills in one photo.
- QR-only or digital wallet screenshots.
- Very large images/PDFs.
- Documents from a different tenant.
- Bills containing private customer data.

### 11. Nepal-Specific Compliance Checks

For Nepal workflows, add validation for:

- PAN/VAT number presence and digit format.
- VAT percentage and VAT amount consistency.
- Nepali fiscal-year date display where needed.
- Abbreviated tax invoice versus full VAT invoice distinction.
- Buyer/seller PAN when required for tax records.
- Original image retention for audit lookup.

## Next Implementation Tasks

1. Add dataset adapters for SROIE, CORD, WildReceipt, Hugging Face invoice data, and Nepali OCR rows.
2. Add an evaluation command that writes field-level metrics to `backend/runtime/ai_eval_report.json`.
3. Add OCR provider interface for Google Vision and PaddleOCR.
4. Add confidence and validation flags per extracted field.
5. Add correction logging from the review UI.
6. Build a private Nepal bill dataset from pilot businesses.
7. Train/fine-tune a layout-aware extraction model.
8. Run a locked holdout evaluation before any 99% marketing claim.
9. Add dataset manifests with license, consent, and PII status.
10. Add annotation guidelines for Nepal VAT/PAN bills.
11. Add checkpoint checksum verification and model version logging.
12. Add red-team tests for malformed, duplicate, rotated, cropped, and prompt-injection receipts.

## Voice AI Assistant Addendum

The next custom GPT direction is a workflow assistant, not a general chatbot. Voice should first become a transcript, then the backend should convert that transcript into a safe RhinoPeak action draft.

New implementation reference:

- `backend/apps/rhinopeak/services/assistant_service.py`
- `backend/apps/rhinopeak/tests/test_assistant_service.py`
- `docs/voice_ai_assistant_feature_plan.md`

Current assistant status:

- Supports English, Nepali, and mixed command intent parsing.
- Supports safe confirmed execution for expense, customer, supplier, product, and report creation.
- Keeps sales, credit payment, and stock movement as draft-only because those workflows affect inventory, receivables, payables, and accounting.
- Writes audit entries for parsed and executed assistant commands.
- Adds a web Quick Add assistant panel with browser speech recognition, text fallback, confidence preview, warnings, and confirm/save flow.

99 percent accuracy rule:

- Do not claim 99 percent open-ended speech accuracy.
- Target 99 percent exact-intent accuracy on a locked command set.
- Keep unsafe execution rate at 0 percent by requiring confirmation and blocking low-confidence writes.

Next required assistant work:

1. Add 5,000 labeled voice command fixtures across English, Nepali, and mixed Nepali-English.
2. Add an assistant evaluation command that reports intent accuracy, slot accuracy, false execution rate, and clarification rate.
3. Add assistant regression fixtures and measure 99 percent intent accuracy against them.
4. Add Flutter speech capture and platform microphone permissions.
5. Add optional OpenAI transcription or realtime voice path for noisy shop environments.
