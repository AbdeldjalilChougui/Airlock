# Devpost submission: Airlock

## Project name
Airlock

## Tagline (≤ 60 chars)
Scrub logs on-device. Reason in the cloud. Restore locally.

## Platforms
Web (Chrome desktop) · Chrome extension (MV3 side panel)

## Links
- Live app: https://<project-id>.web.app
- Code: https://github.com/AbdeldjalilChougui/Airlock
- Video: <YouTube URL>

---

## Inspiration
Every on-call engineer knows the 2 a.m. moment: the log scrolling past contains the answer, and also a Stripe live key, three customer emails, an internal hostname and a card number. Most companies (and most engineers' instincts) say *don't paste that into an AI*. So people either skip AI help when they need it most, or spend ten minutes redacting by hand and miss something.

Hybrid inference splits that problem in two. The step that has to see the raw data (finding what's sensitive) can run on the laptop with Gemini Nano. The step that needs a big model (root cause) only ever needs the *shape* of the data, not the secrets. We built Airlock around that split.

## What it does
1. **Paste** a log, stack trace or config, or drop a PNG/JPEG screenshot of an error.
2. **Scrub on-device.** 25+ deterministic detectors catch AWS/GCP/Stripe/GitHub/Slack keys, JWTs, PEM keys, passwords inside connection strings, Sentry DSNs, emails, phones, IPs, internal hostnames, Luhn-valid cards, customer/user IDs and high-entropy strings. Then **Gemini Nano**, running locally with a JSON schema, finds what regexes can't: people's names, customer names and project codenames. Each value becomes a reversible placeholder such as `⟦EMAIL_1⟧`, and the same value always gets the same one.
3. **Review the diff.** You see every original struck through next to its placeholder, plus the exact payload byte for byte. Toggle any item or category, or add your own terms. An egress guard confirms "0 originals in payload".
4. **Analyze in the cloud.** Only the scrubbed text goes to Gemini, which returns structured JSON: summary, likely cause, severity, confidence, evidence lines, fix steps and follow-ups.
5. **Rehydrate locally.** Placeholders in the answer turn back into real hostnames, names and keys, highlighted, without the cloud ever seeing them. One switch shows exactly what the model saw.
6. **Quick triage offline.** A one-line on-device diagnosis that works on a plane.

Every result has a badge showing where inference **actually** ran, read from the SDK's `inferenceSource`. A privacy ledger lists every call: requested mode, actual source, latency, and characters sent.

Saved incidents (Firestore) contain only redacted text. The redaction policy comes from Remote Config. App Check (reCAPTCHA) protects the cloud. A Chrome extension adds **Scrub selection** and **Scrub clipboard** in a side panel.

## How we built it
- **Vite + React + TypeScript.** One codebase for the web app and the MV3 Chrome extension.
- **Firebase AI Logic hybrid inference:** one `GenerativeModel` per `InferenceMode`, each picked for a privacy reason:
  - `ONLY_ON_DEVICE`: the context scan of the raw log, and screenshot → text (text + image input). Raw data must never fall back to the cloud.
  - `PREFER_IN_CLOUD`: root-cause analysis on the scrubbed text.
  - `PREFER_ON_DEVICE`: quick triage, which still works offline. Its input is scrubbed, so a fallback is safe.
- **Structured output on both paths.** The same JSON Schema goes to `onDeviceParams.promptOptions.responseConstraint` (Prompt API) and to `generationConfig.responseJsonSchema` (cloud).
- **Context window handling.** We read Nano's `contextWindow` and split long logs on line boundaries into chunks that leave room for the prompt and the JSON answer. Triage gets a focused excerpt: error lines with context, plus the tail.
- `initializeDeviceModel()` runs on a user click, with download progress shown.
- **Firebase App Check** (reCAPTCHA Enterprise/v3; a debug token for local dev that is compiled out of production builds), **Anonymous + Google Auth**, **Firestore** (owner-only rules that accept only the redacted-incident schema), **Remote Config** (redaction policy), **Hosting**.
- **Tests and checks.** 45 vitest unit tests cover the detectors (including false-positive cases such as stack-frame file names, Java packages, git SHAs and timestamps), placeholders, rehydration and chunking. A Playwright end-to-end run uses the real SDK with mocked backends and asserts that zero raw values appear in any outgoing cloud request.

## Challenges we ran into
- **An SDK edge case that could leak data.** In `firebase@13.4.0`, if the browser has no `LanguageModel` global at all (Firefox, Safari, older Chrome), an `ONLY_ON_DEVICE` model is built without its on-device adapter, and requests are **sent to the cloud** instead of failing. We reproduced it with a scripted test. Airlock now refuses on-device calls unless the Prompt API exists, and it also discards any `ONLY_ON_DEVICE` result whose `inferenceSource` isn't `on_device`.
- **Precision vs. recall in log scrubbing.** Stack traces are full of things that look like hostnames (`client.js`, `com.acme.billing`). Timestamps look like phone numbers, and git SHAs look like secrets. We tuned each detector against real log shapes and wrote a regression test for each false-positive class.
- **Small context windows.** Nano's window is much smaller than a real incident log, so we chunk by lines with a conservative token estimate and merge entities across chunks.
- **Hallucinated entities.** We only accept a Nano entity if its exact text appears in the log.
- **App Check inside an extension.** reCAPTCHA can't load in an MV3 extension page, so the extension stays fully on-device (scrub, triage, copy scrubbed text), and cloud analysis stays in the App Check-protected web app.

## Accomplishments that we're proud of
- A privacy story you can *see*: a diff of what stays behind, the exact payload, a live egress guard, source badges taken from SDK metadata, and a per-call ledger.
- Reversible placeholders that keep identity ("the same customer in lines 3 and 40"), so cloud answers stay useful and come back with real values.
- Screenshots of errors are handled without uploading the image.
- It still works when the on-device model is missing (rules) and when the network is gone (Nano triage).

## What we learned
- Hybrid isn't only "on-device when possible". The mode is a **policy decision per feature**: raw data gets `ONLY_ON_DEVICE`, scrubbed data can use the cloud.
- Trust SDK metadata (`inferenceSource`), but verify it, and fail closed.
- Structured output is what makes a small on-device model dependable in a pipeline.

## What's next
- An IDE extension (VS Code) and a CLI for piping logs (`kubectl logs … | airlock`).
- Team-shared custom detectors through Remote Config (internal hostname patterns, ID formats).
- Encrypted, user-held vault export so saved incidents can be rehydrated later, with the key never on the server.
- More on-device languages as the Prompt API adds them.

## Built with
firebase, firebase-ai-logic, gemini, gemini-nano, chrome-built-in-ai, prompt-api, firebase-app-check, recaptcha-enterprise, firebase-auth, cloud-firestore, firebase-remote-config, firebase-hosting, react, typescript, vite, vitest, playwright, chrome-extension
