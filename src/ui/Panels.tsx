import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { appCheckState, cloudReady, firebaseConfigured } from '../firebase/app';
import { MODE_OF } from '../firebase/ai';
import { deleteIncident, listIncidents, signInGoogle, signOutUser, watchUser, type Incident } from '../firebase/cloud';
import { ledger, type LedgerEntry } from '../lib/ledger';
import { DEFAULT_POLICY, GROUP_LABEL, type Policy } from '../lib/policy';
import { rehydrate } from '../lib/vault';
import type { AirlockState } from '../useAirlock';
import { Drawer, SeverityPill, SourceBadge, Spinner, Switch } from './bits';
import { Chip, Download, Folder, List, Sliders, X } from './icons';
import { toMarkdown } from './ResultStage';

export function useLedger(): LedgerEntry[] {
  const [rows, setRows] = useState(ledger.all());
  useEffect(() => {
    const off = ledger.subscribe(setRows);
    return () => {
      off();
    };
  }, []);
  return rows;
}

const FEATURE_LABEL: Record<string, string> = {
  scrub: 'Context scrub',
  ocr: 'Screenshot OCR',
  analyze: 'Root-cause analysis',
  triage: 'Quick triage',
};

export function LedgerPanel({ onClose }: { onClose: () => void }) {
  const rows = useLedger();
  const cloudChars = rows.filter((r) => r.source === 'in_cloud').reduce((a, r) => a + r.charsOut, 0);
  return (
    <Drawer title="Privacy ledger" icon={<List />} onClose={onClose}>
      <p className="muted">
        Every model call this session: the <code>InferenceMode</code> Airlock asked for, and where Firebase AI Logic says it actually ran
        (<code>response.inferenceSource</code>).
      </p>
      <div className="ledger-stats">
        <div>
          <strong>{rows.filter((r) => r.source === 'on_device').length}</strong>
          <span>on-device calls</span>
        </div>
        <div>
          <strong>{rows.filter((r) => r.source === 'in_cloud').length}</strong>
          <span>cloud calls</span>
        </div>
        <div>
          <strong>{cloudChars.toLocaleString()}</strong>
          <span>scrubbed chars sent</span>
        </div>
        <div>
          <strong>0</strong>
          <span>raw values sent</span>
        </div>
      </div>
      <table className="ledger">
        <thead>
          <tr>
            <th>Time</th>
            <th>Feature</th>
            <th>Requested</th>
            <th>Ran</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="empty">
                No model calls yet. Deterministic rules run locally and don&apos;t appear here.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{new Date(r.at).toLocaleTimeString()}</td>
              <td>
                {FEATURE_LABEL[r.feature] ?? r.feature}
                {r.note && <small className="note">{r.note}</small>}
              </td>
              <td>
                <code>{r.mode.toUpperCase()}</code>
              </td>
              <td>{r.source === 'failed' ? <span className="sev sev-high">failed</span> : <SourceBadge source={r.source} ms={r.ms} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Mode map</h3>
      <ul className="mode-map">
        {Object.entries(MODE_OF).map(([f, m]) => (
          <li key={f}>
            <span>{FEATURE_LABEL[f]}</span>
            <code>{m.toUpperCase()}</code>
          </li>
        ))}
      </ul>
    </Drawer>
  );
}

export function PolicyPanel({ s, onClose }: { s: AirlockState; onClose: () => void }) {
  const p = s.policy;
  const set = (patch: Partial<Policy>) => s.applyPolicy({ ...p, ...patch });
  const keys = ['secrets', 'entropy', 'contact', 'network', 'identifiers', 'financial'] as const;
  return (
    <Drawer title="Redaction policy" icon={<Sliders />} onClose={onClose}>
      <p className="muted">
        Source:{' '}
        <strong>{s.policyState.source === 'remote-config' ? 'Firebase Remote Config' : 'built-in defaults'}</strong>
        {s.policyState.fetchedAt && ` · fetched ${new Date(s.policyState.fetchedAt).toLocaleTimeString()}`}. Changes here apply to this session only.
      </p>
      <ul className="policy">
        {keys.map((k) => (
          <li key={k}>
            <span>
              {GROUP_LABEL[k]}
              <small>
                <code>policy_{k}</code>
              </small>
            </span>
            <Switch checked={p[k]} onChange={(v) => set({ [k]: v })} label={GROUP_LABEL[k]} />
          </li>
        ))}
        <li>
          <span>
            Context scan with Gemini Nano
            <small>
              <code>policy_nano_entities</code>
            </small>
          </span>
          <Switch
            checked={p.nanoEntities}
            onChange={(v) => {
              set({ nanoEntities: v });
              s.setUseNano(v);
            }}
            label="Nano context scan"
          />
        </li>
        <li>
          <span>
            Entropy threshold · {p.entropyThreshold.toFixed(1)} bits/char
            <small>
              <code>entropy_threshold</code>
            </small>
          </span>
          <input
            type="range"
            min={3.2}
            max={5}
            step={0.1}
            value={p.entropyThreshold}
            onChange={(e) => set({ entropyThreshold: Number(e.target.value) })}
            aria-label="Entropy threshold"
          />
        </li>
      </ul>
      <button className="btn ghost small" onClick={() => s.applyPolicy(s.policyState.policy ?? DEFAULT_POLICY)}>
        Reset to {s.policyState.source === 'remote-config' ? 'Remote Config' : 'defaults'}
      </button>
    </Drawer>
  );
}

export function DevicePanel({ s, onClose }: { s: AirlockState; onClose: () => void }) {
  const steps: [string, string][] = [
    ['Chrome desktop 139 or newer', 'Windows 10/11, macOS 13+, Linux or ChromeOS (Chromebook Plus)'],
    ['Enable the Prompt API flag', 'chrome://flags/#prompt-api-for-gemini-nano-multimodal-input → Enabled'],
    ['Enable the on-device model flag', 'chrome://flags/#optimization-guide-on-device-model → Enabled BypassPerfRequirement'],
    ['Free disk space', 'At least 22 GB free on the volume holding your Chrome profile'],
    ['Relaunch Chrome and download', 'Press the button below (a user gesture is required)'],
  ];
  return (
    <Drawer title="On-device model" icon={<Chip />} onClose={onClose}>
      <div className={`device-state st-${s.device}`}>
        <span className="big">{s.device}</span>
        <span className="muted">
          Chrome <code>LanguageModel.availability()</code> for English text in / text out
        </span>
      </div>
      <ol className="setup">
        {steps.map(([t, d]) => (
          <li key={t}>
            <strong>{t}</strong>
            <span>{d}</span>
          </li>
        ))}
      </ol>
      <button
        className="btn primary"
        disabled={s.busy === 'download' || s.device === 'unsupported' || s.device === 'unavailable' || s.device === 'available'}
        onClick={s.downloadModel}
      >
        {s.busy === 'download' ? <Spinner /> : <Download size={16} />}
        {s.device === 'available' ? 'Gemini Nano is ready' : 'Download Gemini Nano'}
      </button>
      {s.downloadPct !== null && (
        <div className="progress" aria-label="Download progress">
          <span style={{ width: `${Math.round(s.downloadPct * 100)}%` }} />
        </div>
      )}
      <p className="muted small">
        Without the on-device model Airlock still scrubs with deterministic rules, Quick triage falls back to the cloud (on scrubbed text
        only), and screenshots are refused rather than uploaded.
      </p>
    </Drawer>
  );
}

export function IncidentsPanel({ s, onClose }: { s: AirlockState; onClose: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [list, setList] = useState<Incident[] | null>(null);
  const [open, setOpen] = useState<Incident | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => watchUser(setUser), []);
  useEffect(() => {
    if (!cloudReady) return;
    listIncidents()
      .then(setList)
      .catch((e) => setErr(String(e?.message ?? e)));
  }, [user?.uid, s.savedId]);

  if (!firebaseConfigured || !cloudReady) {
    return (
      <Drawer title="Saved incidents" icon={<Folder />} onClose={onClose}>
        <p className="muted">
          Saving needs a Firebase project with Firestore, Auth and App Check (state: <code>{appCheckState}</code>). Follow OWNER_STEPS.md.
        </p>
      </Drawer>
    );
  }

  const vault = open ? s.sessionVaults.current.get(open.id) : undefined;
  return (
    <Drawer title="Saved incidents" icon={<Folder />} onClose={onClose}>
      <div className="account">
        <span className="muted small">
          {user ? (user.isAnonymous ? 'Anonymous session' : user.email) : 'Not signed in'} · only redacted text is stored
        </span>
        {user && !user.isAnonymous ? (
          <button className="btn ghost small" onClick={() => signOutUser()}>
            Sign out
          </button>
        ) : (
          <button className="btn ghost small" onClick={() => signInGoogle().catch((e) => setErr(String(e?.message ?? e)))}>
            Sign in with Google
          </button>
        )}
      </div>
      {err && <p className="error-text">{err}</p>}
      {open ? (
        <div className="incident-open">
          <button className="btn ghost small" onClick={() => setOpen(null)}>
            ← All incidents
          </button>
          <h3>{open.title}</h3>
          <div className="row">
            <SeverityPill level={open.severity} />
            <SourceBadge source={open.source} />
            <span className="muted small">{open.hiddenCount} values hidden</span>
          </div>
          <p className="muted small">
            {vault ? 'Rehydrated with this tab’s in-memory vault.' : 'Real values were never stored — showing the redacted version.'}
          </p>
          <pre className="code small-code">{vault ? rehydrate(toMarkdown(open.analysis), vault) : toMarkdown(open.analysis)}</pre>
          <details>
            <summary>Stored (redacted) log</summary>
            <pre className="code small-code">{open.redactedText}</pre>
          </details>
        </div>
      ) : (
        <ul className="incidents">
          {list === null && (
            <li className="empty">
              <Spinner /> Loading…
            </li>
          )}
          {list?.length === 0 && <li className="empty">No saved incidents yet.</li>}
          {list?.map((i) => (
            <li key={i.id}>
              <button className="incident-row" onClick={() => setOpen(i)}>
                <SeverityPill level={i.severity} />
                <span className="t">{i.title}</span>
                <span className="muted small">{i.createdAt ? i.createdAt.toDate().toLocaleString() : ''}</span>
              </button>
              <button
                className="icon-btn"
                aria-label="Delete incident"
                onClick={async () => {
                  await deleteIncident(i.id);
                  setList((l) => l?.filter((x) => x.id !== i.id) ?? null);
                }}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
