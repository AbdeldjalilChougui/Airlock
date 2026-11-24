---
tags:
  - memory
  - module
  - airlock
last_updated: 2026-11-24
related_files:
  - "src/lib/detectors.ts"
  - "src/lib/vault.ts"
  - "src/lib/chunk.ts"
  - "src/lib/policy.ts"
---

# Scrubbing

**Purpose:** pure, synchronous, tested logic: find sensitive spans, turn them into reversible placeholders, and restore them.

## Key files
- `src/lib/detectors.ts`: rule list (priority-based overlap resolution), hostname/IP/Luhn validators, `findLiteral`
- `src/lib/entropy.ts`: Shannon entropy + `looksLikeSecret` (skips 40-char hex git SHAs)
- `src/lib/vault.ts`: `buildItems`, `addLiteralFindings`, `redact`, `rehydrate*`, `findLeaks` (egress guard)
- `src/lib/chunk.ts`: line-based chunking to the Nano context window, `focusExcerpt`
- `src/lib/policy.ts`: Policy defaults + Remote Config parsing; `src/lib/samples.ts`: demo logs (fake secrets assembled at runtime)

## Gotchas
> [!warning]
> Hostname rule is the noisiest: it relies on a TLD allowlist, a reverse-domain (com.acme.x) skip, and skipping email domains. Add a test for every new false positive (tests/detectors.test.ts).

Used by: [[hybrid-ai]], [[ui]]. See also: [[decisions]]
