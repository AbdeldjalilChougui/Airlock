---
tags:
  - memory
  - index
  - airlock
last_updated: 2026-11-24
---

# Airlock

Hackathon entry (#BuildHybridAI, due 2026-11-30 14:00 PT): developer incident triage that scrubs logs on-device (rules + Gemini Nano), analyzes scrubbed text with cloud Gemini, and rehydrates the answer locally.

## Stack
- Vite + React 19 + TypeScript, vitest, Playwright (playwright-core) scripts
- Firebase JS SDK 13.4: AI Logic (hybrid), App Check, Auth, Firestore, Remote Config, Hosting
- Chrome MV3 extension built from the same code (vite.ext.config.ts)

## Live
- Firebase project airlock-hybrid-ff7ef0, live at https://airlock-hybrid-ff7ef0.web.app (App Check reCAPTCHA Enterprise enforced)

## Map
- [[architecture]]: how the parts fit together
- [[decisions]]: why things were built this way
- [[log]]: recent changes, newest first
- [[modules]]: base view of all module notes

## Modules
- [[scrubbing]]: detectors, entropy, vault/placeholders, chunking, policy (src/lib)
- [[hybrid-ai]]: one GenerativeModel per InferenceMode, pipeline, ledger (src/firebase/ai.ts, pipeline.ts)
- [[cloud-services]]: Firebase app, App Check, Auth, Firestore, Remote Config (src/firebase/app.ts, cloud.ts)
- [[ui]]: React stages and drawers (src/ui, src/useAirlock.ts)
- [[extension]]: MV3 side panel + service worker (src/ext, ext/, extension/)

## To revisit
- Live cloud + real Nano paths were verified only with mocks
