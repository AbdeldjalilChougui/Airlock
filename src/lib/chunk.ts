/**
 * Gemini Nano has a small context window (Chrome reports it as `contextWindow`,
 * Firebase docs cite 9,216 tokens). Long logs are split on line boundaries into
 * chunks that each fit, leaving room for the instructions and the JSON answer.
 */
export const DEFAULT_CONTEXT_TOKENS = 9216;
/** Conservative: logs are token-dense (hex, punctuation), so assume ~3 chars per token. */
export const CHARS_PER_TOKEN = 3;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function chunkBudgetChars(contextTokens: number, reservedTokens = 2200): number {
  return Math.max(1000, (contextTokens - reservedTokens) * CHARS_PER_TOKEN);
}

export interface Chunk {
  index: number;
  start: number;
  text: string;
}

/** Split on newlines into chunks of at most `maxChars`; very long lines are hard-split. */
export function chunkText(text: string, maxChars: number): Chunk[] {
  const chunks: Chunk[] = [];
  let buf = '';
  let bufStart = 0;
  let pos = 0;
  const flush = () => {
    if (buf) chunks.push({ index: chunks.length, start: bufStart, text: buf });
    buf = '';
  };
  const lines = text.split(/(?<=\n)/);
  for (const line of lines) {
    if (line.length > maxChars) {
      flush();
      for (let i = 0; i < line.length; i += maxChars) {
        chunks.push({ index: chunks.length, start: pos + i, text: line.slice(i, i + maxChars) });
      }
      pos += line.length;
      bufStart = pos;
      continue;
    }
    if (buf.length + line.length > maxChars) {
      flush();
      bufStart = pos;
    }
    if (!buf) bufStart = pos;
    buf += line;
    pos += line.length;
  }
  flush();
  return chunks;
}

const SIGNAL = /\b(error|exception|fatal|panic|traceback|caused by|failed|failure|refused|denied|timeout|timed out|oom|killed|segfault|unhandled|critical|crash|errno|status[= ]5\d\d|5\d\d )/i;

/**
 * For the quick on-device triage we only need the interesting part of a long log:
 * the lines around errors, plus the tail. Keeps everything if it already fits.
 */
export function focusExcerpt(text: string, maxChars: number, contextLines = 3): string {
  if (text.length <= maxChars) return text;
  const lines = text.split('\n');
  const keep = new Set<number>();
  lines.forEach((l, i) => {
    if (SIGNAL.test(l)) for (let j = i - contextLines; j <= i + contextLines; j++) if (j >= 0 && j < lines.length) keep.add(j);
  });
  for (let j = Math.max(0, lines.length - 10); j < lines.length; j++) keep.add(j);
  const picked: string[] = [];
  let last = -2;
  for (const i of [...keep].sort((a, b) => a - b)) {
    if (i !== last + 1) picked.push('…');
    picked.push(lines[i]);
    last = i;
  }
  let out = picked.join('\n');
  if (out.length > maxChars) out = '…\n' + out.slice(out.length - maxChars + 2);
  return out;
}
