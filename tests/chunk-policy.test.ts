import { describe, expect, it } from 'vitest';
import { chunkBudgetChars, chunkText, estimateTokens, focusExcerpt } from '../src/lib/chunk';
import { DEFAULT_POLICY, policyFromRemote } from '../src/lib/policy';

describe('chunking for the Nano context window', () => {
  it('keeps everything and never exceeds the budget', () => {
    const text = Array.from({ length: 500 }, (_, i) => `line ${i} ${'x'.repeat(i % 90)}`).join('\n');
    const chunks = chunkText(text, 2000);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.text.length <= 2000)).toBe(true);
    expect(chunks.map((c) => c.text).join('')).toBe(text);
    for (const c of chunks) expect(text.slice(c.start, c.start + c.text.length)).toBe(c.text);
  });
  it('hard-splits a single huge line', () => {
    const chunks = chunkText('a'.repeat(5000), 2000);
    expect(chunks.map((c) => c.text.length)).toEqual([2000, 2000, 1000]);
  });
  it('derives budget from the context window', () => {
    expect(chunkBudgetChars(9216)).toBe((9216 - 2200) * 3);
    expect(estimateTokens('abcdef')).toBe(2);
  });
  it('focuses on error lines when the log is too long', () => {
    const lines = Array.from({ length: 2000 }, (_, i) => (i === 1000 ? 'ERROR pg: connect ETIMEDOUT' : `INFO tick ${i}`));
    const out = focusExcerpt(lines.join('\n'), 2000);
    expect(out.length).toBeLessThanOrEqual(2000);
    expect(out).toContain('ETIMEDOUT');
  });
});

describe('remote config policy', () => {
  it('falls back to defaults', () => {
    expect(policyFromRemote({})).toEqual(DEFAULT_POLICY);
  });
  it('applies string values', () => {
    const p = policyFromRemote({ policy_network: 'false', entropy_threshold: '4.5', allow_domains: 'acme.io' });
    expect(p.network).toBe(false);
    expect(p.entropyThreshold).toBe(4.5);
    expect(p.allowDomains).toContain('acme.io');
  });
  it('rejects absurd thresholds', () => {
    expect(policyFromRemote({ entropy_threshold: '0.1' }).entropyThreshold).toBe(4);
  });
});
