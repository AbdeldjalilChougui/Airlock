/** Every category of sensitive value Airlock knows how to hide. */
export type Kind =
  | 'PRIVATE_KEY'
  | 'AWS_KEY'
  | 'AWS_SECRET'
  | 'GCP_KEY'
  | 'STRIPE_KEY'
  | 'GITHUB_TOKEN'
  | 'SLACK_TOKEN'
  | 'JWT'
  | 'PASSWORD'
  | 'SECRET'
  | 'EMAIL'
  | 'PHONE'
  | 'IP'
  | 'HOSTNAME'
  | 'CARD'
  | 'CUSTOMER_ID'
  | 'USER_ID'
  | 'PERSON'
  | 'ORG'
  | 'PROJECT'
  | 'CUSTOM';

/** Groups map onto Remote Config policy toggles. */
export type Group = 'secrets' | 'contact' | 'network' | 'identifiers' | 'financial' | 'entropy' | 'context';

/** Where a finding came from: a deterministic rule, on-device Gemini Nano, or the user. */
export type Origin = 'rule' | 'entropy' | 'nano' | 'user';

export interface Finding {
  start: number;
  end: number;
  value: string;
  kind: Kind;
  origin: Origin;
  /** Short human explanation, e.g. "AWS access key id (AKIA…)". */
  reason: string;
  /** Spelling variants share one placeholder: case-insensitive user terms map to this canonical value. */
  canonical?: string;
}

export interface RedactionItem {
  id: string;
  placeholder: string;
  value: string;
  kind: Kind;
  origin: Origin;
  reason: string;
  count: number;
  enabled: boolean;
}

export interface Severity {
  level: 'critical' | 'high' | 'medium' | 'low';
}

export interface Analysis {
  summary: string;
  likelyCause: string;
  severity: Severity['level'];
  confidence: number;
  evidence: { line: string; why: string }[];
  fixSteps: string[];
  followUps: string[];
}

export interface Triage {
  headline: string;
  severity: Severity['level'];
  nextStep: string;
}

export type InferenceSourceLabel = 'on_device' | 'in_cloud' | 'rules';
