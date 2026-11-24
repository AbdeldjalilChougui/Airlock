import { looksLikeSecret } from './entropy';
import { DEFAULT_POLICY, GROUP_OF, type Policy } from './policy';
import type { Finding, Kind } from './types';

/**
 * Deterministic detectors. They run first, synchronously, with zero network —
 * on-device Gemini Nano only adds what regexes cannot know (people, customers, projects).
 */

interface Rule {
  kind: Kind;
  re: RegExp;
  reason: string;
  /** Capture group holding the sensitive part (default: whole match). */
  group?: number;
  /** Optional validator on the captured value. */
  check?: (v: string, full: string, text: string, start: number) => boolean;
  /** Higher wins when two findings overlap. */
  priority: number;
}

// Common file extensions that look like TLDs in stack traces ("app.js", "main.go").
const TLDS = new Set([
  'com', 'net', 'org', 'io', 'dev', 'app', 'cloud', 'co', 'ai', 'biz', 'info', 'me', 'tech', 'xyz',
  'us', 'uk', 'de', 'fr', 'es', 'it', 'nl', 'eu', 'ca', 'au', 'jp', 'in', 'br', 'dz', 'ch', 'se',
  'internal', 'local', 'corp', 'lan', 'intra', 'svc', 'private', 'site', 'online', 'store', 'cc',
]);

export function luhnValid(digits: string): boolean {
  const d = digits.replace(/\D/g, '');
  if (d.length < 13 || d.length > 19) return false;
  if (/^(\d)\1+$/.test(d)) return false;
  let sum = 0;
  let alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = d.charCodeAt(i) - 48;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function validIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  if (!parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255 && !(p.length > 1 && p.startsWith('0')))) return false;
  return !['0.0.0.0', '255.255.255.255'].includes(ip);
}

function hostnameCheck(policy: Policy) {
  return (host: string, _full: string, text: string, start: number): boolean => {
    const h = host.toLowerCase();
    if (text[start - 1] === '@') {
      // Email domain (not a user:pass@host URL) — that's the email detector's job.
      const lineStart = Math.max(text.lastIndexOf('\n', start), text.lastIndexOf(' ', start)) + 1;
      if (!text.slice(lineStart, start).includes('://')) return false;
    }
    if (policy.internalSuffixes.some((s) => h.endsWith(s))) return true;
    const labels = h.split('.');
    if (labels.length < 2) return false;
    const tld = labels[labels.length - 1];
    if (!TLDS.has(tld)) return false;
    // Reverse-domain Java/Kotlin packages: com.acme.billing
    if (['com', 'org', 'net', 'io'].includes(labels[0]) && labels.length >= 3) return false;
    if (policy.allowDomains.some((d) => h === d || h.endsWith('.' + d))) {
      // Keep public infra names, but an AWS hostname with an account/cluster id is still sensitive.
      return /\.(rds|elb|cache|es)\.amazonaws\.com$/.test(h) || /^[a-z0-9-]+\.execute-api\./.test(h);
    }
    return true;
  };
}

function rules(policy: Policy): Rule[] {
  return [
    {
      kind: 'PRIVATE_KEY',
      re: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z]+ )?PRIVATE KEY-----/g,
      reason: 'PEM private key block',
      priority: 100,
    },
    {
      kind: 'PRIVATE_KEY',
      re: /"private_key"\s*:\s*"(-----BEGIN[^"]+)"/g,
      group: 1,
      reason: 'Service-account private key (JSON)',
      priority: 100,
    },
    { kind: 'AWS_KEY', re: /\b((?:AKIA|ASIA|AGPA|AIDA|AROA)[0-9A-Z]{16})\b/g, group: 1, reason: 'AWS access key id', priority: 90 },
    {
      kind: 'AWS_SECRET',
      re: /aws_?secret_?(?:access_?)?key["']?\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})(?![A-Za-z0-9/+=])/gi,
      group: 1,
      reason: 'AWS secret access key',
      priority: 90,
    },
    { kind: 'GCP_KEY', re: /\b(AIza[0-9A-Za-z_-]{35})(?![0-9A-Za-z_-])/g, group: 1, reason: 'Google API key', priority: 90 },
    {
      kind: 'SECRET',
      re: /"private_key_id"\s*:\s*"([0-9a-f]{40})"/g,
      group: 1,
      reason: 'GCP service-account key id',
      priority: 85,
    },
    {
      kind: 'STRIPE_KEY',
      re: /\b((?:sk|rk|pk)_(?:live|test)_[0-9A-Za-z]{16,}|whsec_[0-9A-Za-z]{20,})\b/g,
      group: 1,
      reason: 'Stripe key',
      priority: 90,
    },
    {
      kind: 'GITHUB_TOKEN',
      re: /\b(gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{40,255})\b/g,
      group: 1,
      reason: 'GitHub token',
      priority: 90,
    },
    {
      kind: 'SECRET',
      re: /\bhttps?:\/\/([0-9a-f]{32})@[a-z0-9.-]+/g,
      group: 1,
      reason: 'Sentry DSN key',
      priority: 85,
    },
    { kind: 'SLACK_TOKEN', re: /\b(xox[abprs]-[A-Za-z0-9-]{10,})\b/g, group: 1, reason: 'Slack token', priority: 90 },
    {
      kind: 'JWT',
      re: /\b(eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})/g,
      group: 1,
      reason: 'JSON Web Token',
      priority: 88,
    },
    {
      kind: 'PASSWORD',
      re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:([^\s@/]{3,})@/gi,
      group: 1,
      reason: 'Password inside a connection string',
      priority: 85,
    },
    {
      kind: 'PASSWORD',
      re: /\b(?:password|passwd|pwd|pass)["']?\s*[:=]\s*["']?([^\s"',;&}]{4,})/gi,
      group: 1,
      reason: 'Password assignment',
      check: (v) => !/^(?:\*+|x+|null|none|undefined|true|false|<[^>]*>|\$\{?[A-Z_]+\}?)$/i.test(v),
      priority: 80,
    },
    {
      kind: 'SECRET',
      re: /\b(?:secret|token|api[_-]?key|apikey|access[_-]?token|auth[_-]?token|client[_-]?secret|bearer)["']?\s*[:=]?\s*["']?(?:Bearer\s+)?([A-Za-z0-9._~+/=-]{16,})/gi,
      group: 1,
      reason: 'Secret/token assignment',
      check: (v) => /[0-9]/.test(v) && /[A-Za-z]/.test(v),
      priority: 70,
    },
    {
      kind: 'EMAIL',
      re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}\b/g,
      reason: 'Email address',
      check: (v) => !/@(?:example\.(?:com|org)|users\.noreply\.github\.com)$/i.test(v),
      priority: 60,
    },
    {
      kind: 'CARD',
      re: /(?<![\d.-])((?:\d[ -]?){12,18}\d)(?![\d.-])/g,
      group: 1,
      reason: 'Payment card number (Luhn-valid)',
      check: (v) => luhnValid(v) && /^(?:4|5[1-5]|2[2-7]|3[47]|6(?:011|5))/.test(v.replace(/\D/g, '')),
      priority: 75,
    },
    {
      kind: 'PHONE',
      re: /(?<![\w+])(\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4})(?![\w])/g,
      group: 1,
      reason: 'Phone number (international format)',
      check: (v) => {
        const n = v.replace(/\D/g, '').length;
        return n >= 9 && n <= 15;
      },
      priority: 55,
    },
    {
      kind: 'PHONE',
      re: /\b(?:phone|tel|mobile|cell)["']?\s*[:=]\s*["']?(\(?\d[\d\s().-]{7,}\d)/gi,
      group: 1,
      reason: 'Phone number',
      priority: 55,
    },
    {
      kind: 'IP',
      re: /(?<![\w.])((?:\d{1,3}\.){3}\d{1,3})(?![\w.]*\d)/g,
      group: 1,
      reason: 'IPv4 address',
      check: (v, full) => validIPv4(v) && !/^v/i.test(full),
      priority: 50,
    },
    {
      kind: 'IP',
      re: /(?<![\w:])((?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|(?:[0-9a-f]{1,4}:){1,6}:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})(?![\w:])/gi,
      group: 1,
      reason: 'IPv6 address',
      check: (v) => v.replace(/[^:]/g, '').length >= 3 && /[0-9]/.test(v),
      priority: 50,
    },
    {
      kind: 'CUSTOMER_ID',
      re: /\b((?:cus|cust|acct|org|tenant)_[A-Za-z0-9]{6,})\b/g,
      group: 1,
      reason: 'Prefixed customer/account id',
      priority: 65,
    },
    {
      kind: 'USER_ID',
      re: /\b((?:usr|user|uid)_[A-Za-z0-9]{6,})\b/g,
      group: 1,
      reason: 'Prefixed user id',
      priority: 65,
    },
    {
      kind: 'CUSTOMER_ID',
      re: /\b(?:customer|cust|account|acct|tenant|org(?:anization)?|client|merchant)[_ -]?(?:id|number|no)\b["']?\s*[:=]\s*["']?([A-Za-z0-9_-]{3,64})/gi,
      group: 1,
      reason: 'Customer/account id field',
      priority: 64,
    },
    {
      kind: 'USER_ID',
      re: /\b(?:user|member|subscriber|patient|employee)[_ -]?(?:id|name)\b["']?\s*[:=]\s*["']?([A-Za-z0-9_.@-]{3,64})/gi,
      group: 1,
      reason: 'User id field',
      priority: 63,
    },
    {
      kind: 'HOSTNAME',
      re: /(?<![\w.-])((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24})(?!\.?[\w-])/g,
      group: 1,
      reason: 'Hostname',
      check: hostnameCheck(policy),
      priority: 40,
    },
  ];
}

const TOKEN_RE = /[A-Za-z0-9+/=_-]{20,}/g;

/** Resolve overlaps: keep the higher-priority, then longer, finding. */
export function resolveOverlaps(findings: (Finding & { priority?: number })[]): Finding[] {
  const sorted = [...findings].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0) || b.end - b.start - (a.end - a.start) || a.start - b.start,
  );
  const kept: (Finding & { priority?: number })[] = [];
  for (const f of sorted) {
    if (kept.some((k) => f.start < k.end && k.start < f.end)) continue;
    kept.push(f);
  }
  return kept
    .sort((a, b) => a.start - b.start)
    .map(({ priority: _p, ...f }) => f);
}

/** Run all deterministic detectors allowed by the policy. */
export function detect(text: string, policy: Policy = DEFAULT_POLICY): Finding[] {
  const out: (Finding & { priority: number })[] = [];
  for (const rule of rules(policy)) {
    const group = GROUP_OF[rule.kind];
    if (!policy[group as keyof Policy]) continue;
    rule.re.lastIndex = 0;
    for (const m of text.matchAll(rule.re)) {
      const g = rule.group ?? 0;
      const value = m[g];
      if (!value) continue;
      const offset = g === 0 ? 0 : m[0].indexOf(value);
      const start = (m.index ?? 0) + offset;
      if (rule.check && !rule.check(value, text.slice(Math.max(0, start - 1), start + value.length), text, start)) continue;
      out.push({ start, end: start + value.length, value, kind: rule.kind, origin: 'rule', reason: rule.reason, priority: rule.priority });
    }
  }
  if (policy.entropy) {
    for (const m of text.matchAll(TOKEN_RE)) {
      const value = m[0].replace(/^[-_=]+|[-_]+$/g, '');
      if (!looksLikeSecret(value, policy.entropyThreshold)) continue;
      const start = (m.index ?? 0) + m[0].indexOf(value);
      out.push({
        start,
        end: start + value.length,
        value,
        kind: 'SECRET',
        origin: 'entropy',
        reason: 'High-entropy string (likely a key or token)',
        priority: 30,
      });
    }
  }
  return resolveOverlaps(out);
}

/** Find every literal occurrence of `value` (used for Nano and user-added terms). */
export function findLiteral(text: string, value: string, ignoreCase = false): { start: number; end: number }[] {
  const hits: { start: number; end: number }[] = [];
  if (!value) return hits;
  const hay = ignoreCase ? text.toLowerCase() : text;
  const needle = ignoreCase ? value.toLowerCase() : value;
  let i = hay.indexOf(needle);
  while (i !== -1) {
    const before = text[i - 1];
    const after = text[i + value.length];
    const wordy = /\w/;
    // Only whole-word matches when the term itself starts/ends with a word char.
    const okBefore = !(before && wordy.test(before) && wordy.test(value[0]));
    const okAfter = !(after && wordy.test(after) && wordy.test(value[value.length - 1]));
    if (okBefore && okAfter) hits.push({ start: i, end: i + value.length });
    i = hay.indexOf(needle, i + value.length);
  }
  return hits;
}
