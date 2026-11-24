import { describe, expect, it } from 'vitest';
import { detect, findLiteral, luhnValid } from '../src/lib/detectors';
import { looksLikeSecret, shannonEntropy } from '../src/lib/entropy';
import { DEFAULT_POLICY } from '../src/lib/policy';
import { MESSY_LOG, SAMPLE_CONFIG } from '../src/lib/samples';

const j = (...p: string[]) => p.join('');
const kinds = (t: string) => detect(t).map((f) => `${f.kind}:${f.value}`);

describe('secret detectors', () => {
  it('finds cloud keys and tokens', () => {
    const aws = j('AKIA', 'IOSFODNN7EXAMPLE');
    const stripe = j('sk_', 'live_', 'abcdefghijKLMNOP1234');
    const gh = j('ghp_', 'a'.repeat(10), 'B'.repeat(10), '1234567890abcdef');
    const gcp = j('AIza', 'SyD3mo-Fak3K3y_9xQwErTyUiOpAsDfGh12');
    const out = kinds(`id=${aws} stripe ${stripe} gh ${gh} maps ${gcp}`);
    expect(out).toContain(`AWS_KEY:${aws}`);
    expect(out).toContain(`STRIPE_KEY:${stripe}`);
    expect(out).toContain(`GITHUB_TOKEN:${gh}`);
    expect(out).toContain(`GCP_KEY:${gcp}`);
  });

  it('finds an AWS secret by context', () => {
    const s = j('wJalrXUtnFEMI/K7MDENG/', 'bPxRfiCYEXAMPLEKEY');
    expect(kinds(`aws_secret_access_key = ${s}`)).toContain(`AWS_SECRET:${s}`);
  });

  it('finds PEM private keys as one block', () => {
    const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA7\nabc\n-----END RSA PRIVATE KEY-----';
    const f = detect(`key:\n${pem}\ndone`);
    expect(f).toHaveLength(1);
    expect(f[0].kind).toBe('PRIVATE_KEY');
    expect(f[0].value).toBe(pem);
  });

  it('finds JWTs', () => {
    const jwt = j('eyJhbGciOiJIUzI1NiJ9', '.eyJzdWIiOiIxMjM0NTY3ODkwIn0', '.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U');
    expect(detect(`Authorization: Bearer ${jwt}`).map((f) => f.kind)).toContain('JWT');
  });

  it('extracts the password from connection strings, not the whole URL', () => {
    const f = detect('postgres://svc:S3cret-pw@db.payments.internal:5432/x');
    expect(f.find((x) => x.kind === 'PASSWORD')?.value).toBe('S3cret-pw');
    expect(f.find((x) => x.kind === 'HOSTNAME')?.value).toBe('db.payments.internal');
  });

  it('ignores placeholder passwords', () => {
    expect(detect('password=******** pwd=${DB_PASSWORD}').filter((f) => f.kind === 'PASSWORD')).toHaveLength(0);
  });
});

describe('PII detectors', () => {
  it('finds emails but not example.com', () => {
    expect(kinds('a jane.doe@acme.io b test@example.com')).toEqual(['EMAIL:jane.doe@acme.io']);
  });

  it('validates IPv4 and skips versions and timestamps', () => {
    const out = kinds('from 10.0.4.17 and 999.1.1.1 ver v1.2.3.4 at 2026-11-24T09:41:07.212Z');
    expect(out).toEqual(['IP:10.0.4.17']);
  });

  it('finds IPv6', () => {
    expect(kinds('peer 2001:db8:85a3::8a2e:370:7334 up')).toContain('IP:2001:db8:85a3::8a2e:370:7334');
  });

  it('Luhn-checks card numbers', () => {
    expect(luhnValid('4242 4242 4242 4242')).toBe(true);
    expect(luhnValid('4242 4242 4242 4241')).toBe(false);
    expect(kinds('card 4242-4242-4242-4242 order 1234567890123456')).toEqual(['CARD:4242-4242-4242-4242']);
  });

  it('finds international phone numbers', () => {
    expect(kinds('call +44 20 7946 0958 now')).toContain('PHONE:+44 20 7946 0958');
    expect(kinds('call +1 415 555 0132.')).toContain('PHONE:+1 415 555 0132');
  });

  it('finds customer and user ids', () => {
    const out = kinds('customer_id=cus_Q8fT2kLm9ZpX user=usr_8hK2pQ7wRt tenant_id: acme-eu-0042');
    expect(out).toContain('CUSTOMER_ID:cus_Q8fT2kLm9ZpX');
    expect(out).toContain('USER_ID:usr_8hK2pQ7wRt');
    expect(out).toContain('CUSTOMER_ID:acme-eu-0042');
  });
});

describe('hostname detector avoids stack-trace noise', () => {
  it('keeps file names, java packages and public domains', () => {
    const t = [
      'at Object.run (/srv/app/src/index.ts:12:3)',
      'at com.acme.billing.InvoiceService.charge(InvoiceService.java:42)',
      'see https://github.com/org/repo and registry.npmjs.org',
      'node_modules/pg/lib/client.js:132',
    ].join('\n');
    expect(detect(t).filter((f) => f.kind === 'HOSTNAME')).toEqual([]);
  });

  it('flags internal and private hostnames', () => {
    const out = kinds('to pg-replica-2.payments.internal and api.northwind-traders.com and mydb.c9x.eu-west-1.rds.amazonaws.com');
    expect(out).toContain('HOSTNAME:pg-replica-2.payments.internal');
    expect(out).toContain('HOSTNAME:api.northwind-traders.com');
    expect(out).toContain('HOSTNAME:mydb.c9x.eu-west-1.rds.amazonaws.com');
  });
});

describe('entropy', () => {
  it('computes Shannon entropy', () => {
    expect(shannonEntropy('aaaa')).toBe(0);
    expect(shannonEntropy('abcd')).toBe(2);
  });
  it('separates secrets from ordinary identifiers', () => {
    expect(looksLikeSecret(j('x9Fq7Lr2', 'Vb8Kp3Zt6Wm1Nc4Hs5Jd0Ye'))).toBe(true);
    expect(looksLikeSecret('4f2a9c1e8b7d6a5f4e3d2c1b0a9f8e7d6c5b4a3f')).toBe(false); // git SHA
    expect(looksLikeSecret('ConnectionTimeoutException')).toBe(false);
    expect(looksLikeSecret('request12345678901234')).toBe(false);
  });
  it('can be disabled by policy', () => {
    const t = `token ${j('x9Fq7Lr2', 'Vb8Kp3Zt6Wm1Nc4Hs5Jd0Ye')}`;
    const off = { ...DEFAULT_POLICY, entropy: false, secrets: false };
    expect(detect(t, off)).toEqual([]);
  });
});

describe('policy toggles', () => {
  it('turning off a group removes its findings', () => {
    const t = 'mail ops@acme.io from 10.1.2.3';
    expect(detect(t, { ...DEFAULT_POLICY, network: false }).map((f) => f.kind)).toEqual(['EMAIL']);
    expect(detect(t, { ...DEFAULT_POLICY, contact: false }).map((f) => f.kind)).toEqual(['IP']);
  });
});

describe('findLiteral', () => {
  it('matches whole words only', () => {
    expect(findLiteral('Bluefin bluefin Bluefinance Bluefin.', 'Bluefin')).toEqual([
      { start: 0, end: 7 },
      { start: 28, end: 35 },
    ]);
  });
});

describe('sample logs', () => {
  it('catches every planted secret in the messy log', () => {
    const f = detect(MESSY_LOG);
    const k = new Set(f.map((x) => x.kind));
    for (const want of ['STRIPE_KEY', 'AWS_KEY', 'AWS_SECRET', 'GCP_KEY', 'GITHUB_TOKEN', 'JWT', 'PASSWORD', 'EMAIL', 'PHONE', 'IP', 'HOSTNAME', 'CARD', 'CUSTOMER_ID', 'USER_ID', 'SECRET']) {
      expect(k, want).toContain(want);
    }
    // Stack frames and timestamps are untouched.
    expect(f.some((x) => x.value.includes('client.js'))).toBe(false);
    expect(f.some((x) => x.value.startsWith('2026-'))).toBe(false);
  });
  it('catches the config sample', () => {
    const k = new Set(detect(SAMPLE_CONFIG).map((x) => x.kind));
    for (const want of ['PASSWORD', 'HOSTNAME', 'EMAIL', 'CUSTOMER_ID', 'IP']) expect(k, want).toContain(want);
  });
});

describe('sentry dsn', () => {
  it('treats the DSN key as a secret, not an email', () => {
    const k = j('3f9c2a', '7be4d1', '48a0b5c6d7e8f9a0b1c2');
    expect(kinds(`SENTRY_DSN: https://${k}@o4504.ingest.sentry.io/77`)).toContain(`SECRET:${k}`);
  });
});
