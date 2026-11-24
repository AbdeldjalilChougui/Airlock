---
tags:
  - memory
  - module
  - airlock
last_updated: 2026-11-24
related_files:
  - "src/useAirlock.ts"
  - "src/App.tsx"
  - "src/ui/ReviewStage.tsx"
  - "src/ui/ResultStage.tsx"
  - "src/ui/Panels.tsx"
  - "src/styles.css"
---

# UI

**Purpose:** a three-chamber flow (input → review → result) with drawers for the ledger, policy, on-device model setup and incidents.

## Key files
- `src/useAirlock.ts`: all state and actions (scrub, toggle, addTerm, ocr, analyze, runTriage, save, downloadModel)
- `src/ui/ReviewStage.tsx`: grouped items, diff/payload view, egress guard action bar
- `src/ui/ResultStage.tsx`: analysis/triage cards, rehydrate toggle, Markdown copy
- `src/ui/bits.tsx`: SourceBadge (from inferenceSource), Drawer, Switch
- `src/styles.css`: tokens on :root (dark) and [data-theme=light]; .is-ext layout overrides

Uses: [[scrubbing]], [[hybrid-ai]], [[cloud-services]]
