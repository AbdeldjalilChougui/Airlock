import type { Analysis, Kind, Triage } from './types';

/**
 * JSON Schemas shared by both inference paths:
 *  - on-device: OnDeviceParams.promptOptions.responseConstraint (Chrome Prompt API)
 *  - in-cloud:  generationConfig.responseJsonSchema
 * The on-device path does not receive systemInstruction, so every prompt is self-contained.
 */
export const ENTITY_SCHEMA = {
  type: 'object',
  properties: {
    entities: {
      type: 'array',
      maxItems: 40,
      items: {
        type: 'object',
        properties: {
          value: { type: 'string' },
          kind: { type: 'string', enum: ['PERSON', 'CUSTOMER', 'ORG', 'PROJECT', 'SECRET', 'OTHER'] },
        },
        required: ['value', 'kind'],
      },
    },
  },
  required: ['entities'],
} as const;

const SEVERITY = { type: 'string', enum: ['critical', 'high', 'medium', 'low'] } as const;

export const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    likelyCause: { type: 'string' },
    severity: SEVERITY,
    confidence: { type: 'number' },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        properties: { line: { type: 'string' }, why: { type: 'string' } },
        required: ['line', 'why'],
      },
    },
    fixSteps: { type: 'array', items: { type: 'string' } },
    followUps: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'likelyCause', 'severity', 'confidence', 'evidence', 'fixSteps', 'followUps'],
} as const;

export const TRIAGE_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    severity: SEVERITY,
    nextStep: { type: 'string' },
  },
  required: ['headline', 'severity', 'nextStep'],
} as const;

export function entityPrompt(chunk: string): string {
  return `You are a privacy filter running locally. Find sensitive values in the log below that pattern matching cannot catch:
- PERSON: names of real people (e.g. "Maya Okafor")
- CUSTOMER: names of customers or client companies
- ORG: other company or team names that are not public software projects
- PROJECT: internal project or codename (e.g. "Project Falcon", "bluefin")
- SECRET: passwords or keys not already replaced
Ignore anything inside ⟦…⟧ (already hidden). Ignore public software names (Node.js, Postgres, Stripe, AWS, Kubernetes, React), file paths, function names, error codes and log levels.
Copy each value exactly as it appears in the text. Return at most 40 entities. If none, return an empty list.

LOG:
"""
${chunk}
"""`;
}

export function analysisPrompt(scrubbed: string): string {
  return `You are a senior SRE doing incident triage. The log below was scrubbed on the user's device: sensitive values are replaced with placeholders like ⟦EMAIL_1⟧ or ⟦HOSTNAME_2⟧.
Rules:
- Keep placeholders exactly as written (including the ⟦ ⟧ brackets) whenever you refer to those values; never guess the real values.
- "evidence" lines must be copied verbatim from the log.
- "fixSteps" are concrete, ordered actions (commands or config changes where possible).
- "confidence" is between 0 and 1.
- If credentials appear in the log (even as placeholders), add a fix step to rotate them.

LOG:
"""
${scrubbed}
"""`;
}

export function triagePrompt(scrubbed: string): string {
  return `Quick incident triage. In one short sentence give the most likely problem (headline), a severity, and the single best next step. Keep placeholders like ⟦HOSTNAME_1⟧ exactly as written.

LOG:
"""
${scrubbed}
"""`;
}

export const OCR_PROMPT =
  'Transcribe ALL text visible in this screenshot of an error, exactly as written, preserving line breaks. Output only the transcribed text, no commentary.';

export const NANO_KIND: Record<string, Kind> = {
  PERSON: 'PERSON',
  CUSTOMER: 'ORG',
  ORG: 'ORG',
  PROJECT: 'PROJECT',
  SECRET: 'SECRET',
  OTHER: 'CUSTOM',
};

/** Models sometimes wrap JSON in fences or add prose; recover the object. */
export function parseJson<T>(text: string): T {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(t) as T;
  } catch {
    const a = t.indexOf('{');
    const b = t.lastIndexOf('}');
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1)) as T;
    throw new Error('Model did not return JSON');
  }
}

const LEVELS = ['critical', 'high', 'medium', 'low'] as const;

export function normalizeAnalysis(a: Partial<Analysis>): Analysis {
  return {
    summary: String(a.summary ?? ''),
    likelyCause: String(a.likelyCause ?? ''),
    severity: LEVELS.includes(a.severity as Analysis['severity']) ? (a.severity as Analysis['severity']) : 'medium',
    confidence: Math.max(0, Math.min(1, Number(a.confidence ?? 0.5) || 0.5)),
    evidence: Array.isArray(a.evidence) ? a.evidence.filter((e) => e && e.line).slice(0, 8) : [],
    fixSteps: Array.isArray(a.fixSteps) ? a.fixSteps.map(String).slice(0, 10) : [],
    followUps: Array.isArray(a.followUps) ? a.followUps.map(String).slice(0, 6) : [],
  };
}

export function normalizeTriage(t: Partial<Triage>): Triage {
  return {
    headline: String(t.headline ?? ''),
    severity: LEVELS.includes(t.severity as Triage['severity']) ? (t.severity as Triage['severity']) : 'medium',
    nextStep: String(t.nextStep ?? ''),
  };
}
