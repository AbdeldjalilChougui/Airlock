---
tags:
  - memory
  - decisions
  - airlock
last_updated: 2026-11-24
---

# Decisions

Newest first.

## 2026-11-24: Refuse ONLY_ON_DEVICE when no LanguageModel global
- **Decision:** `infer()` throws before calling the SDK if `globalThis.LanguageModel` is missing.
- **Why:** firebase 13.4.0 builds no Chrome adapter in that case and sends ONLY_ON_DEVICE requests to the cloud (reproduced in scripts/e2e-mocked.mjs). That would leak raw logs.
- **Rejected:** trusting the SDK mode alone.
- Affects: [[hybrid-ai]]

## 2026-11-24: Placeholders ⟦KIND_N⟧, same value → same placeholder
- **Decision:** dedupe by value (case-insensitive canonical for user terms); the vault lives only in tab memory.
- **Why:** the model can still correlate entities; rehydration is exact.
- **Rejected:** hashing values (not reversible client-side), storing the vault (defeats the purpose).
- Affects: [[scrubbing]]

## 2026-11-24: Nano scans rule-redacted text, entities must appear verbatim
- **Decision:** send Nano the text with rule placeholders, and accept an entity only if `findLiteral` finds it in the raw text.
- **Why:** fewer tokens, no hallucinated redactions.
- Affects: [[scrubbing]], [[hybrid-ai]]

## 2026-11-24: Extension has no cloud analysis
- **Decision:** the extension does scrub, on-device triage and "Copy scrubbed text"; cloud analysis stays in the web app.
- **Why:** reCAPTCHA App Check cannot load in MV3 extension pages, and App Check is required.
- Affects: [[extension]]

## 2026-11-24: App Check debug token only under literal import.meta.env.DEV
- **Why:** aliasing import.meta.env inlines the whole env object into prod bundles; the literal guard lets the bundler drop the token.
- Affects: [[cloud-services]]

Back to [[index]]
