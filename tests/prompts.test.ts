import { describe, expect, it } from 'vitest';
import { normalizeAnalysis, normalizeTriage, parseJson } from '../src/lib/prompts';

describe('model output parsing', () => {
  it('recovers JSON from fences and prose, and normalizes bad fields', () => {
    expect(parseJson<{ a: number }>('```json\n{"a":1}\n```').a).toBe(1);
    expect(parseJson<{ a: number }>('Sure! {"a":2} hope it helps').a).toBe(2);
    const a = normalizeAnalysis({ severity: 'apocalyptic' as never, confidence: 7, fixSteps: ['x'] });
    expect(a.severity).toBe('medium');
    expect(a.confidence).toBe(1);
    expect(a.evidence).toEqual([]);
    expect(normalizeTriage({ headline: 'h', severity: 'low' })).toEqual({ headline: 'h', severity: 'low', nextStep: '' });
    expect(() => parseJson('no json here')).toThrow();
  });
});
