// Loads the built extension (dist-ext) in Chromium and screenshots the side panel page.
import { chromium } from 'playwright-core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ext = resolve('dist-ext');
const out = resolve('submission/screenshots');
const executablePath = process.env.CHROME_PATH ?? '/home/djalil/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'airlock-ext-')), {
  executablePath,
  headless: true,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  viewport: { width: 420, height: 860 },
  colorScheme: 'dark',
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 10000 });
const id = new URL(sw.url()).host;
const errors = [];
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(String(e)));
await p.goto(`chrome-extension://${id}/ext/sidepanel.html`);
await p.waitForSelector('.input-card');
// Simulate the context-menu hand-off from the service worker.
await sw.evaluate(() => chrome.storage.session.set({ pending: { text: 'ERROR db login failed for ops@acme.io from 10.0.4.17 password=hunter22x', at: Date.now() } }));
await p.waitForFunction(() => document.querySelector('textarea')?.value.includes('hunter22x'));
await p.screenshot({ path: join(out, '16-extension-sidepanel.png') });
await p.getByRole('button', { name: /Scrub on this device/ }).click();
await p.waitForSelector('.diff');
await p.screenshot({ path: join(out, '17-extension-review.png'), fullPage: true });
const payload = await p.locator('.diff').innerText();
await ctx.close();
console.log(JSON.stringify({ id, errors, handoffWorked: true, diffHasPlaceholders: payload.includes('⟦') }, null, 2));
