import { getAuth, GoogleAuthProvider, linkWithPopup, onAuthStateChanged, signInAnonymously, signInWithPopup, type User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { fetchAndActivate, getAll, getRemoteConfig } from 'firebase/remote-config';
import { DEFAULT_POLICY, policyFromRemote, type Policy } from '../lib/policy';
import type { Analysis, InferenceSourceLabel, Kind } from '../lib/types';
import { findLeaks } from '../lib/vault';
import { app, cloudReady } from './app';

/* ---------------- Remote Config: redaction policy ---------------- */

export interface PolicyState {
  policy: Policy;
  source: 'defaults' | 'remote-config';
  fetchedAt?: number;
}

export async function loadPolicy(): Promise<PolicyState> {
  if (!cloudReady) return { policy: DEFAULT_POLICY, source: 'defaults' };
  try {
    const rc = getRemoteConfig(app);
    rc.settings.minimumFetchIntervalMillis = import.meta.env.DEV ? 60_000 : 3_600_000;
    rc.defaultConfig = {
      policy_secrets: true,
      policy_contact: true,
      policy_network: true,
      policy_identifiers: true,
      policy_financial: true,
      policy_entropy: true,
      policy_nano_entities: true,
      entropy_threshold: DEFAULT_POLICY.entropyThreshold,
      allow_domains: '',
    };
    await fetchAndActivate(rc);
    const values = Object.fromEntries(Object.entries(getAll(rc)).map(([k, v]) => [k, v.asString()]));
    return { policy: policyFromRemote(values), source: 'remote-config', fetchedAt: Date.now() };
  } catch {
    return { policy: DEFAULT_POLICY, source: 'defaults' };
  }
}

/* ---------------- Auth ---------------- */

const auth = cloudReady ? getAuth(app) : null;

export function watchUser(cb: (u: User | null) => void): () => void {
  if (!auth) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, cb);
}

export async function ensureUser(): Promise<User> {
  if (!auth) throw new Error('Firebase is not configured');
  if (auth.currentUser) return auth.currentUser;
  return (await signInAnonymously(auth)).user;
}

export async function signInGoogle(): Promise<User> {
  if (!auth) throw new Error('Firebase is not configured');
  const provider = new GoogleAuthProvider();
  if (auth.currentUser?.isAnonymous) {
    try {
      return (await linkWithPopup(auth.currentUser, provider)).user;
    } catch {
      /* account exists already: fall through to a normal sign-in */
    }
  }
  return (await signInWithPopup(auth, provider)).user;
}

export async function signOutUser() {
  await auth?.signOut();
}

/* ---------------- Firestore: saved incidents (redacted only) ---------------- */

export interface Incident {
  id: string;
  title: string;
  redactedText: string;
  analysis: Analysis;
  source: InferenceSourceLabel;
  severity: Analysis['severity'];
  hiddenCount: number;
  kinds: Kind[];
  createdAt?: Timestamp;
}

const db = cloudReady ? getFirestore(app) : null;

/**
 * Saves ONLY placeholder text. The vault is passed in solely to verify — right
 * before the write — that no original value is present anywhere in the document.
 */
export async function saveIncident(
  data: Omit<Incident, 'id' | 'createdAt'>,
  vault: Map<string, string>,
): Promise<string> {
  if (!db) throw new Error('Firebase is not configured');
  const leaks = findLeaks(JSON.stringify(data), vault);
  if (leaks.length) throw new Error(`Refusing to save: ${leaks.length} original value(s) found in the document.`);
  const user = await ensureUser();
  const ref = await addDoc(collection(db, 'users', user.uid, 'incidents'), {
    ...data,
    redactedText: data.redactedText.slice(0, 200_000),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listIncidents(): Promise<Incident[]> {
  if (!db) return [];
  const user = await ensureUser();
  const snap = await getDocs(query(collection(db, 'users', user.uid, 'incidents'), orderBy('createdAt', 'desc'), limit(30)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Incident, 'id'>) }));
}

export async function deleteIncident(id: string) {
  if (!db) return;
  const user = await ensureUser();
  await deleteDoc(doc(db, 'users', user.uid, 'incidents', id));
}
