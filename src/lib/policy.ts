import type { Group, Kind } from './types';

/**
 * Redaction policy. Defaults live here; the deployed values come from Firebase
 * Remote Config (see remoteconfig.template.json), so a security team can tighten
 * policy for every user without shipping a new build.
 */
export interface Policy {
  secrets: boolean;
  contact: boolean;
  network: boolean;
  identifiers: boolean;
  financial: boolean;
  entropy: boolean;
  /** Ask on-device Gemini Nano for context-dependent values (names, projects, customers). */
  nanoEntities: boolean;
  entropyThreshold: number;
  /** Public hostnames that are never worth hiding. */
  allowDomains: string[];
  /** Hostname suffixes that are always internal. */
  internalSuffixes: string[];
}

export const DEFAULT_POLICY: Policy = {
  secrets: true,
  contact: true,
  network: true,
  identifiers: true,
  financial: true,
  entropy: true,
  nanoEntities: true,
  entropyThreshold: 4.0,
  allowDomains: [
    'github.com', 'gitlab.com', 'npmjs.com', 'npmjs.org', 'registry.npmjs.org', 'pypi.org',
    'google.com', 'googleapis.com', 'gstatic.com', 'firebase.google.com', 'stackoverflow.com',
    'mozilla.org', 'developer.mozilla.org', 'nodejs.org', 'python.org', 'docker.io', 'docker.com',
    'example.com', 'example.org', 'localhost', 'w3.org', 'schema.org', 'apache.org', 'java.com',
    'stripe.com', 'api.stripe.com', 'amazonaws.com', 'kubernetes.io', 'k8s.io',
  ],
  internalSuffixes: ['.internal', '.local', '.corp', '.lan', '.intra', '.svc', '.cluster.local', '.private'],
};

export const GROUP_OF: Record<Kind, Group> = {
  PRIVATE_KEY: 'secrets',
  AWS_KEY: 'secrets',
  AWS_SECRET: 'secrets',
  GCP_KEY: 'secrets',
  STRIPE_KEY: 'secrets',
  GITHUB_TOKEN: 'secrets',
  SLACK_TOKEN: 'secrets',
  JWT: 'secrets',
  PASSWORD: 'secrets',
  SECRET: 'secrets',
  EMAIL: 'contact',
  PHONE: 'contact',
  IP: 'network',
  HOSTNAME: 'network',
  CARD: 'financial',
  CUSTOMER_ID: 'identifiers',
  USER_ID: 'identifiers',
  PERSON: 'context',
  ORG: 'context',
  PROJECT: 'context',
  CUSTOM: 'context',
};

export const GROUP_LABEL: Record<Group, string> = {
  secrets: 'Keys & secrets',
  contact: 'Emails & phones',
  network: 'IPs & hostnames',
  identifiers: 'Customer & user IDs',
  financial: 'Card numbers',
  entropy: 'High-entropy strings',
  context: 'Names & projects (Nano)',
};

/** Parse a Remote Config snapshot (all values arrive as strings) over the defaults. */
export function policyFromRemote(values: Record<string, string | undefined>): Policy {
  const p: Policy = { ...DEFAULT_POLICY };
  const bool = (k: string, d: boolean) => {
    const v = values[k];
    return v === undefined || v === '' ? d : v === 'true';
  };
  p.secrets = bool('policy_secrets', p.secrets);
  p.contact = bool('policy_contact', p.contact);
  p.network = bool('policy_network', p.network);
  p.identifiers = bool('policy_identifiers', p.identifiers);
  p.financial = bool('policy_financial', p.financial);
  p.entropy = bool('policy_entropy', p.entropy);
  p.nanoEntities = bool('policy_nano_entities', p.nanoEntities);
  const t = Number(values['entropy_threshold']);
  if (Number.isFinite(t) && t >= 3 && t <= 6) p.entropyThreshold = t;
  const extra = (values['allow_domains'] ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (extra.length) p.allowDomains = [...new Set([...p.allowDomains, ...extra])];
  return p;
}
