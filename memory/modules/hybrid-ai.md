---
tags:
  - memory
  - module
  - airlock
last_updated: 2026-11-24
related_files:
  - "src/firebase/ai.ts"
  - "src/firebase/pipeline.ts"
  - "src/lib/prompts.ts"
  - "src/lib/ledger.ts"
---

# Hybrid AI

**Purpose:** all inference through Firebase AI Logic, with one model per InferenceMode: scrub/ocr ONLY_ON_DEVICE, analyze PREFER_IN_CLOUD, triage PREFER_ON_DEVICE.

## Main functions
- `infer(feature, input, {vault})`: egress guard, LanguageModel pre-check, reads `response.inferenceSource`, writes the ledger
- `nanoEntities`, `transcribeScreenshot`, `analyzeInCloud`, `quickTriage` (pipeline.ts)
- `deviceAvailability`, `deviceContextWindow`, `initializeDeviceModels` (user gesture)

## Gotchas
> [!warning]
> On-device ignores systemInstruction, so prompts are self-contained. Schemas go to `responseConstraint` (device) and `responseJsonSchema` (cloud). The default cloud model is the SDK hybrid default gemini-3.5-flash-lite (override with VITE_CLOUD_MODEL).

Uses: [[scrubbing]]. Used by: [[ui]]
