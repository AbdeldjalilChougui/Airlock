# Airlock: demo video script (target 2:50, hard limit 3:00)

**Setup before recording**
- Chrome 139+ with Gemini Nano **downloaded** (Nano pill reads *Nano ready*).
- Live URL open, App Check enforced, dark theme, zoom 110%, a clean window at 1440×900.
- DevTools **Network** tab docked at the bottom, filtered to `firebasevertexai`.
- The *Messy log* sample loaded once beforehand so fonts and caches are warm. Then press **New incident**.
- Screen recorder at 1080p, mic checked.

---

## 0:00–0:30 · Who it's for, the problem, the answer (must land in 30 s)

| Time | Visual | Voice-over |
|---|---|---|
| 0:00 | A real-looking prod log scrolls. Highlight boxes pop on the Stripe key, email, IP, card. | "It's 2 a.m., you're on call, and this log has the answer, plus a live Stripe key, customer emails and a card number." |
| 0:08 | Cut to a chat box with a red ✕ over "paste". | "So you can't paste it into an AI. Most teams either redact by hand or go without help." |
| 0:15 | Airlock home screen. Zoom on the three chambers: *Your device → Airlock → Cloud*. | "Airlock is for on-call engineers. Gemini Nano scrubs the log **on your device** with Firebase AI Logic, only the placeholders go to cloud Gemini for the root cause, and the real values are put back locally." |
| 0:27 | Header pills: *Online · Nano ready · Cloud + App Check*. | "Hybrid, with every step labelled." |

## 0:30–1:15 · Scrub on-device (ONLY_ON_DEVICE)

| Time | Visual | Voice-over |
|---|---|---|
| 0:30 | Click **Messy log**. | "Here's a payments outage log with fake but realistic secrets." |
| 0:35 | Click **Scrub on this device**. The green *Nano scanning… ONLY_ON_DEVICE* line appears. | "Deterministic detectors run first: cloud keys, JWTs, passwords in connection strings, cards with a Luhn check, internal hostnames. Then Gemini Nano, with a JSON schema, finds what regex can't." |
| 0:50 | Left panel: *Nano added 3 context values*. Zoom on `Maya Okafor`, `Northwind Traders`, `Bluefin`, each tagged **Nano**. | "A person, a customer and an internal codename, found on-device." |
| 0:58 | Diff view: originals struck through → `⟦AWS_KEY_1⟧`, `⟦EMAIL_1⟧`… Click one IP to un-hide it, then click again to re-hide it. | "You review everything. Click to toggle. The same value always gets the same placeholder, so the model can still connect the dots." |
| 1:08 | Switch to **Exact payload**. Point at the green guard: *0 originals in payload*. | "This is byte for byte what leaves. The egress guard blocks the send if a single original is still in there." |

## 1:15–1:55 · Analyze in the cloud (PREFER_IN_CLOUD) + rehydrate

| Time | Visual | Voice-over |
|---|---|---|
| 1:15 | Click **Analyze in cloud**. The Network tab shows one `generateContent` request. Click it → Payload shows placeholders only. | "Now the cloud. This is the only request, and the payload contains placeholders only." |
| 1:28 | Result card. Zoom on the blue badge **Cloud · Gemini · 1.4 s**. | "The badge comes from the SDK's `inferenceSource`, not from a guess." |
| 1:33 | Scroll: likely cause, evidence lines, numbered fix steps with green highlighted values. | "Root cause, evidence and fix steps as structured JSON. The green values were restored on this device: the real hostname, the keys to rotate, who to notify." |
| 1:45 | Toggle **Rehydrated → Showing what the model saw**. Placeholders appear. Toggle back. | "Flip the switch to see exactly what Gemini saw. It never saw the real names." |

## 1:55–2:30 · Network off: on-device triage (PREFER_ON_DEVICE)

| Time | Visual | Voice-over |
|---|---|---|
| 1:55 | DevTools → Network → **Offline** (or Wi-Fi off). The header pill turns amber: *Offline*. | "Now let's lose the network." |
| 2:00 | Back to review. **Analyze in cloud** is disabled. Click **Quick triage**. | "Cloud analysis is unavailable, but quick triage prefers the device." |
| 2:06 | Triage card with the green badge **On-device · Gemini Nano · 0.9 s**. The Network tab shows no new requests. | "One-line diagnosis and next step from Gemini Nano. Zero network requests." |
| 2:15 | Open the **Privacy ledger**. Rows: Context scrub ONLY_ON_DEVICE → on-device, Root-cause PREFER_IN_CLOUD → cloud, Quick triage PREFER_ON_DEVICE → on-device. Stats: *0 raw values sent*. | "The privacy ledger keeps the receipts: the mode we asked for and where each call really ran." |

## 2:30–2:50 · Extension, screenshot, persistence, close

| Time | Visual | Voice-over |
|---|---|---|
| 2:30 | Back online. In a GitHub issue tab, select a log → right-click **Scrub selection with Airlock** → side panel opens already scrubbed. | "The Chrome extension scrubs any selection or your clipboard right in the side panel." |
| 2:38 | Web app: drop an error **screenshot** → "Transcribed locally. The image is never uploaded." | "Screenshots are transcribed by Nano on-device and then scrubbed like text." |
| 2:43 | **Save incident (redacted)** → Incidents drawer. Show the stored text with placeholders. | "Saved incidents in Firestore hold only redacted text, behind App Check. The policy comes from Remote Config." |
| 2:47 | Logo + tagline: **Airlock: scrub on-device, reason in the cloud.** | "Airlock. Use AI on your worst logs without leaking them." |

---

## Shot list checklist
- [ ] Header pills: Online · **Nano ready** · Cloud + App Check
- [ ] Nano scan line with **ONLY_ON_DEVICE** chip, and items tagged **Nano**
- [ ] Diff → Exact payload → egress guard "0 originals"
- [ ] DevTools request payload showing placeholders only
- [ ] **Cloud · Gemini** badge on the analysis
- [ ] Rehydrate toggle (both states)
- [ ] **Network off** → Analyze disabled → **On-device · Gemini Nano** badge on triage, with no new requests in the Network tab
- [ ] Privacy ledger table and "0 raw values sent"
- [ ] Extension: context-menu "Scrub selection with Airlock" → side panel
- [ ] Screenshot OCR notice "never uploaded"
- [ ] Saved incident showing redacted text
