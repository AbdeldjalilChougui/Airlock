// Drives the running app in Chromium and saves screenshots to submission/screenshots/.
// Usage: node scripts/shots.mjs [url]   (default http://localhost:5317)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5317';
const out = new URL('../submission/screenshots/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const executablePath =
  process.env.CHROME_PATH ?? '/home/djalil/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';

const browser = await chromium.launch({ executablePath });
const errors = [];
async function page(opts) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, ...opts });
  const p = await ctx.newPage();
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(url, { waitUntil: 'networkidle' });
  return p;
}
const shot = (p, name, full = false) => p.screenshot({ path: out + name, fullPage: full });

// Desktop dark flow
let p = await page({ colorScheme: 'dark' });
await shot(p, '01-empty-dark.png');
await p.getByRole('button', { name: 'Messy log' }).click();
await shot(p, '02-messy-log.png');
await p.getByRole('button', { name: /Scrub on this device/ }).click();
await p.waitForSelector('.diff');
await p.waitForTimeout(400);
await shot(p, '03-review-diff.png');
await p.getByRole('textbox', { name: 'Add a term to hide' }).fill('Maya Okafor');
await p.getByRole('button', { name: 'Hide', exact: true }).click();
await p.getByRole('textbox', { name: 'Add a term to hide' }).fill('Northwind Traders');
await p.getByRole('button', { name: 'Hide', exact: true }).click();
await p.getByRole('textbox', { name: 'Add a term to hide' }).fill('Bluefin');
await p.getByRole('button', { name: 'Hide', exact: true }).click();
await p.getByRole('tab', { name: 'Exact payload' }).click();
await shot(p, '04-exact-payload.png');
const payload = await p.locator('.diff').innerText();
await p.getByRole('button', { name: 'Privacy ledger' }).click();
await shot(p, '05-ledger.png');
await p.getByRole('button', { name: 'Close' }).click();
await p.getByRole('button', { name: 'Redaction policy' }).click();
await shot(p, '06-policy.png');
await p.getByRole('button', { name: 'Close' }).click();
await p.locator('.pill', { hasText: 'Nano' }).click();
await shot(p, '07-device-setup.png');
await p.context().close();

// Light theme review
p = await page({ colorScheme: 'light' });
await p.getByRole('button', { name: 'Leaky config' }).click();
await p.getByRole('button', { name: /Scrub on this device/ }).click();
await p.waitForSelector('.diff');
await shot(p, '08-review-light.png');
await p.context().close();

// Offline state
p = await page({ colorScheme: 'dark' });
await p.context().setOffline(true);
await p.getByRole('button', { name: 'Messy log' }).click();
await p.getByRole('button', { name: /Scrub on this device/ }).click();
await p.waitForSelector('.diff');
await shot(p, '09-offline-review.png');
await p.context().close();

// Phone width
p = await page({ colorScheme: 'dark', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.getByRole('button', { name: 'Messy log' }).click();
await shot(p, '10-mobile-input.png', true);
const hScroll = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
await p.context().close();

await browser.close();
const leaked = ['Maya Okafor', 'Northwind Traders', 'maya.okafor@', '10.42.7.19', '4242 4242'].filter((v) => payload.includes(v));
console.log(JSON.stringify({ errors, leakedInPayload: leaked, mobileHorizontalScroll: hScroll, payloadHead: payload.slice(0, 600) }, null, 2));
