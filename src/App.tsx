import { useEffect, useState } from 'react';
import { isExtension } from './firebase/app';
import { useAirlock } from './useAirlock';
import { Chambers, Header, type Panel } from './ui/Header';
import { InputStage } from './ui/InputStage';
import { DevicePanel, IncidentsPanel, LedgerPanel, PolicyPanel, useLedger } from './ui/Panels';
import { ResultStage } from './ui/ResultStage';
import { ReviewStage } from './ui/ReviewStage';
import { Alert, Bolt, Chip, Cloud, Image, X } from './ui/icons';

function initialTheme(): 'dark' | 'light' {
  try {
    const t = localStorage.getItem('airlock-theme');
    if (t === 'dark' || t === 'light') return t;
  } catch {
    /* storage blocked */
  }
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export default function App({ pendingText }: { pendingText?: string | null }) {
  const s = useAirlock();
  const [theme, setTheme] = useState(initialTheme);
  const [panel, setPanel] = useState<Panel>(null);
  const ledgerRows = useLedger();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('airlock-theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    if (pendingText) {
      s.newIncident();
      s.setInput(pendingText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingText]);

  return (
    <div className={`shell ${isExtension ? 'is-ext' : ''}`}>
      <Header s={s} theme={theme} setTheme={setTheme} open={setPanel} ledgerCount={ledgerRows.length} />
      <main className="main">
        <Chambers stage={s.stage} onStep={s.setStage} />

        {s.error && (
          <div className="banner error" role="alert">
            <Alert size={16} />
            <span>{s.error}</span>
            <button className="icon-btn" onClick={() => s.setError(null)} aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        )}

        {s.stage === 'input' && (
          <>
            <InputStage s={s} />
            {!isExtension && <HowItWorks />}
          </>
        )}
        {s.stage === 'review' && <ReviewStage s={s} />}
        {s.stage === 'result' && <ResultStage s={s} />}
      </main>
      {!isExtension && (
        <footer className="site-foot">
          Airlock · built for #BuildHybridAI with Firebase AI Logic · the vault lives only in this tab
        </footer>
      )}

      {panel === 'ledger' && <LedgerPanel onClose={() => setPanel(null)} />}
      {panel === 'policy' && <PolicyPanel s={s} onClose={() => setPanel(null)} />}
      {panel === 'device' && <DevicePanel s={s} onClose={() => setPanel(null)} />}
      {panel === 'incidents' && <IncidentsPanel s={s} onClose={() => setPanel(null)} />}
    </div>
  );
}

function HowItWorks() {
  const cards = [
    {
      icon: <Chip size={18} />,
      mode: 'ONLY_ON_DEVICE',
      title: 'Scrub',
      body: 'Regex + entropy rules, then Gemini Nano with a JSON schema finds names, customers and codenames. Raw text never leaves.',
      tone: 'device',
    },
    {
      icon: <Image size={18} />,
      mode: 'ONLY_ON_DEVICE',
      title: 'Screenshot → text',
      body: 'PNG/JPEG errors are transcribed by Nano locally, then scrubbed like any log. Images are never uploaded.',
      tone: 'device',
    },
    {
      icon: <Cloud size={18} />,
      mode: 'PREFER_IN_CLOUD',
      title: 'Analyze',
      body: 'Only the placeholder version goes to cloud Gemini for root cause, evidence and fix steps as structured JSON.',
      tone: 'cloud',
    },
    {
      icon: <Bolt size={18} />,
      mode: 'PREFER_ON_DEVICE',
      title: 'Quick triage',
      body: 'One-line diagnosis from Nano — works on a plane. Input is scrubbed, so a cloud fallback is still safe.',
      tone: 'device',
    },
  ];
  return (
    <section className="how" aria-label="How Airlock uses hybrid inference">
      {cards.map((c) => (
        <div key={c.title} className={`how-card t-${c.tone}`}>
          <div className="how-top">
            {c.icon}
            <code>{c.mode}</code>
          </div>
          <h3>{c.title}</h3>
          <p>{c.body}</p>
        </div>
      ))}
    </section>
  );
}
