import { useMemo, useState, type ReactNode } from 'react';
import { GROUP_LABEL, GROUP_OF } from '../lib/policy';
import type { Group, Kind, RedactionItem } from '../lib/types';
import { maskPreview } from '../lib/vault';
import type { AirlockState } from '../useAirlock';
import { Spinner, Switch } from './bits';
import { Alert, Back, Bolt, Check, Chip, Cloud, Eye, Plus, Shield } from './icons';

const ORIGIN_LABEL = { rule: 'Rule', entropy: 'Entropy', nano: 'Nano', user: 'You' } as const;
const GROUP_ORDER: Group[] = ['secrets', 'entropy', 'contact', 'network', 'identifiers', 'financial', 'context'];

function groupOf(i: RedactionItem): Group {
  return i.origin === 'entropy' ? 'entropy' : GROUP_OF[i.kind];
}

export function ReviewStage({ s }: { s: AirlockState }) {
  const [view, setView] = useState<'diff' | 'payload'>('diff');
  const [term, setTerm] = useState('');
  const [reveal, setReveal] = useState(false);
  const enabled = s.items.filter((i) => i.enabled);
  const byValue = useMemo(() => new Map(s.items.map((i) => [i.value, i])), [s.items]);

  const groups = useMemo(() => {
    const m = new Map<Group, RedactionItem[]>();
    for (const i of s.items) {
      const g = groupOf(i);
      m.set(g, [...(m.get(g) ?? []), i]);
    }
    return GROUP_ORDER.filter((g) => m.has(g)).map((g) => [g, m.get(g)!] as const);
  }, [s.items]);

  const diff = useMemo(() => {
    const out: ReactNode[] = [];
    let cursor = 0;
    s.findings.forEach((f, idx) => {
      if (f.start < cursor) return;
      const item = byValue.get(f.value);
      if (!item) return;
      out.push(s.input.slice(cursor, f.start));
      out.push(
        <button
          key={idx}
          className={`hit k-${GROUP_OF[f.kind]} ${item.enabled ? '' : 'off'} o-${f.origin}`}
          onClick={() => s.toggle(item.id)}
          title={`${item.reason} — click to ${item.enabled ? 'send as-is' : 'hide'}`}
        >
          {item.enabled ? (
            <>
              <s>{f.value}</s>
              <span className="ph">{item.placeholder}</span>
            </>
          ) : (
            f.value
          )}
        </button>,
      );
      cursor = f.end;
    });
    out.push(s.input.slice(cursor));
    return out;
  }, [s.findings, s.input, byValue, s]);

  const payload = useMemo(() => {
    const parts = s.redaction.text.split(/(⟦[A-Z_]+_\d+⟧)/g);
    return parts.map((p, i) => (p.startsWith('⟦') ? <span key={i} className="ph solo">{p}</span> : p));
  }, [s.redaction.text]);

  const cloudBlocked = !s.cloudReady || !s.online;
  const canSend = s.leaks.length === 0 && s.busy === null;

  return (
    <div className="review">
      <aside className="card items-card" aria-label="Values to hide">
        <div className="card-head tight">
          <div>
            <h2>What stays behind</h2>
            <p className="muted">
              {enabled.length} of {s.items.length} values hidden · click any to toggle
            </p>
          </div>
          <button className="icon-btn" onClick={() => setReveal(!reveal)} aria-label="Reveal values" title={reveal ? 'Mask values' : 'Reveal values'}>
            <Eye />
          </button>
        </div>

        <NanoLine s={s} />

        <div className="items-scroll">
          {groups.length === 0 && <p className="empty">No sensitive values found by the rules. Add terms below if needed.</p>}
          {groups.map(([g, list]) => {
            const allOn = list.every((i) => i.enabled);
            return (
              <section key={g} className="group">
                <header>
                  <span className={`gdot k-${g}`} />
                  <span>{GROUP_LABEL[g]}</span>
                  <span className="count">{list.length}</span>
                  <Switch
                    checked={allOn}
                    label={`Toggle all ${GROUP_LABEL[g]}`}
                    onChange={(v) => [...new Set(list.map((i) => i.kind))].forEach((k: Kind) => s.toggleKind(k, v))}
                  />
                </header>
                <ul>
                  {list.map((i) => (
                    <li key={i.id} className={i.enabled ? '' : 'is-off'}>
                      <label>
                        <input type="checkbox" checked={i.enabled} onChange={() => s.toggle(i.id)} />
                        <span className="ph mini">{i.placeholder}</span>
                        <code className="val">{reveal ? i.value : maskPreview(i.value)}</code>
                        <span className={`origin o-${i.origin}`}>{ORIGIN_LABEL[i.origin]}</span>
                        {i.count > 1 && <span className="times">×{i.count}</span>}
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <form
          className="add-term"
          onSubmit={(e) => {
            e.preventDefault();
            s.addTerm(term);
            setTerm('');
          }}
        >
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Also hide… (a name, codename, customer)" aria-label="Add a term to hide" />
          <button className="btn small" disabled={term.trim().length < 2}>
            <Plus size={14} /> Hide
          </button>
        </form>
      </aside>

      <section className="card diff-card" aria-label="Diff">
        <div className="card-head tight">
          <div className="seg" role="tablist">
            <button role="tab" aria-selected={view === 'diff'} className={view === 'diff' ? 'on' : ''} onClick={() => setView('diff')}>
              Diff
            </button>
            <button role="tab" aria-selected={view === 'payload'} className={view === 'payload' ? 'on' : ''} onClick={() => setView('payload')}>
              Exact payload
            </button>
          </div>
          <span className="muted small">{view === 'diff' ? 'Original struck through → placeholder that will be sent' : 'Byte-for-byte what the cloud receives'}</span>
        </div>
        <pre className="code diff">{view === 'diff' ? diff : payload}</pre>
      </section>

      <div className="actionbar">
        <button className="btn ghost" onClick={() => s.setStage('input')}>
          <Back size={16} /> Edit
        </button>
        <div className={`guard ${s.leaks.length ? 'bad' : 'good'}`}>
          {s.leaks.length ? <Alert size={16} /> : <Shield size={16} />}
          <span>
            {s.leaks.length
              ? `Egress guard: ${s.leaks.length} hidden value(s) still present — fix before sending`
              : `Egress guard: 0 originals in payload · ${s.redaction.text.length.toLocaleString()} chars · vault stays in this tab`}
          </span>
        </div>
        <div className="actions">
          <button className="btn secondary" disabled={!canSend} onClick={s.runTriage} title="InferenceMode.PREFER_ON_DEVICE">
            {s.busy === 'triage' ? <Spinner /> : <Bolt size={16} />}
            Quick triage
            <span className="mode-hint">
              <Chip size={12} /> on-device
            </span>
          </button>
          <button
            className="btn primary"
            disabled={!canSend || cloudBlocked}
            onClick={s.analyze}
            title={cloudBlocked ? (s.online ? 'Firebase AI Logic / App Check not configured' : 'Offline — use Quick triage') : 'InferenceMode.PREFER_IN_CLOUD'}
          >
            {s.busy === 'analyze' ? <Spinner /> : <Cloud size={16} />}
            Analyze in cloud
            <span className="mode-hint">
              <Check size={12} /> scrubbed only
            </span>
          </button>
        </div>
      </div>
      {cloudBlocked && (
        <p className="hint-line">
          {s.online
            ? 'Cloud analysis needs a Firebase project with AI Logic + App Check (see OWNER_STEPS.md). Quick triage still works on-device.'
            : 'You are offline. Quick triage runs on Gemini Nano; the cloud button comes back when you reconnect.'}
        </p>
      )}
    </div>
  );
}

function NanoLine({ s }: { s: AirlockState }) {
  const n = s.nano;
  if (n.state === 'running')
    return (
      <div className="nano-line running">
        <Spinner />
        <span>
          Gemini Nano scanning for names & codenames{n.total ? ` · chunk ${Math.min(n.done + 1, n.total)}/${n.total}` : '…'}
        </span>
        <span className="src-chip on_device">ONLY_ON_DEVICE</span>
      </div>
    );
  if (n.state === 'done')
    return (
      <div className="nano-line done">
        <Chip size={14} />
        <span>
          Nano added {n.found} context value{n.found === 1 ? '' : 's'}
          {n.total > 1 ? ` across ${n.total} chunks` : ''}
        </span>
        <span className="src-chip on_device">on-device</span>
      </div>
    );
  if (n.state === 'unavailable' || n.state === 'error')
    return (
      <div className="nano-line warn">
        <Alert size={14} />
        <span>
          Context scan skipped — {n.note ?? 'on-device model not available'}. Rules ran; add names manually below.
        </span>
      </div>
    );
  return null;
}
