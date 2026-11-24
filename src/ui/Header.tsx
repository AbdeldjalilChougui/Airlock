import type { AirlockState } from '../useAirlock';
import { appCheckState, firebaseConfigured, isExtension } from '../firebase/app';
import { Chip, Cloud, Folder, List, Logo, Moon, Sliders, Sun, Wifi, WifiOff } from './icons';

export type Panel = 'ledger' | 'incidents' | 'policy' | 'device' | null;

const DEVICE_LABEL: Record<string, string> = {
  available: 'Nano ready',
  downloadable: 'Nano: download',
  downloading: 'Nano: downloading',
  unavailable: 'Nano unavailable',
  unsupported: 'Nano unsupported',
};

export function Header({
  s,
  theme,
  setTheme,
  open,
  ledgerCount,
}: {
  s: AirlockState;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  open: (p: Panel) => void;
  ledgerCount: number;
}) {
  const deviceOk = s.device === 'available';
  const cloudLabel = !firebaseConfigured ? 'Cloud: not set up' : appCheckState === 'unsupported' ? 'Cloud: web app only' : s.cloudReady ? 'Cloud + App Check' : 'Cloud: App Check missing';
  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        <div>
          <div className="brand-name">Airlock</div>
          {!isExtension && <div className="brand-tag">Scrub on-device. Reason in the cloud.</div>}
        </div>
      </div>
      <nav className="status" aria-label="Status">
        <span className={`pill ${s.online ? 'ok' : 'warn'}`} title={s.online ? 'Online' : 'Offline — on-device only'}>
          {s.online ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span className="pill-text">{s.online ? 'Online' : 'Offline'}</span>
        </span>
        <button className={`pill ${deviceOk ? 'device' : 'muted'}`} onClick={() => open('device')} title="On-device model status">
          <Chip size={14} />
          <span className="pill-text">{DEVICE_LABEL[s.device]}</span>
        </button>
        <span className={`pill ${s.cloudReady && s.online ? 'cloud' : 'muted'}`} title="Firebase AI Logic cloud backend">
          <Cloud size={14} />
          <span className="pill-text">{cloudLabel}</span>
        </span>
      </nav>
      <div className="tools">
        <button className="icon-btn" onClick={() => open('ledger')} title="Privacy ledger" aria-label="Privacy ledger">
          <List />
          {ledgerCount > 0 && <span className="dot-count">{ledgerCount}</span>}
        </button>
        {!isExtension && (
          <button className="icon-btn" onClick={() => open('incidents')} title="Saved incidents" aria-label="Saved incidents">
            <Folder />
          </button>
        )}
        <button className="icon-btn" onClick={() => open('policy')} title="Redaction policy" aria-label="Redaction policy">
          <Sliders />
        </button>
        <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun /> : <Moon />}
        </button>
      </div>
    </header>
  );
}

const STEPS = [
  { key: 'input', title: 'Your device', sub: 'Raw log stays here' },
  { key: 'review', title: 'Airlock', sub: 'Scrub & review on-device' },
  { key: 'result', title: 'Cloud', sub: 'Only placeholders cross' },
] as const;

export function Chambers({ stage, onStep }: { stage: AirlockState['stage']; onStep: (s: AirlockState['stage']) => void }) {
  const idx = STEPS.findIndex((s) => s.key === stage);
  return (
    <ol className="chambers" aria-label="Progress">
      {STEPS.map((st, i) => (
        <li key={st.key} className={`chamber ${i === idx ? 'current' : ''} ${i < idx ? 'done' : ''} ch-${st.key}`}>
          <button disabled={i > idx} onClick={() => onStep(st.key)}>
            <span className="ch-num">{i + 1}</span>
            <span className="ch-text">
              <strong>{st.title}</strong>
              <small>{st.sub}</small>
            </span>
          </button>
          {i < STEPS.length - 1 && <span className={`door ${i < idx ? 'open' : ''}`} aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}
