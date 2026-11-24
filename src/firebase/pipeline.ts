import type { Part } from 'firebase/ai';
import { chunkBudgetChars, chunkText, focusExcerpt } from '../lib/chunk';
import {
  analysisPrompt,
  entityPrompt,
  NANO_KIND,
  normalizeAnalysis,
  normalizeTriage,
  OCR_PROMPT,
  triagePrompt,
} from '../lib/prompts';
import type { Analysis, Kind, Triage } from '../lib/types';
import { deviceContextWindow, infer, type ModelResult } from './ai';

export interface NanoEntity {
  value: string;
  kind: Kind;
  origin: 'nano';
  reason: string;
}

/**
 * Context-aware pass with Gemini Nano (ONLY_ON_DEVICE). The rule-redacted text is
 * chunked to Nano's context window; each chunk returns schema-constrained JSON.
 */
export async function nanoEntities(
  ruleRedacted: string,
  onChunk: (done: number, total: number) => void,
): Promise<NanoEntity[]> {
  const window = await deviceContextWindow();
  const chunks = chunkText(ruleRedacted, chunkBudgetChars(window));
  const seen = new Map<string, NanoEntity>();
  onChunk(0, chunks.length);
  for (const c of chunks) {
    const r = await infer<{ entities?: { value?: string; kind?: string }[] }>('scrub', entityPrompt(c.text));
    for (const e of r.data.entities ?? []) {
      const value = (e.value ?? '').trim();
      if (value.length < 3 || value.length > 80 || value.includes('⟦')) continue;
      if (/^(error|warn|info|debug|fatal|null|true|false|production|staging)$/i.test(value)) continue;
      const kind = NANO_KIND[e.kind ?? 'OTHER'] ?? 'CUSTOM';
      if (!seen.has(value)) {
        seen.set(value, { value, kind, origin: 'nano', reason: `Gemini Nano: ${(e.kind ?? 'other').toLowerCase()} name` });
      }
    }
    onChunk(c.index + 1, chunks.length);
  }
  return [...seen.values()];
}

/** Screenshot -> text, on the device. The image itself is never uploaded. */
export async function transcribeScreenshot(dataUrl: string, mimeType: string): Promise<ModelResult<string>> {
  const data = dataUrl.split(',')[1];
  const image: Part = { type: 'inlineData', inlineData: { data, mimeType } };
  return infer<string>('ocr', [OCR_PROMPT, image], { json: false });
}

const CLOUD_MAX_CHARS = 400_000;

export async function analyzeInCloud(scrubbed: string, vault: Map<string, string>): Promise<ModelResult<Analysis>> {
  const body = scrubbed.length > CLOUD_MAX_CHARS ? focusExcerpt(scrubbed, CLOUD_MAX_CHARS) : scrubbed;
  const r = await infer<Partial<Analysis>>('analyze', analysisPrompt(body), { vault });
  return { ...r, data: normalizeAnalysis(r.data) };
}

export async function quickTriage(scrubbed: string, vault: Map<string, string>): Promise<ModelResult<Triage>> {
  // Sized for Nano: the interesting lines + the tail.
  const window = await deviceContextWindow();
  const excerpt = focusExcerpt(scrubbed, chunkBudgetChars(window, 1200));
  const r = await infer<Partial<Triage>>('triage', triagePrompt(excerpt), { vault });
  return { ...r, data: normalizeTriage(r.data) };
}
