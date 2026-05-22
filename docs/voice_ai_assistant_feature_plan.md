# RhinoPeak Voice AI Assistant Plan

Date: 2026-05-22
Feature area: Custom GPT / Voice commands / AI assistant

## Product Goal

Add a voice-first assistant that helps shop owners and staff perform daily business tasks faster:

- Scan a bill.
- Add an expense.
- Add a customer or supplier.
- Add a product such as milk measured in liter.
- Open reports, analytics, or dashboard.
- Draft sales, payments, stock movement, and credit actions for review.

The assistant must be workflow-native. It should not behave like a generic chatbot. Every response should map to a RhinoPeak business action, a safe draft, or a clear follow-up question.

## Current Implementation

The backend now includes a safe assistant command endpoint:

```http
POST /api/assistant/command
```

Request body:

```json
{
  "transcript": "add expense NPR 500 rent paid cash",
  "language": "en",
  "confirm": false
}
```

Response body:

```json
{
  "assistantCommand": {
    "intent": "add_expense",
    "confidence": 0.95,
    "requiresConfirmation": true,
    "canExecute": true,
    "route": "/expenses",
    "slots": {
      "amount": 500,
      "category": "Rent",
      "vendor": "Rent",
      "paymentMethod": "Cash"
    },
    "warnings": [],
    "reply": "I prepared this action. Review it once, then confirm to save it."
  }
}
```

Confirmed request:

```json
{
  "transcript": "add customer Maya Store 9803333333",
  "confirm": true
}
```

Supported execution in the current MVP:

- `add_expense`
- `add_customer`
- `add_supplier`
- `add_product`
- `create_report`

Draft-only actions in the current MVP:

- `scan_bill`
- `record_sale`
- `record_payment`
- `stock_movement`
- `open_dashboard`
- `open_analytics`

Draft-only actions are intentional because these workflows can affect inventory, credit, or cash balances and require user review.

The web Quick Add page now includes the first assistant entry point:

- Microphone button using browser speech recognition when available.
- Text fallback for browsers that do not support speech recognition.
- Assistant draft preview with intent, confidence, extracted fields, warnings, and confirm/save action.
- Confirmed safe actions refresh the workspace bootstrap data.

## Recommended Speech Architecture

### Web

Use one of two paths:

1. Browser speech recognition for low-cost command capture.
2. OpenAI transcription or realtime voice for higher quality and better multilingual handling.

Recommended MVP:

```text
Microphone
  -> speech-to-text transcript
  -> POST /api/assistant/command
  -> show assistant draft
  -> user taps Confirm
  -> POST /api/assistant/command with confirm=true
```

### Flutter Mobile

Recommended MVP:

```text
speech_to_text plugin
  -> local device speech recognition transcript
  -> API command parser
  -> editable confirmation sheet
  -> safe backend execution
```

For production-grade accuracy in noisy shops, add a server transcription fallback:

```text
Recorded audio
  -> OpenAI gpt-4o-transcribe or equivalent STT provider
  -> assistant command parser
  -> confirmation UI
```

## 99 Percent Accuracy Definition

Do not define 99 percent accuracy as "the assistant is always right." That is impossible to promise in real shops with noise, accents, mixed Nepali/English commands, and incomplete user speech.

Define it as:

```text
99 percent exact-intent accuracy on a locked command set,
with no automatic execution for low-confidence or incomplete commands.
```

Required metrics:

- Intent accuracy: command maps to the correct business task.
- Slot accuracy: amount, name, phone, payment method, unit, and category are correct.
- False execution rate: assistant must not write wrong business data.
- Clarification rate: assistant asks for missing details instead of guessing.
- Language split: English, Nepali, and mixed Nepali-English tested separately.

Target before marketing:

| Metric | Required |
| --- | ---: |
| Intent accuracy on supported commands | 99% |
| Amount extraction exact match | 99% |
| Phone extraction exact match | 98% |
| Name extraction exact match | 95% |
| Unsafe auto-execution rate | 0% |
| Low-confidence command execution | 0% |

## Assistant Command Dataset

Create a dataset with at least 5,000 labeled commands:

- 1,000 expense commands.
- 800 customer commands.
- 700 supplier commands.
- 800 inventory/product commands.
- 800 sale/payment/credit commands.
- 500 report/navigation commands.
- 400 unknown/out-of-scope commands.

Each sample should include:

```json
{
  "transcript": "kharcha 500 rent cash",
  "language": "mixed",
  "intent": "add_expense",
  "slots": {
    "amount": 500,
    "category": "Rent",
    "paymentMethod": "Cash"
  },
  "shouldExecute": true
}
```

## Safety Rules

- Never delete data through voice command in v1.
- Never change subscription, billing, tax rate, or user roles through voice command in v1.
- Never save sales, payment received, credit clear, or stock movement without an editable review screen.
- Always show the recognized transcript to the user.
- Always show confidence and missing fields.
- Always require confirmation before database writes.
- Store an audit entry for every parsed and executed assistant command.

## Implementation Tasks

### Backend

1. Add assistant command parser service. Done.
2. Add `POST /api/assistant/command`. Done.
3. Add safe execution for low-risk create actions. Done.
4. Add tests for English and Nepali commands. Done.
5. Add intent dataset fixtures for 5,000 labeled commands.
6. Add evaluation command that writes assistant intent and slot accuracy.
7. Add optional OpenAI structured intent extraction fallback behind environment flag.
8. Add assistant command history record if product wants user-visible history.

### Web

1. Add assistant microphone button to Quick Add. Done.
2. Add browser speech capture with visible recording state. Done.
3. Add assistant review sheet with transcript, intent, slots, confidence, and confirm button. Done.
4. Add assistant to top command search.
5. Add Nepali command examples in UI when Nepali language is selected.
6. Add fallback text command input for low-literacy staff helpers. Done.

### Flutter

1. Add `speech_to_text` dependency.
2. Add Android `RECORD_AUDIO` permission.
3. Add iOS `NSSpeechRecognitionUsageDescription` and `NSMicrophoneUsageDescription`.
4. Add large voice button inside center Quick Add flow.
5. Add assistant confirmation bottom sheet.
6. Add offline queue only for draft commands, not final writes.

### AI Layer

1. Keep deterministic parser as the safety baseline.
2. Add LLM intent extraction only when deterministic confidence is low.
3. Use structured output schema for intent and slots.
4. Reject unsupported tool calls.
5. Log model version, prompt version, latency, and confidence.
6. Run weekly regression tests against labeled command fixtures.

## Recommended Assistant Roadmap

### V1

- Voice-to-text command capture.
- Intent parsing.
- Safe create actions.
- Review and confirm.

### V2

- Sales and stock movement review screens.
- Payment received and credit clear workflows.
- Nepali voice command examples.
- Assistant command history.

### V3

- Realtime voice assistant.
- Spoken responses.
- Business Q&A: "How much did I sell today?"
- Role-aware actions and permission explanations.

## Honest Status

The assistant backend is now scaffolded and testable. It is not yet a trained 99 percent speech model. The correct next step is to build the command dataset, add web/mobile microphone UI, and run measured intent/slot accuracy tests before making any accuracy claim.
