/** Shannon entropy in bits per character. */
export function shannonEntropy(s: string): number {
  if (!s) return 0;
  const counts = new Map<string, number>();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let h = 0;
  const n = s.length;
  for (const c of counts.values()) {
    const p = c / n;
    h -= p * Math.log2(p);
  }
  return h;
}

const HEX = /^[0-9a-f]+$/i;

/**
 * Heuristic: does this token look like a machine-generated secret?
 * Hex strings top out at 4 bits/char, so they need a lower bar but a longer length
 * (and are skipped at 40 chars, the length of a git SHA-1).
 */
export function looksLikeSecret(token: string, threshold = 4.0): boolean {
  if (token.length < 20) return false;
  if (!/[0-9]/.test(token) || !/[A-Za-z]/.test(token)) return false;
  if (/^[A-Za-z]+[_-]?[0-9]+$/.test(token)) return false; // e.g. "request12345678901234"
  if (/^(.)\1+$/.test(token)) return false;
  if (HEX.test(token)) {
    if (token.length === 40 || token.length < 32) return false; // git SHAs, short hashes
    return shannonEntropy(token) >= Math.min(threshold, 3.5);
  }
  // Mixed-case or symbols with high entropy.
  const mixed = /[a-z]/.test(token) && /[A-Z]/.test(token);
  if (!mixed && !/[+/=]/.test(token)) return false;
  return shannonEntropy(token) >= threshold;
}
