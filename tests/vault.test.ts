import { describe, expect, it } from 'vitest';
import { detect } from '../src/lib/detectors';
import { MESSY_LOG } from '../src/lib/samples';
import {
  addLiteralFindings, buildItems, findLeaks, makePlaceholder, maskPreview, redact, rehydrate, rehydrateDeep, rehydrateSegments,
} from '../src/lib/vault';

const text = 'user ops@acme.io hit 10.0.0.5, then ops@acme.io retried from 10.0.0.6';

describe('placeholders', () => {
  it('formats placeholders', () => {
    expect(makePlaceholder('EMAIL', 1)).toBe('⟦EMAIL_1⟧');
  });

  it('dedupes values and numbers per kind', () => {
    const items = buildItems(detect(text));
    expect(items.map((i) => [i.placeholder, i.value, i.count])).toEqual([
      ['⟦EMAIL_1⟧', 'ops@acme.io', 2],
      ['⟦IP_1⟧', '10.0.0.5', 1],
      ['⟦IP_2⟧', '10.0.0.6', 1],
    ]);
  });

  it('redacts enabled items and builds the vault', () => {
    const f = detect(text);
    const r = redact(text, f, buildItems(f));
    expect(r.text).toBe('user ⟦EMAIL_1⟧ hit ⟦IP_1⟧, then ⟦EMAIL_1⟧ retried from ⟦IP_2⟧');
    expect(r.vault.get('⟦IP_2⟧')).toBe('10.0.0.6');
  });

  it('leaves disabled items in place and out of the vault', () => {
    const f = detect(text);
    const items = buildItems(f).map((i) => (i.kind === 'IP' ? { ...i, enabled: false } : i));
    const r = redact(text, f, items);
    expect(r.text).toContain('10.0.0.5');
    expect(r.vault.has('⟦IP_1⟧')).toBe(false);
  });

  it('keeps previous toggles when re-scanning', () => {
    const f = detect(text);
    const first = buildItems(f).map((i) => ({ ...i, enabled: i.kind !== 'EMAIL' }));
    const again = buildItems(f, first);
    expect(again.find((i) => i.kind === 'EMAIL')?.enabled).toBe(false);
  });
});

describe('rehydration', () => {
  const vault = new Map([
    ['⟦EMAIL_1⟧', 'ops@acme.io'],
    ['⟦IP_1⟧', '10.0.0.5'],
  ]);

  it('round-trips', () => {
    const f = detect(text);
    const r = redact(text, f, buildItems(f));
    expect(rehydrate(r.text, r.vault)).toBe(text);
  });

  it('round-trips the full messy log', () => {
    const f = detect(MESSY_LOG);
    const r = redact(MESSY_LOG, f, buildItems(f));
    expect(findLeaks(r.text, r.vault)).toEqual([]);
    expect(rehydrate(r.text, r.vault)).toBe(MESSY_LOG);
  });

  it('tolerates [[X_1]] spelling from models and ignores unknown placeholders', () => {
    expect(rehydrate('mail [[EMAIL_1]] about ⟦CARD_9⟧', vault)).toBe('mail ops@acme.io about ⟦CARD_9⟧');
  });

  it('marks restored segments', () => {
    expect(rehydrateSegments('at ⟦IP_1⟧!', vault)).toEqual([
      { text: 'at ' },
      { text: '10.0.0.5', placeholder: '⟦IP_1⟧' },
      { text: '!' },
    ]);
  });

  it('rehydrates nested JSON', () => {
    const out = rehydrateDeep({ a: ['⟦IP_1⟧'], b: { c: 'x ⟦EMAIL_1⟧' }, n: 3 }, vault);
    expect(out).toEqual({ a: ['10.0.0.5'], b: { c: 'x ops@acme.io' }, n: 3 });
  });
});

describe('egress guard', () => {
  it('reports originals that would leak', () => {
    const vault = new Map([['⟦EMAIL_1⟧', 'ops@acme.io']]);
    expect(findLeaks('contact ops@acme.io', vault)).toEqual(['ops@acme.io']);
    expect(findLeaks('contact ⟦EMAIL_1⟧', vault)).toEqual([]);
  });
});

describe('literal findings (Nano / user terms)', () => {
  it('adds every occurrence without overlapping rule findings', () => {
    const t = 'Maya Okafor paged; maya.okafor@acme.io; Maya Okafor ack';
    const base = detect(t);
    const all = addLiteralFindings(t, base, [{ value: 'Maya Okafor', kind: 'PERSON', origin: 'nano', reason: 'name' }]);
    expect(all.filter((f) => f.kind === 'PERSON')).toHaveLength(2);
    const r = redact(t, all, buildItems(all));
    expect(r.text).toBe('⟦PERSON_1⟧ paged; ⟦EMAIL_1⟧; ⟦PERSON_1⟧ ack');
  });
  it('ignores values that are not in the text (hallucinations)', () => {
    const all = addLiteralFindings('hello world', [], [{ value: 'Bob Smith', kind: 'PERSON', origin: 'nano', reason: '' }]);
    expect(all).toEqual([]);
  });
});

describe('maskPreview', () => {
  it('never shows the full value', () => {
    expect(maskPreview('supersecretvalue123')).not.toContain('secretvalue');
  });
});

describe('user terms', () => {
  it('match case-insensitively and share one placeholder', () => {
    const t = 'Project Bluefin: /srv/bluefin/.env and BLUEFIN api';
    const all = addLiteralFindings(t, [], [{ value: 'Bluefin', kind: 'CUSTOM', origin: 'user', reason: '' }]);
    const r = redact(t, all, buildItems(all));
    expect(r.text).toBe('Project ⟦CUSTOM_1⟧: /srv/⟦CUSTOM_1⟧/.env and ⟦CUSTOM_1⟧ api');
    expect(r.vault.get('⟦CUSTOM_1⟧')).toBe('Bluefin');
  });
});
