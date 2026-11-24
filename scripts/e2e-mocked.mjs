// End-to-end check of the full hybrid flow with BOTH backends mocked:
//  - Chrome's `LanguageModel` (Gemini Nano) is stubbed in the page, so the real
//    Firebase AI Logic SDK takes its on-device path and reports inferenceSource=on_device.
//  - firebasevertexai.googleapis.com and App Check token exchange are intercepted, so the
//    real SDK takes its cloud path and reports inferenceSource=in_cloud.
// It asserts that no raw secret ever appears in an intercepted cloud request body.
//
// Start the dev server with a mock config first (see README "Verifying without a project"):
//   VITE_FIREBASE_API_KEY=mock-api-key VITE_FIREBASE_PROJECT_ID=airlock-mock \
//   VITE_FIREBASE_APP_ID=1:123:web:abc VITE_APPCHECK_DEBUG_TOKEN=11111111-2222-4333-8444-555555555555 \
//   npx vite --port 5318
// then: node scripts/e2e-mocked.mjs http://localhost:5318
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5318';
const out = new URL('../submission/screenshots/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const executablePath = process.env.CHROME_PATH ?? '/home/djalil/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';

const RAW = ['maya.okafor@northwind-traders.com', '10.42.7.19', '4242 4242 4242 4242', 'Tr0ub4dor-and-3', 'pg-primary.payments.internal', 'Maya Okafor', 'Northwind Traders', 'AKIAIOSFODNN7EXAMPLE'];

const ANALYSIS = {
  summary: 'payments-api cannot reach the primary Postgres at ⟦HOSTNAME_1⟧ (⟦IP_1⟧:5432) and crash-loops on readiness',
  likelyCause:
    'TCP connects to ⟦IP_1⟧:5432 time out, so the pg pool (max=20) exhausts with 147 waiters; inserts in LedgerRepository.insertCharge fail and the readiness probe kills the pod. Likely a security-group/NetworkPolicy change or the primary failing over.',
  severity: 'critical',
  confidence: 0.82,
  evidence: [
    { line: '2026-11-24T09:41:13.004Z ERROR pg: connect ETIMEDOUT ⟦IP_1⟧:5432 (attempt 1/3)', why: 'Network-level timeout, not auth failure' },
    { line: '2026-11-24T09:41:23.010Z WARN  pool exhausted (max=20, waiting=147) — falling back to replica ⟦HOSTNAME_2⟧', why: 'Requests pile up behind the dead primary' },
    { line: '2026-11-24T09:41:24.002Z FATAL readiness probe failed 3x — k8s will restart pod payments-api-7d9c8b-xk2lp', why: 'Crash-loop amplifies the outage' },
  ],
  fixSteps: [
    'From the pod, test reachability: `nc -vz ⟦HOSTNAME_1⟧ 5432` and check NetworkPolicy / security-group changes in the last hour.',
    'Check primary health and failover status; if failed over, point DATABASE_URL at the new writer endpoint.',
    'Rotate the credentials printed in this log: ⟦STRIPE_KEY_1⟧, ⟦AWS_KEY_1⟧/⟦AWS_SECRET_1⟧, ⟦GITHUB_TOKEN_1⟧ and the DB password ⟦PASSWORD_1⟧.',
    'Stop logging env vars at DEBUG on boot; ship a redaction filter.',
    'Notify ⟦PERSON_1⟧ (⟦EMAIL_1⟧) that charges for ⟦ORG_1⟧ need replay after recovery.',
  ],
  followUps: ['Add a connect_timeout and circuit breaker so the replica fallback does not hold the pool.', 'Alert on pool waiting > 50.'],
};
const TRIAGE = { headline: 'Primary Postgres ⟦HOSTNAME_1⟧ is unreachable (ETIMEDOUT), causing pool exhaustion and a crash-loop', severity: 'critical', nextStep: 'Check network path and failover status of ⟦HOSTNAME_1⟧:5432 from the pod.' };

const browser = await chromium.launch({ executablePath });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const cloudBodies = [];
const nanoPrompts = [];
await ctx.exposeBinding('__recordNano', (_s, text) => nanoPrompts.push(text));
await ctx.addInitScript(({ ents, triage }) => {
  const text = (msgs) => msgs.map((m) => (m.content || []).map((c) => (typeof c.value === 'string' ? c.value : '[image]')).join('')).join('\n');
  globalThis.LanguageModel = {
    availability: async () => 'available',
    create: async () => ({
      contextWindow: 9216,
      destroy() {},
      prompt: async (msgs) => {
        const t = text(msgs);
        globalThis.__recordNano?.(t);
        await new Promise((r) => setTimeout(r, 350));
        if (t.includes('privacy filter')) return JSON.stringify({ entities: ents });
        if (t.includes('Quick incident triage')) return JSON.stringify(triage);
        return 'Unhandled prompt';
      },
    }),
  };
}, {
  ents: [
    { value: 'Maya Okafor', kind: 'PERSON' },
    { value: 'Northwind Traders', kind: 'CUSTOMER' },
    { value: 'Bluefin', kind: 'PROJECT' },
    { value: 'Not In Text Corp', kind: 'ORG' },
  ],
  triage: TRIAGE,
});
await ctx.route(/content-firebaseappcheck\.googleapis\.com/, (r) => r.fulfill({ json: { token: 'mock-appcheck-token', ttl: '3600s' } }));
await ctx.route(/firebaseinstallations\.googleapis\.com|firebaseremoteconfig\.googleapis\.com|identitytoolkit|securetoken/, (r) => r.abort());
await ctx.route(/firebasevertexai\.googleapis\.com/, async (r) => {
  cloudBodies.push(r.request().postData() ?? '');
  await new Promise((res) => setTimeout(res, 900));
  r.fulfill({ json: { candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify(ANALYSIS) }] }, finishReason: 'STOP' }] } });
});

const errors = [];
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(String(e)));
await p.goto(url, { waitUntil: 'networkidle' });
await p.getByRole('button', { name: 'Messy log' }).click();
await p.getByRole('button', { name: /Scrub on this device/ }).click();
await p.waitForSelector('.nano-line.done', { timeout: 15000 });
await p.screenshot({ path: out + '11-review-nano-mocked.png' });

// Quick triage (PREFER_ON_DEVICE) -> on-device
await p.getByRole('button', { name: /Quick triage/ }).click();
await p.waitForSelector('.triage-card .source-badge');
const triageBadge = await p.locator('.triage-card .source-badge').innerText();

// Cloud analysis (PREFER_IN_CLOUD) -> cloud
await p.getByRole('button', { name: /Analyze scrubbed log in cloud/ }).click();
await p.waitForSelector('.analysis .source-badge');
const analysisBadge = await p.locator('.analysis .source-badge').innerText();
await p.screenshot({ path: out + '12-result-mocked.png' });
await p.screenshot({ path: out + '12b-result-mocked-full.png', fullPage: true });
const rehydratedText = await p.locator('.analysis').innerText();
await p.getByRole('switch', { name: 'Rehydrate locally' }).click();
await p.screenshot({ path: out + '13-result-as-model-saw-it.png' });
await p.getByRole('button', { name: 'Privacy ledger' }).click();
await p.waitForTimeout(300);
await p.screenshot({ path: out + '14-ledger-mocked.png' });
await p.getByRole('button', { name: 'Close' }).click();

// Offline: analyze is disabled, triage still runs on-device
await ctx.setOffline(true);
await p.getByRole('button', { name: 'Back to review' }).click();
const analyzeDisabled = await p.getByRole('button', { name: /Analyze in cloud/ }).isDisabled();
await p.getByRole('button', { name: /Quick triage/ }).click();
await p.waitForSelector('.triage-card .source-badge');
await p.screenshot({ path: out + '15-offline-triage-mocked.png' });
await ctx.setOffline(false);

// SDK probe: ONLY_ON_DEVICE when the browser has NO LanguageModel global.
const probe = await browser.newContext();
// Recent Chromium exposes LanguageModel even without the model; remove it to emulate
// browsers that do not ship the Prompt API at all (Firefox, Safari, older Chrome).
await probe.addInitScript(() => { delete globalThis.LanguageModel; });
const probeBodies = [];
await probe.route(/firebasevertexai\.googleapis\.com/, (r) => {
  probeBodies.push(r.request().postData() ?? '');
  r.fulfill({ json: { candidates: [{ content: { role: 'model', parts: [{ text: 'cloud answered' }] } }] } });
});
const pp = await probe.newPage();
await pp.goto(url, { waitUntil: 'networkidle' });
const probeResult = await pp.evaluate(async () => {
  const { initializeApp } = await import('/node_modules/.vite/deps/firebase_app.js');
  const { getAI, getGenerativeModel, InferenceMode } = await import('/node_modules/.vite/deps/firebase_ai.js');
  const app = initializeApp({ apiKey: 'k', projectId: 'p', appId: '1:1:web:1' }, 'probe');
  const m = getGenerativeModel(getAI(app), { mode: InferenceMode.ONLY_ON_DEVICE });
  try {
    const r = await m.generateContent('RAW SECRET AKIAIOSFODNN7EXAMPLE');
    return { ok: true, source: r.response.inferenceSource, text: r.response.text() };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});
await browser.close();

const leaks = RAW.filter((v) => cloudBodies.some((b) => b.includes(v)));
console.log(
  JSON.stringify(
    {
      errors,
      cloudRequests: cloudBodies.length,
      rawValuesInCloudRequests: leaks,
      nanoPromptCount: nanoPrompts.length,
      triageBadge,
      analysisBadge,
      rehydratedContainsRealValues: ['Maya Okafor', 'pg-primary.payments.internal'].every((v) => rehydratedText.includes(v)),
      analyzeDisabledOffline: analyzeDisabled,
      sdkProbe_ONLY_ON_DEVICE_without_LanguageModel: { ...probeResult, cloudRequestsMade: probeBodies.length },
    },
    null,
    2,
  ),
);
