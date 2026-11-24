---
tags:
  - memory
  - module
  - airlock
last_updated: 2026-11-24
related_files:
  - "src/firebase/app.ts"
  - "src/firebase/cloud.ts"
  - "firestore.rules"
  - "remoteconfig.template.json"
  - "firebase.json"
---

# Cloud services

**Purpose:** Firebase init + App Check (reCAPTCHA Enterprise/v3; debug token in dev only), anonymous/Google auth, redacted-only incidents in Firestore, and the redaction policy from Remote Config.

## Main functions
- `cloudReady`: project configured AND App Check initialized; gates all cloud UI
- `saveIncident`: runs findLeaks on the whole document before writing; `listIncidents`, `deleteIncident`
- `loadPolicy`: Remote Config → Policy

## Gotchas
> [!warning]
> Without .env.local the app initializes with inert placeholder config, so on-device features keep working. The rules accept only the exact incident field set, with createdAt == request.time.

See also: [[decisions]]
