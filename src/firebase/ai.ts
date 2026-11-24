import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  type GenerativeModel,
  type Part,
} from 'firebase/ai';
import { DEFAULT_CONTEXT_TOKENS } from '../lib/chunk';
import { ledger } from '../lib/ledger';
import { ANALYSIS_SCHEMA, ENTITY_SCHEMA, parseJson, TRIAGE_SCHEMA } from '../lib/prompts';
import type { InferenceSourceLabel } from '../lib/types';
import { findLeaks } from '../lib/vault';
import { app } from './app';

/**
 * All model inference in Airlock goes through Firebase AI Logic.
 * One GenerativeModel per InferenceMode, each chosen for a privacy reason:
 *
 *  scrub    ONLY_ON_DEVICE    raw logs may contain secrets -> must never leave the machine
 *  ocr      ONLY_ON_DEVICE    screenshots are transcribed locally, never uploaded
 *  analyze  PREFER_IN_CLOUD   deep root-cause needs the big model; input is already scrubbed
 *  triage   PREFER_ON_DEVICE  fast/offline answer; scrubbed input so a cloud fallback is safe
 */
const ai = getAI(app, { backend: new GoogleAIBackend() });

const TEXT_EN = { type: 'text' as const, languages: ['en'] };
const cloudModel = (import.meta.env.VITE_CLOUD_MODEL as string | undefined) || 'gemini-3.5-flash-lite';

const scrubModel = getGenerativeModel(ai, {
  mode: InferenceMode.ONLY_ON_DEVICE,
  onDeviceParams: {
    createOptions: { expectedInputs: [TEXT_EN], expectedOutputs: [TEXT_EN] },
    promptOptions: { responseConstraint: ENTITY_SCHEMA },
  },
});

const ocrModel = getGenerativeModel(ai, {
  mode: InferenceMode.ONLY_ON_DEVICE,
  onDeviceParams: {
    createOptions: { expectedInputs: [TEXT_EN, { type: 'image' }], expectedOutputs: [TEXT_EN] },
  },
});

const analyzeModel = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_IN_CLOUD,
  inCloudParams: {
    model: cloudModel,
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: ANALYSIS_SCHEMA, temperature: 0.2 },
  },
  onDeviceParams: {
    createOptions: { expectedInputs: [TEXT_EN], expectedOutputs: [TEXT_EN] },
    promptOptions: { responseConstraint: ANALYSIS_SCHEMA },
  },
});

const triageModel = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_ON_DEVICE,
  inCloudParams: {
    model: cloudModel,
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: TRIAGE_SCHEMA, temperature: 0.2 },
  },
  onDeviceParams: {
    createOptions: { expectedInputs: [TEXT_EN], expectedOutputs: [TEXT_EN] },
    promptOptions: { responseConstraint: TRIAGE_SCHEMA },
  },
});

const MODELS = {
  scrub: { model: scrubModel, mode: InferenceMode.ONLY_ON_DEVICE },
  ocr: { model: ocrModel, mode: InferenceMode.ONLY_ON_DEVICE },
  analyze: { model: analyzeModel, mode: InferenceMode.PREFER_IN_CLOUD },
  triage: { model: triageModel, mode: InferenceMode.PREFER_ON_DEVICE },
} satisfies Record<string, { model: GenerativeModel; mode: string }>;

export type Feature = keyof typeof MODELS;
export const MODE_OF: Record<Feature, string> = Object.fromEntries(
  Object.entries(MODELS).map(([k, v]) => [k, v.mode]),
) as Record<Feature, string>;

/* ------------------------------------------------------------------ */
/* On-device model status (Chrome Prompt API metadata — no inference)  */
/* ------------------------------------------------------------------ */

export type DeviceAvailability = 'unsupported' | 'unavailable' | 'downloadable' | 'downloading' | 'available';

interface LanguageModelStatic {
  availability(opts?: object): Promise<Exclude<DeviceAvailability, 'unsupported'>>;
  create(opts?: object): Promise<{ contextWindow?: number; inputQuota?: number; destroy(): void }>;
}

function lm(): LanguageModelStatic | undefined {
  return (globalThis as { LanguageModel?: LanguageModelStatic }).LanguageModel;
}

export async function deviceAvailability(): Promise<DeviceAvailability> {
  const LM = lm();
  if (!LM) return 'unsupported';
  try {
    return await LM.availability({ expectedInputs: [TEXT_EN], expectedOutputs: [TEXT_EN] });
  } catch {
    return 'unavailable';
  }
}

let cachedWindow: number | null = null;
/** Read Nano's context window (tokens) so long logs can be chunked to fit. */
export async function deviceContextWindow(): Promise<number> {
  if (cachedWindow) return cachedWindow;
  const LM = lm();
  if (!LM) return DEFAULT_CONTEXT_TOKENS;
  try {
    const s = await LM.create({ expectedInputs: [TEXT_EN], expectedOutputs: [TEXT_EN] });
    cachedWindow = s.contextWindow ?? s.inputQuota ?? DEFAULT_CONTEXT_TOKENS;
    s.destroy();
  } catch {
    cachedWindow = DEFAULT_CONTEXT_TOKENS;
  }
  return cachedWindow;
}

/** Must be called from a user gesture. Downloads Gemini Nano if needed, via Firebase AI Logic. */
export async function initializeDeviceModels(onProgress?: (p: number) => void): Promise<void> {
  await scrubModel.initializeDeviceModel(onProgress);
  // Warm the other on-device sessions; they share the same downloaded model.
  void triageModel.initializeDeviceModel();
  void ocrModel.initializeDeviceModel();
}

/* ------------------------------------------------------------------ */
/* Inference                                                           */
/* ------------------------------------------------------------------ */

export interface ModelResult<T> {
  data: T;
  text: string;
  source: InferenceSourceLabel;
  ms: number;
}

export class EgressBlockedError extends Error {
  constructor(public leaks: string[]) {
    super(`Blocked: ${leaks.length} original value(s) would have left the device.`);
  }
}

/**
 * Run one generateContent call and record the real inference source.
 * `vault` enables the egress guard for any mode that might reach the cloud.
 */
export async function infer<T>(
  feature: Feature,
  input: string | (string | Part)[],
  opts: { json?: boolean; vault?: Map<string, string> } = {},
): Promise<ModelResult<T>> {
  const { model, mode } = MODELS[feature];
  const textOut = typeof input === 'string' ? input : input.filter((p): p is string => typeof p === 'string').join('\n');
  const mayLeaveDevice = mode !== InferenceMode.ONLY_ON_DEVICE;
  if (!mayLeaveDevice && !lm()) {
    // SDK quirk (firebase 13.4.0): when the browser has no `LanguageModel` global, the
    // model is built without a Chrome adapter and ONLY_ON_DEVICE requests are sent to
    // the CLOUD instead of throwing. Raw text must never take that path, so refuse here.
    ledger.add({ feature, mode, source: 'failed', ms: 0, charsOut: 0, note: 'No on-device model — request kept local' });
    throw new Error('On-device model not available in this browser');
  }
  if (mayLeaveDevice && opts.vault) {
    const leaks = findLeaks(textOut, opts.vault);
    if (leaks.length) {
      ledger.add({ feature, mode, source: 'failed', ms: 0, charsOut: 0, note: 'Egress guard blocked request' });
      throw new EgressBlockedError(leaks);
    }
  }
  const t0 = performance.now();
  try {
    const result = await model.generateContent(input);
    const text = result.response.text();
    const source: InferenceSourceLabel = result.response.inferenceSource === 'on_device' ? 'on_device' : 'in_cloud';
    const ms = Math.round(performance.now() - t0);
    if (mode === InferenceMode.ONLY_ON_DEVICE && source !== 'on_device') {
      throw new Error('ONLY_ON_DEVICE request reported a non-device source; refusing result.');
    }
    ledger.add({ feature, mode, source, ms, charsOut: source === 'in_cloud' ? textOut.length : 0 });
    const data = (opts.json === false ? text : parseJson<T>(text)) as T;
    return { data, text, source, ms };
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    ledger.add({ feature, mode, source: 'failed', ms, charsOut: 0, note: shortError(e) });
    throw e;
  }
}

export function shortError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/app.?check/i.test(msg)) return 'App Check token rejected — see OWNER_STEPS.md';
  if (/API_NOT_ENABLED|not available in this environment|LanguageModel/i.test(msg)) return 'On-device model not available in this browser';
  if (/api key|apikey|API key not valid|permission|403/i.test(msg)) return 'Cloud request rejected — check Firebase AI Logic setup';
  if (/fetch|network|Failed to fetch|offline/i.test(msg)) return 'Network unavailable';
  return msg.length > 140 ? msg.slice(0, 140) + '…' : msg;
}
