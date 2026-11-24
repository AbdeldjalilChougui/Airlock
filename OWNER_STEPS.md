# Owner steps: what's left before submitting

Deadline: **Mon 30 Nov 2026, 14:00 PT** (23:00 Algeria time).

Already done: the full web app and Chrome extension, 45 passing unit tests, a passing production build, a mocked end-to-end run, screenshots, README, Devpost text and video script. Everything is committed locally and nothing is pushed.

Still blocked: the Firebase project could not be created from the CLI. Google answered **"you have exceeded your allotted project quota"** (31 projects on the account), so nothing is deployed yet and the cloud path has not been tested against a real backend.

---

## 0. Free a project slot (pick one)

- Delete a project you no longer use: console → Project settings → *Delete project*. A deleted project counts against quota for up to 30 days, so it is often faster to:
- Ask for more quota: https://support.google.com/code/contact/project_quota_increase (usually approved within hours to 2 days).
- Or reuse an existing, unused project. It works, but a dedicated project keeps the demo clean.

## 1. Create the project and web app (CLI)

```bash
cd /myhome/djalil/DEV/Hacks/Airlock
firebase projects:create airlock-hybrid-ff7ef0 --display-name "Airlock"   # any free id
firebase use --add airlock-hybrid-ff7ef0          # alias: default
firebase apps:create WEB "Airlock Web"
firebase apps:sdkconfig WEB                         # copy the values into .env.local
cp .env.example .env.local                          # then fill VITE_FIREBASE_*
```

Do **not** enable billing. The Gemini Developer API free tier is enough.

## 2. Console clicks (https://console.firebase.google.com/project/<id>)

1. **AI Services → AI Logic → Get started → Gemini Developer API.** This enables `firebasevertexai.googleapis.com` and `generativelanguage.googleapis.com` and creates the restricted key. Choose no billing.
2. **Build → Firestore Database → Create database** (production mode, e.g. `eur3` or `nam5`). Or: `firebase firestore:databases:create "(default)" --location=eur3`.
3. **Build → Authentication → Get started → Sign-in method:** enable **Anonymous** and **Google**.
4. **Run → Remote Config → Create configuration** (one click so the API is on). The parameters are deployed from `remoteconfig.template.json` in step 4.
5. **App Check (required):**
   - Create a **reCAPTCHA Enterprise** key in Google Cloud → Security → reCAPTCHA (type *Website*; domains `<id>.web.app` and `<id>.firebaseapp.com`). **Do not add `localhost`.** Or create a reCAPTCHA **v3** key at https://www.google.com/recaptcha/admin with the same domains.
   - Firebase console → **App Check → Apps → Airlock Web → reCAPTCHA Enterprise** (or v3 + secret key) → Save.
   - Put the site key in `.env.local` as `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` (or `VITE_RECAPTCHA_V3_SITE_KEY`).
   - **App Check → APIs:** set **Firebase AI Logic** and **Cloud Firestore** to **Enforce**. Remote Config isn't enforceable; that's expected.
   - **Local dev:** App Check → Apps → ⋮ → *Manage debug tokens* → *Add debug token* (generate a UUID) → put it in `.env.local` as `VITE_APPCHECK_DEBUG_TOKEN`. It is used only by `npm run dev` and is never committed or bundled.

## 3. Check it locally

```bash
npm install
npm run dev     # open http://localhost:5173 in Chrome 139+
```

The header should read **Online · Nano … · Cloud + App Check**. Click **Messy log → Scrub → Analyze in cloud**. The result card should show the blue **Cloud · Gemini** badge.

## 4. Deploy

```bash
npm run build
firebase deploy --only hosting,firestore,remoteconfig
```

Live URL: `https://<id>.web.app`. Replace the placeholder at the top of `README.md` and in `submission/devpost.md`.

## 5. On-device model (Gemini Nano)

This machine's `/` has about **14 GB free**, and Chrome needs **22 GB free** on the volume that holds the Chrome profile. Either free about 8 GB, record on another machine, or point a Chrome profile at a disk with room (for example `google-chrome --user-data-dir=/path/on/bigger/disk`).

1. Chrome desktop 139+.
2. `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` → Enabled
3. `chrome://flags/#optimization-guide-on-device-model` → Enabled BypassPerfRequirement
4. Relaunch → in Airlock click the **Nano** pill → **Download Gemini Nano**, and wait for 100% (check progress in `chrome://on-device-internals`).
5. Check: **Messy log → Scrub**. The left panel should show *"Nano added N context values"* (Maya Okafor, Northwind Traders, Bluefin), each tagged `Nano`.

## 6. GitHub

```bash
cd /myhome/djalil/DEV/Hacks/Airlock
gh repo create AbdeldjalilChougui/Airlock --public --source . --remote origin --push
gh repo edit AbdeldjalilChougui/Airlock \
  --description "Scrub logs on-device with Gemini Nano, analyze in the cloud, rehydrate locally — Firebase AI Logic hybrid inference" \
  --homepage "https://<id>.web.app" \
  --add-topic firebase --add-topic gemini-nano --add-topic hybrid-ai --add-topic chrome-extension --add-topic privacy
```

GitHub detects the license from `LICENSE`, and the About box shows **Apache-2.0** after the push. If it doesn't, open the repo → ⚙ next to *About* and confirm. The demo secrets are fake and assembled at runtime, so push protection should not trigger. If it does, choose *"It's used in tests"*.

## 7. Record the video (≤ 3:00)

Follow `submission/video-script.md`. You need:
- Chrome with Nano **downloaded** (step 5), so the on-device badge is real.
- The live URL with App Check enforced.
- DevTools → Network panel visible for the network-off shot (or turn off Wi-Fi).

Then retake `submission/screenshots/11-…` to `15-…` against the live project. The current ones come from the mocked run.

Upload to YouTube (public or unlisted).

## 8. Devpost form

Paste the fields from `submission/devpost.md`. Add the video URL, the live URL, the GitHub URL and 3–5 screenshots (`03`, `04`, `12`, `14`, `17` work well). Platform: **Web** and **Chrome extension**.
