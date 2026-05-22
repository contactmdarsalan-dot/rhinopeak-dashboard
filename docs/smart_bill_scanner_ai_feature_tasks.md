# RhinoPeak Smart Bill Scanner And AI Document Intelligence Roadmap

Date: May 22, 2026  
Product direction: RhinoPeak Intelligence Platform  
Primary feature: Smart Bill Scanner  
Target users: shop owners, restaurants, tourism businesses, accountants, inventory staff  
Core promise: Turn paper bills into organized digital records instantly.

## Strategic Direction

RhinoPeak should evolve from a simple dashboard into an AI-powered business operating system. The strongest near-term AI module is document intelligence: scan bills, extract structured data, create clean records, and generate professional PDFs.

The important lesson from transformer/GPT architecture is not that RhinoPeak should train a GPT from scratch. The useful lesson is that GPT-style systems are prediction engines. For RhinoPeak, the prediction task is structured generation:

Raw OCR text:

```text
Himalaya Hotel
Rice x2 500
Tea 100
VAT 78
Total 678
```

Structured business object:

```json
{
  "vendor": "Himalaya Hotel",
  "items": [
    {
      "name": "Rice",
      "quantity": 2,
      "unitPrice": 250,
      "amount": 500
    },
    {
      "name": "Tea",
      "quantity": 1,
      "unitPrice": 100,
      "amount": 100
    }
  ],
  "vatAmount": 78,
  "totalAmount": 678
}
```

This should be workflow-native AI, not a generic chatbot or API wrapper.

## New Feature List

### MVP Features

1. Quick Action: Scan Bill
   - Add `Scan Bill` to web and Flutter Quick Add.
   - Use camera capture on mobile.
   - Use camera or image upload on web.

2. Camera And Upload Flow
   - Open camera instantly.
   - Allow gallery/file upload fallback.
   - Show captured image preview.
   - Allow retake before processing.

3. OCR Processing
   - Extract text from bill images.
   - MVP provider order:
     - Google Vision API as primary.
     - Tesseract or PaddleOCR as fallback later.

4. AI Structuring
   - Convert raw OCR text into normalized JSON.
   - Extract vendor, bill number, date, items, quantity, VAT, discount, total, payment method, and confidence score.
   - Use strict schema validation before save.

5. Editable AI Preview
   - Show detected fields in a simple review screen.
   - User can fix vendor, items, totals, date, and payment type.
   - Highlight low-confidence fields.

6. Save To Database
   - Save original image metadata.
   - Save OCR raw text.
   - Save parsed bill data.
   - Save normalized bill items.
   - Link bill to expense, purchase, inventory, customer, or supplier where applicable.

7. PDF Generation
   - Generate clean PDF invoice/receipt from parsed data.
   - Provide preview, download, print, and share actions.
   - Use WeasyPrint or ReportLab from Django.

8. Business Automation Hooks
   - If bill is a purchase invoice, update purchases and inventory.
   - If bill is an expense receipt, create expense log.
   - If bill is a sales bill, create sale/invoice record.
   - Update dashboard analytics after save.

9. Audit Trail
   - Record who scanned, reviewed, edited, and saved the bill.
   - Store original AI output and final user-approved output.

10. English/Nepali UI
   - Translate Scan Bill flow, OCR status, edit labels, save actions, and errors.

### Premium Later Features

1. Smart Templates
   - Modern minimal invoice.
   - VAT invoice.
   - Restaurant receipt.
   - Retail bill.

2. AI Business Assistant
   - Ask questions like `How much did we spend this month?`
   - Use saved bills, sales, expenses, and inventory as context.

3. Nepal Invoice Intelligence
   - Fine-tune or adapt extraction prompts for Nepali VAT bills, handwritten receipts, and mixed Nepali/English bills.

4. Fraud And Error Detection
   - Flag total mismatch, missing VAT, duplicate bill number, and unusual vendor changes.

5. Auto Inventory Matching
   - Match scanned item names to existing products.
   - Suggest new product creation when no match exists.

6. Batch Scanning
   - Scan multiple bills in one session.
   - Queue background processing.

7. Offline Scan Queue
   - Capture image offline.
   - Process when internet returns.

8. Document Search
   - Search bills by vendor, amount, date, item, VAT number, or raw OCR text.

## Recommended System Architecture

```text
Web / Flutter Camera
  -> Image Upload API
  -> Storage Layer
  -> OCR Worker
  -> AI Structuring Worker
  -> Validation Rules
  -> Editable Preview
  -> Save Approved Bill
  -> PDF Generator
  -> Expense/Purchase/Sales/Inventory/Analytics Updates
```

## Data Model Additions

### `bill_scans`

| Field | Purpose |
| --- | --- |
| `id` | Unique scan ID |
| `workspaceId` | Tenant scope |
| `businessId` | Active business |
| `sourceType` | purchase, expense, sales, unknown |
| `status` | uploaded, processing, needs_review, approved, failed |
| `imageUrl` | Original image location |
| `pdfUrl` | Generated PDF location |
| `ocrProvider` | google_vision, tesseract, manual |
| `ocrText` | Raw OCR output |
| `aiProvider` | openai, gemini, local |
| `aiModel` | Model used for structuring |
| `confidence` | Overall extraction confidence |
| `vendorName` | Detected vendor |
| `vendorPan` | PAN/VAT number if found |
| `billNumber` | Invoice or receipt number |
| `billDate` | Bill date |
| `paymentMethod` | cash, bank, wallet, credit, unknown |
| `subtotalAmount` | Amount before tax |
| `discountAmount` | Discount |
| `vatAmount` | VAT amount |
| `totalAmount` | Final total |
| `currency` | NPR by default |
| `parsedJson` | Full structured result |
| `approvedJson` | User-approved final result |
| `linkedRecordType` | expenses, purchases, sales |
| `linkedRecordId` | Created record ID |
| `createdBy` | User ID/name |
| `createdAt` | Timestamp |
| `reviewedAt` | Timestamp |

### `bill_scan_items`

| Field | Purpose |
| --- | --- |
| `id` | Unique item ID |
| `billScanId` | Parent scan |
| `itemName` | Detected item |
| `matchedProductId` | Optional inventory product |
| `quantity` | Quantity |
| `unit` | pcs, kg, liter, box, service |
| `unitPrice` | Price per unit |
| `discount` | Item discount |
| `taxAmount` | Item tax |
| `lineTotal` | Final line total |
| `confidence` | Item extraction confidence |

## Task Types And Implementation Backlog

### 1. Product And UX Tasks

| Priority | Task | Output | Acceptance Criteria |
| --- | --- | --- | --- |
| P0 | Define scanner MVP user flow | UX flow spec | User can scan, review, save, and download PDF in under 5 steps |
| P0 | Add Quick Add option `Scan Bill` | Web and Flutter entry point | Scan Bill is visible in Quick Add and uses a camera icon |
| P0 | Design AI preview screen | Wireframe/component spec | Low-confidence fields are obvious and editable |
| P1 | Design bill type selection | Purchase, expense, sales, unknown | User can change bill type before save |
| P1 | Design PDF preview actions | Preview/download/share/print | Actions use clear icons and labels |
| P2 | Create empty/error states | Friendly user copy | Non-technical users understand what failed |

### 2. Web Frontend Tasks

| Priority | Task | Files/Area | Acceptance Criteria |
| --- | --- | --- | --- |
| P0 | Add Scan Bill button to Quick Add | `QuickAdd` web page/component | Opens scanner modal |
| P0 | Build camera/upload modal | Next.js component | Supports camera capture and file upload fallback |
| P0 | Build processing state UI | Scanner modal | Shows upload, OCR, AI parsing, and validation steps |
| P0 | Build editable parsed data form | New scanner review component | User can edit vendor, date, items, VAT, total |
| P1 | Add PDF preview/download action | Documents/bill scanner UI | User can open generated PDF |
| P1 | Add bill scan list page | Documents module | Shows scanned bills as cards/table |
| P2 | Add duplicate warning UI | Scanner review screen | Duplicate bill number warning is visible before save |

### 3. Flutter Mobile Tasks

| Priority | Task | Files/Area | Acceptance Criteria |
| --- | --- | --- | --- |
| P0 | Add Scan Bill to center Quick Add | `mobile/lib/features/quick_add` | Button opens camera/upload flow |
| P0 | Add camera capture support | Flutter plugin integration | Android emulator/phone can capture or select image |
| P0 | Build mobile AI preview form | New scanner feature module | Parsed fields appear as mobile cards and inputs |
| P1 | Add share/download PDF action | Mobile detail screen | PDF can be opened/shared when available |
| P1 | Add offline scan queue shell | Local cache | Captured scan is not lost when internet fails |
| P2 | Add Nepali labels to scanner flow | `app_strings.dart` | Scanner UI translates fully |

### 4. Backend API Tasks

| Priority | Task | Endpoint | Acceptance Criteria |
| --- | --- | --- | --- |
| P0 | Create bill scan upload endpoint | `POST /api/bill-scans/upload` | Accepts image and creates scan record |
| P0 | Create parse endpoint | `POST /api/bill-scans/{id}/parse` | Runs OCR + AI and returns structured JSON |
| P0 | Create approve/save endpoint | `POST /api/bill-scans/{id}/approve` | Creates expense/purchase/sale and updates bootstrap |
| P0 | Create bill scan list endpoint | `GET /api/bill-scans` | Tenant-scoped scan list |
| P1 | Create scan detail endpoint | `GET /api/bill-scans/{id}` | Returns record, items, related records |
| P1 | Create retry endpoint | `POST /api/bill-scans/{id}/retry` | Failed scan can be reprocessed |
| P1 | Create PDF endpoint | `GET /api/bill-scans/{id}/pdf` | Returns generated PDF or signed URL |
| P2 | Add mobile aliases | `/api/mobile/bill-scans/*` | Flutter uses mobile namespace consistently |

### 5. AI/OCR Pipeline Tasks

| Priority | Task | Output | Acceptance Criteria |
| --- | --- | --- | --- |
| P0 | Build OCR provider interface | Service class | Google Vision can be swapped with fallback later |
| P0 | Integrate Google Vision OCR | OCR service | Extracts raw text from restaurant/retail bills |
| P0 | Build LLM structuring prompt | JSON schema prompt | Output validates against bill schema |
| P0 | Add validation rules | Parser service | Total, VAT, item totals checked before preview |
| P1 | Add confidence scoring | Parser output | Fields include confidence values |
| P1 | Add duplicate detection | Service rule | Same vendor + bill no + total warns user |
| P2 | Add Nepali/mixed text prompt variants | Prompt templates | Better extraction for Nepal bills |

### 6. Database And Storage Tasks

| Priority | Task | Area | Acceptance Criteria |
| --- | --- | --- | --- |
| P0 | Add `bill_scans` schema | Mongo schema contract | Scan data is tenant-scoped and indexed |
| P0 | Add `bill_scan_items` records | Mongo record kind or embedded items | Items persist with scan |
| P0 | Add local file storage for dev | Backend storage service | Images/PDFs work locally |
| P1 | Add S3/Cloudinary-ready abstraction | Storage service | Production storage can be configured by env |
| P1 | Add indexes | MongoDB | Query by workspace, status, date, vendor, bill number |
| P2 | Add retention cleanup task | Management command | Old failed uploads can be cleaned safely |

### 7. PDF And Template Tasks

| Priority | Task | Output | Acceptance Criteria |
| --- | --- | --- | --- |
| P0 | Choose PDF engine | WeasyPrint or ReportLab | Works on dev machine and deployment target |
| P0 | Build default invoice template | HTML/CSS template | Includes vendor, items, VAT, total, footer |
| P1 | Add business branding | Template data | Uses business name, PAN/VAT, logo if available |
| P1 | Add print/download/share flow | Web/mobile | PDF available after approval |
| P2 | Add template variants | Premium templates | Modern, VAT, restaurant, retail layouts |

### 8. Accounting And Inventory Integration Tasks

| Priority | Task | Affected Module | Acceptance Criteria |
| --- | --- | --- | --- |
| P0 | Map bill type to record type | Expenses/Purchases/Sales | User chooses what record to create |
| P0 | Expense receipt save flow | Expenses | Creates expense and VAT input entry |
| P0 | Purchase invoice save flow | Purchases/Inventory | Creates purchase and optionally stock movement |
| P1 | Sales bill save flow | Sales/Customers | Creates sale/invoice and credit entry if needed |
| P1 | Product matching | Inventory | Item names can match existing products |
| P2 | Suggested product creation | Inventory | Unknown item can create product with unit |

### 9. Security, Privacy, And Compliance Tasks

| Priority | Task | Acceptance Criteria |
| --- | --- | --- |
| P0 | Tenant-scope all scan records | Users cannot access other tenant scans |
| P0 | Validate upload type and size | Reject unsupported/oversized files |
| P0 | Store AI request logs safely | No secrets or tokens stored in records |
| P1 | Add permission checks | Only allowed roles scan/save/delete bills |
| P1 | Add audit logs | Scan, parse, edit, approve, delete are logged |
| P2 | Add data retention setting | Owner can control old image retention later |

### 10. QA And Testing Tasks

| Priority | Task | Acceptance Criteria |
| --- | --- | --- |
| P0 | Backend unit tests for upload/parse/approve | All core endpoints tested |
| P0 | Parser tests with sample OCR text | JSON output validates |
| P0 | Frontend camera/upload tests | Modal works with file fallback |
| P1 | Flutter scanner widget tests | Preview/edit/save screens render |
| P1 | Integration test with sample bill images | Expense/purchase created correctly |
| P1 | Permission tests | Unauthorized roles cannot approve scans |
| P2 | Stress test queue processing | Multiple scans process without blocking API |

### 11. DevOps And Configuration Tasks

| Priority | Task | Acceptance Criteria |
| --- | --- | --- |
| P0 | Add env variables for OCR/LLM providers | Local dev can run with mocked provider |
| P0 | Add worker process design | OCR/AI can run outside request thread |
| P1 | Add Celery/RQ background worker | Long OCR jobs do not block HTTP |
| P1 | Add provider fallback mode | If AI provider fails, scan stays in review state |
| P2 | Add cost tracking | Track OCR/LLM usage per workspace |

### 12. Business And Marketing Tasks

| Priority | Task | Output |
| --- | --- | --- |
| P0 | Define user-facing positioning | `Turn paper bills into digital records instantly` |
| P0 | Add landing page section | Smart Bill Scanner conversion copy |
| P1 | Add pricing gate | Free trial limits, Pro unlimited scans |
| P1 | Create demo script | Scan a Nepal-style shop bill end-to-end |
| P2 | Create help docs | How to scan, review, save, and download PDF |

## MVP Build Order

1. Database schema and backend scan records.
2. Local image upload endpoint.
3. Mock OCR/AI parser for development.
4. Web Quick Add Scan Bill flow.
5. Editable review screen.
6. Save as expense/purchase.
7. PDF generation.
8. Flutter Quick Add Scan Bill flow.
9. Google Vision integration.
10. OpenAI structured extraction.
11. QA and sample bill test suite.

## Do Not Build In MVP

- Training GPT from scratch.
- Full fraud detection.
- Advanced tax prediction.
- Batch scanning.
- RAG business assistant.
- Fine-tuned Nepal invoice model.
- Multi-provider AI marketplace.

## Success Metrics

| Metric | Target |
| --- | --- |
| Time from photo to editable preview | Under 12 seconds for MVP |
| Time from photo to saved record | Under 30 seconds |
| Manual fields user must type | 0 to 3 fields average |
| OCR/AI extraction accuracy | 80%+ on clean printed bills for MVP |
| User correction rate | Tracked per field |
| Scan-to-save completion rate | 70%+ after onboarding |

## Current Accuracy Test

Date tested: May 22, 2026

Detailed model report:

- `docs/custom_gpt_model_training_report_2026-05-22.md`

Scope tested:

- Controlled OCR text samples for hotel bills, retail bills with discount, rent receipts, eSewa/bank/cash payments, liter/kg quantities, VAT, and Nepali vendor names.
- Backend scanner API flow for upload, parse, approve, document creation, and bootstrap sync.

Results after parser fixes:

| Test Area | Result |
| --- | --- |
| Field extraction accuracy | 32 / 32 fields, 100% |
| Item extraction accuracy | 21 / 21 item fields, 100% |
| Overall controlled-sample accuracy | 53 / 53 checks, 100% |
| Backend scanner test suite | Passed |

Important limitation:

The current `GPTLanguageModel` is a local character-level PyTorch transformer that runs a forward pass, but it is not trained from a saved checkpoint yet. The reliable extraction accuracy currently comes from the deterministic structuring logic around the model. Real-world scanned image accuracy still requires true OCR integration, a larger labeled bill dataset, and evaluation on noisy photos.

## Final Product Positioning

RhinoPeak should not market this as an AI OCR feature. The better message is:

> Turn paper bills into organized digital records instantly.

This positions RhinoPeak as an AI-powered business operating system for emerging markets, with document intelligence as the first strong wedge.
