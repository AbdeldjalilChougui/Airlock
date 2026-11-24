import { findLiteral } from './detectors';
import type { Finding, Kind, Origin, RedactionItem } from './types';

/**
 * The vault maps reversible placeholders (⟦EMAIL_1⟧) to the real values.
 * It lives only in this tab's memory. It is never written to Firestore,
 * localStorage, or any network request — that is the whole point of Airlock.
 */
export const OPEN = '⟦';
export const CLOSE = '⟧';
const PLACEHOLDER_RE = /(?:⟦|\[\[)([A-Z][A-Z_]*_\d+)(?:⟧|\]\])/g;

export function makePlaceholder(kind: Kind, n: number): string {
  return `${OPEN}${kind}_${n}${CLOSE}`;
}

/**
 * Turn findings into de-duplicated redaction items: the same value always gets
 * the same placeholder, so the model can still reason about "the same customer".
 */
export function buildItems(findings: Finding[], previous: RedactionItem[] = []): RedactionItem[] {
  const byValue = new Map<string, RedactionItem>();
  const counters = new Map<Kind, number>();
  // Keep toggles the user already chose for values that are still present.
  const prevEnabled = new Map(previous.map((p) => [p.value, p.enabled]));
  for (const f of findings) {
    const existing = byValue.get(f.value);
    if (existing) {
      existing.count += 1;
      continue;
    }
    const n = (counters.get(f.kind) ?? 0) + 1;
    counters.set(f.kind, n);
    const placeholder = makePlaceholder(f.kind, n);
    byValue.set(f.value, {
      id: placeholder,
      placeholder,
      value: f.value,
      kind: f.kind,
      origin: f.origin,
      reason: f.reason,
      count: 1,
      enabled: prevEnabled.get(f.value) ?? true,
    });
  }
  return [...byValue.values()];
}

/** Add literal occurrences of extra values (from Nano or the user) to findings. */
export function addLiteralFindings(
  text: string,
  findings: Finding[],
  extras: { value: string; kind: Kind; origin: Origin; reason: string }[],
): Finding[] {
  const out = [...findings];
  for (const e of extras) {
    const v = e.value.trim();
    if (v.length < 3 || v.includes(OPEN)) continue;
    for (const hit of findLiteral(text, v)) {
      if (out.some((f) => hit.start < f.end && f.start < hit.end)) continue;
      out.push({ ...hit, value: v, kind: e.kind, origin: e.origin, reason: e.reason });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

export interface Redaction {
  text: string;
  /** placeholder -> original, only for enabled items. */
  vault: Map<string, string>;
}

/** Replace every enabled finding with its placeholder. */
export function redact(text: string, findings: Finding[], items: RedactionItem[]): Redaction {
  const itemByValue = new Map(items.map((i) => [i.value, i]));
  const vault = new Map<string, string>();
  let out = '';
  let cursor = 0;
  for (const f of [...findings].sort((a, b) => a.start - b.start)) {
    if (f.start < cursor) continue;
    const item = itemByValue.get(f.value);
    if (!item || !item.enabled) continue;
    out += text.slice(cursor, f.start) + item.placeholder;
    vault.set(item.placeholder, item.value);
    cursor = f.end;
  }
  out += text.slice(cursor);
  return { text: out, vault };
}

export interface Segment {
  text: string;
  /** Set when this segment is a restored real value. */
  placeholder?: string;
}

/** Restore placeholders in model output to real values, keeping track of what was restored. */
export function rehydrateSegments(text: string, vault: Map<string, string>): Segment[] {
  const segs: Segment[] = [];
  let cursor = 0;
  for (const m of text.matchAll(PLACEHOLDER_RE)) {
    const ph = `${OPEN}${m[1]}${CLOSE}`;
    const real = vault.get(ph);
    if (real === undefined) continue;
    const idx = m.index ?? 0;
    if (idx > cursor) segs.push({ text: text.slice(cursor, idx) });
    segs.push({ text: real, placeholder: ph });
    cursor = idx + m[0].length;
  }
  if (cursor < text.length) segs.push({ text: text.slice(cursor) });
  return segs;
}

export function rehydrate(text: string, vault: Map<string, string>): string {
  return rehydrateSegments(text, vault)
    .map((s) => s.text)
    .join('');
}

/** Deep-rehydrate every string inside a JSON value. */
export function rehydrateDeep<T>(value: T, vault: Map<string, string>): T {
  if (typeof value === 'string') return rehydrate(value, vault) as T;
  if (Array.isArray(value)) return value.map((v) => rehydrateDeep(v, vault)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rehydrateDeep(v, vault)])) as T;
  }
  return value;
}

/**
 * Egress guard: returns the originals that would leak if `payload` left the device.
 * Called right before every cloud request and every Firestore write.
 */
export function findLeaks(payload: string, vault: Map<string, string>): string[] {
  const leaks: string[] = [];
  for (const real of vault.values()) {
    if (real.length >= 4 && payload.includes(real)) leaks.push(real);
  }
  return leaks;
}

export function maskPreview(value: string): string {
  const v = value.replace(/\s+/g, ' ');
  if (v.length <= 8) return v[0] + '•'.repeat(Math.max(1, v.length - 1));
  return v.slice(0, 4) + '•'.repeat(Math.min(12, v.length - 6)) + v.slice(-2);
}
