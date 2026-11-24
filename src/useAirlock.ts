import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cloudReady } from './firebase/app';
import { deviceAvailability, initializeDeviceModels, shortError, type DeviceAvailability } from './firebase/ai';
import { loadPolicy, saveIncident, type PolicyState } from './firebase/cloud';
import { analyzeInCloud, nanoEntities, quickTriage, transcribeScreenshot } from './firebase/pipeline';
import { detect } from './lib/detectors';
import { DEFAULT_POLICY, type Policy } from './lib/policy';
import type { Analysis, Finding, InferenceSourceLabel, Kind, RedactionItem, Triage } from './lib/types';
import { addLiteralFindings, buildItems, findLeaks, redact } from './lib/vault';

export type Stage = 'input' | 'review' | 'result';

export interface Attached {
  name: string;
  mime: string;
  dataUrl: string;
}

export interface NanoStatus {
  state: 'idle' | 'skipped' | 'running' | 'done' | 'unavailable' | 'error';
  done: number;
  total: number;
  found: number;
  note?: string;
}

export interface Timed<T> {
  data: T;
  source: InferenceSourceLabel;
  ms: number;
}

export function useAirlock() {
  const [stage, setStage] = useState<Stage>('input');
  const [input, setInput] = useState('');
  const [image, setImage] = useState<Attached | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [items, setItems] = useState<RedactionItem[]>([]);
  const [extras, setExtras] = useState<{ value: string; kind: Kind; origin: 'nano' | 'user'; reason: string }[]>([]);
  const [nano, setNano] = useState<NanoStatus>({ state: 'idle', done: 0, total: 0, found: 0 });
  const [useNano, setUseNano] = useState(true);
  const [busy, setBusy] = useState<null | 'scrub' | 'ocr' | 'analyze' | 'triage' | 'save' | 'download'>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Timed<Analysis> | null>(null);
  const [triage, setTriage] = useState<Timed<Triage> | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [device, setDevice] = useState<DeviceAvailability>('unsupported');
  const [downloadPct, setDownloadPct] = useState<number | null>(null);
  const [policyState, setPolicyState] = useState<PolicyState>({ policy: DEFAULT_POLICY, source: 'defaults' });
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  /** Vaults of incidents saved this session, so they can be rehydrated until the tab closes. */
  const sessionVaults = useRef(new Map<string, Map<string, string>>());

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    addEventListener('online', on);
    addEventListener('offline', off);
    deviceAvailability().then(setDevice);
    loadPolicy().then((p) => {
      setPolicyState(p);
      setPolicy(p.policy);
      setUseNano(p.policy.nanoEntities);
    });
    return () => {
      removeEventListener('online', on);
      removeEventListener('offline', off);
    };
  }, []);

  const redaction = useMemo(() => redact(input, findings, items), [input, findings, items]);
  const leaks = useMemo(() => findLeaks(redaction.text, redaction.vault), [redaction]);

  const resetResults = () => {
    setAnalysis(null);
    setTriage(null);
    setSavedId(null);
    setError(null);
  };

  /** Recompute findings from rules + accepted extras, keeping user toggles. */
  const recompute = useCallback(
    (text: string, p: Policy, ex: typeof extras, prevItems: RedactionItem[]) => {
      const base = detect(text, p);
      const all = addLiteralFindings(text, base, ex);
      setFindings(all);
      const next = buildItems(all, prevItems);
      setItems(next);
      return { all, next };
    },
    [],
  );

  const scrub = useCallback(async () => {
    if (!input.trim()) return;
    resetResults();
    setBusy('scrub');
    setExtras([]);
    const { all, next } = recompute(input, policy, [], []);
    setStage('review');
    const canNano = useNano && policy.nanoEntities && device !== 'unsupported' && device !== 'unavailable';
    if (!canNano) {
      setNano({
        state: useNano && policy.nanoEntities ? 'unavailable' : 'skipped',
        done: 0,
        total: 0,
        found: 0,
        note: device === 'unsupported' ? 'Prompt API not exposed by this browser' : undefined,
      });
      setBusy(null);
      return;
    }
    try {
      setNano({ state: 'running', done: 0, total: 0, found: 0 });
      const ruleRedacted = redact(input, all, next).text;
      const ents = await nanoEntities(ruleRedacted, (done, total) => setNano((n) => ({ ...n, done, total })));
      setExtras(ents);
      const r = recompute(input, policy, ents, next);
      const found = r.all.filter((f) => f.origin === 'nano').length;
      setNano((n) => ({ ...n, state: 'done', found }));
    } catch (e) {
      setNano((n) => ({ ...n, state: 'error', note: shortError(e) }));
    } finally {
      setBusy(null);
    }
  }, [input, policy, useNano, device, recompute]);

  const toggle = (id: string, enabled?: boolean) =>
    setItems((xs) => xs.map((i) => (i.id === id ? { ...i, enabled: enabled ?? !i.enabled } : i)));

  const toggleKind = (kind: Kind, enabled: boolean) => setItems((xs) => xs.map((i) => (i.kind === kind ? { ...i, enabled } : i)));

  const addTerm = (value: string) => {
    const v = value.trim();
    if (v.length < 2) return;
    const ex = [...extras, { value: v, kind: 'CUSTOM' as Kind, origin: 'user' as const, reason: 'Added by you' }];
    setExtras(ex);
    recompute(input, policy, ex, items);
  };

  const applyPolicy = (p: Policy) => {
    setPolicy(p);
    if (stage !== 'input') recompute(input, p, extras, items);
  };

  const ocr = useCallback(async (file: File) => {
    setError(null);
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      setError('Only PNG or JPEG screenshots are supported on-device.');
      return;
    }
    const dataUrl = await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.readAsDataURL(file);
    });
    setImage({ name: file.name, mime: file.type, dataUrl });
    setBusy('ocr');
    try {
      const r = await transcribeScreenshot(dataUrl, file.type);
      setInput((prev) => (prev ? prev + '\n' : '') + r.data.trim());
    } catch (e) {
      setError(
        `Screenshot text extraction runs only on-device (Gemini Nano), and it is not available here: ${shortError(e)}. ` +
          'Airlock never uploads screenshots — paste the text instead.',
      );
    } finally {
      setBusy(null);
    }
  }, []);

  const analyze = useCallback(async () => {
    setError(null);
    setBusy('analyze');
    try {
      const r = await analyzeInCloud(redaction.text, redaction.vault);
      setAnalysis({ data: r.data, source: r.source, ms: r.ms });
      setStage('result');
    } catch (e) {
      setError(shortError(e));
    } finally {
      setBusy(null);
    }
  }, [redaction]);

  const runTriage = useCallback(async () => {
    setError(null);
    setBusy('triage');
    try {
      const r = await quickTriage(redaction.text, redaction.vault);
      setTriage({ data: r.data, source: r.source, ms: r.ms });
      setStage('result');
    } catch (e) {
      setError(shortError(e));
    } finally {
      setBusy(null);
    }
  }, [redaction]);

  const save = useCallback(async () => {
    if (!analysis) return;
    setBusy('save');
    setError(null);
    try {
      const firstLine = analysis.data.summary.split(/[.\n]/)[0].slice(0, 90);
      const id = await saveIncident(
        {
          title: firstLine || 'Untitled incident',
          redactedText: redaction.text,
          analysis: analysis.data,
          source: analysis.source,
          severity: analysis.data.severity,
          hiddenCount: items.filter((i) => i.enabled).length,
          kinds: [...new Set(items.filter((i) => i.enabled).map((i) => i.kind))],
        },
        redaction.vault,
      );
      sessionVaults.current.set(id, new Map(redaction.vault));
      setSavedId(id);
    } catch (e) {
      setError(shortError(e));
    } finally {
      setBusy(null);
    }
  }, [analysis, redaction, items]);

  const downloadModel = useCallback(async () => {
    setBusy('download');
    setError(null);
    setDownloadPct(0);
    try {
      await initializeDeviceModels((p) => setDownloadPct(p));
      setDevice(await deviceAvailability());
    } catch (e) {
      setError(shortError(e));
    } finally {
      setBusy(null);
      setDownloadPct(null);
    }
  }, []);

  const newIncident = () => {
    resetResults();
    setInput('');
    setImage(null);
    setFindings([]);
    setItems([]);
    setExtras([]);
    setNano({ state: 'idle', done: 0, total: 0, found: 0 });
    setStage('input');
  };

  return {
    stage, setStage, input, setInput, image, setImage, findings, items, nano, useNano, setUseNano, busy, error, setError,
    analysis, triage, savedId, online, device, downloadPct, policy, policyState, applyPolicy, redaction, leaks,
    scrub, toggle, toggleKind, addTerm, ocr, analyze, runTriage, save, downloadModel, newIncident, sessionVaults,
    cloudReady,
  };
}

export type AirlockState = ReturnType<typeof useAirlock>;
