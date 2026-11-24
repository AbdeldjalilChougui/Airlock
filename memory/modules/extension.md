---
tags:
  - memory
  - module
  - airlock
last_updated: 2026-11-24
related_files:
  - "src/ext/sidepanel.tsx"
  - "src/ext/background.ts"
  - "extension/manifest.json"
  - "vite.ext.config.ts"
---

# Extension

**Purpose:** MV3 side panel running the same App. The context menu "Scrub selection with Airlock" sends the text through chrome.storage.session to the panel. The Clipboard button scrubs the clipboard.

## Gotchas
> [!warning]
> No App Check in the extension (reCAPTCHA can't load), so cloud analysis is replaced by "Copy scrubbed text". Build with `npm run build:ext` and load dist-ext/ unpacked. scripts/ext-shot.mjs checks the hand-off.

See also: [[decisions]], [[ui]]
