# RhinoPeak Dashboard - AI Models Audit & Improvement Report

## Overview
This document serves as an audit and technical report resolving the issue seen by users where commands such as "नयाँ सेल्स एड गर" (Add a new sale) were failing in the application's AI.

## 1. Custom Rule-Based Assistant AI (`assistant_service.py`)

### Audit Findings
- **Architecture**: A rule-based Natural Language Understanding (NLU) engine using simple string matching logic mapped to intents.
- **Bugs Found**: The intent matching array for the `record_sale` intent only matched exact words like `"record sale"`, `"add sale"`, `"बिक्री"`, `"बेचे"`. The keyword `"सेल्स"` (Sales in Nepali Devanagari) and the specific query `"नयाँ सेल्स एड गर"` were not covered.
- **Improvements Applied**:
  - Expanded intent vocabulary to accurately map terms such as `"सेल्स"`, `"सेल"`, `"नयाँ सेल्स एड गर"`, `"खर्चा"`, `"नयाँ सामान"`, `"पार्टी भुक्तानी"` and more across various intents.

### Auto-Learning Memory (New Feature)
- The model now features a "Learning Memory" database intercept layer.
- If the offline intent match succeeds, it resolves instantly.
- If the offline intent match fails (intent: `unknown`), it makes a fallback call to the Gemini API (`gemini-2.0-flash`) using Structured JSON outputs.
- Once Gemini successfully identifies the intent and extracts the data, it stores the results into a new `learning_memory` MongoDB collection.
- Future identical prompts are matched directly against this MongoDB cache—making the custom AI continuously "learn" from its prior shortcomings.

## 2. KaroBrain™ Vision Engine / GPT Model (`gpt_model.py`)

### Audit Findings
- **Architecture**: Contains a NanoGPT character-level transformer that acts as a confidence/activation generator, followed by heavily specialized Regex-based extraction functions for English/Nepali (Devanagari) bill layouts.
- **Bugs & Deficiencies**: While the regex parser handles common Nepalese retail formats efficiently, novel formats previously failed over to Gemini without storing the parsed result.
- **Improvements Applied**:
  - Integrated the `learning_memory` MongoDB schema into the bill scanning pipeline.
  - Before performing offline or Gemini structuring, the model checks if it has previously successfully structured an identical raw OCR text. If yes, it retrieves the extraction locally.
  - When a receipt has low confidence and escalates to the Gemini LLM for complex structural understanding, the extracted JSON payload is now saved into the database's `learning_memory` collection to facilitate ongoing auto-learning.

## Schema Modifications (`mongo_schema.py` & `mongo_service.py`)
- Created a new record type: `learningMemory` (`learning_memory` collection) with proper input payload hashing (MD5 hash of the original input).
- Enforced required fields and timestamps on all learning memories, differentiating between assistant intents (`sourceType: "assistant"`) and receipt structural extractions (`sourceType: "bill_scan"`).

## Summary
The RhinoPeak AI subsystem is now significantly more robust to edge cases in the Nepali language and efficiently caches Gemini's more expensive structural extraction work to "auto-learn" new rules dynamically.
