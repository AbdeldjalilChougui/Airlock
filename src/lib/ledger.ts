import type { InferenceSourceLabel } from './types';

/**
 * Privacy ledger: one row per inference call, showing what was asked for
 * (InferenceMode) versus where it actually ran (response.inferenceSource),
 * and how many characters could have left the device.
 */
export interface LedgerEntry {
  id: number;
  at: number;
  feature: string;
  mode: string;
  source: InferenceSourceLabel | 'failed';
  ms: number;
  charsOut: number;
  note?: string;
}

type Listener = (rows: LedgerEntry[]) => void;
let rows: LedgerEntry[] = [];
let seq = 0;
const listeners = new Set<Listener>();

export const ledger = {
  add(e: Omit<LedgerEntry, 'id' | 'at'>) {
    rows = [{ ...e, id: ++seq, at: Date.now() }, ...rows].slice(0, 100);
    listeners.forEach((l) => l(rows));
  },
  all: () => rows,
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  clear() {
    rows = [];
    listeners.forEach((l) => l(rows));
  },
};
