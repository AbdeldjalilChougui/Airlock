import { useState } from 'react';
import type { Analysis } from '../lib/types';
import { rehydrate, rehydrateSegments } from '../lib/vault';
import type { AirlockState } from '../useAirlock';
import { Rehydrated, SeverityPill, SourceBadge, Spinner, Switch } from './bits';
import { Back, Bolt, Check, Cloud, Copy, Plus, Save } from './icons';
import { firebaseConfigured, isExtension } from '../firebase/app';

export function toMarkdown(a: Analysis): string {
  return [
    `## ${a.summary}`,
    `**Severity:** ${a.severity} · **Confidence:** ${Math.round(a.confidence * 100)}%`,
    `### Likely cause\n${a.likelyCause}`,
    `### Evidence\n${a.evidence.map((e) => `- \`${e.line}\` — ${e.why}`).join('\n')}`,
    `### Fix\n${a.fixSteps.map((f, i) => `${i + 1}. ${f}`).join('\n')}`,
    a.followUps.length ? `### Follow-ups\n${a.followUps.map((f) => `- ${f}`).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function ResultStage({ s }: { s: AirlockState }) {
  const [asSent, setAsSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const vault = s.redaction.vault;
  const R = ({ text }: { text: string }) => <Rehydrated segments={rehydrateSegments(text, vault)} showPlaceholders={asSent} />;
  const restoredCount = s.analysis
    ? rehydrateSegments(JSON.stringify(s.analysis.data), vault).filter((x) => x.placeholder).length
    : 0;

  const copy = async () => {
    if (!s.analysis) return;
    await navigator.clipboard.writeText(rehydrate(toMarkdown(s.analysis.data), vault));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="results">
      <div className="results-bar">
        <button className="btn ghost" onClick={() => s.setStage('review')}>
          <Back size={16} /> Back to review
        </button>
        <label className="rehydrate-toggle">
          <Switch checked={!asSent} onChange={(v) => setAsSent(!v)} label="Rehydrate locally" />
          <span>
            {asSent ? 'Showing what the model saw' : 'Rehydrated on this device'}
            <small>{asSent ? 'placeholders only' : 'real values restored from the in-memory vault'}</small>
          </span>
        </label>
        <button className="btn ghost" onClick={s.newIncident}>
          <Plus size={16} /> New incident
        </button>
      </div>

      {s.triage && (
        <section className="card triage-card" aria-label="Quick triage">
          <div className="triage-icon">
            <Bolt size={18} />
          </div>
          <div className="triage-body">
            <div className="row">
              <span className="eyebrow">Quick triage</span>
              <SeverityPill level={s.triage.data.severity} />
            </div>
            <p className="headline">
              <R text={s.triage.data.headline} />
            </p>
            <p className="next">
              <strong>Next step:</strong> <R text={s.triage.data.nextStep} />
            </p>
          </div>
          <SourceBadge source={s.triage.source} ms={s.triage.ms} mode="PREFER_ON_DEVICE" />
        </section>
      )}

      {!s.analysis && s.triage && (
        <div className="upsell">
          <span>Want the full root-cause analysis?</span>
          <button className="btn primary small" disabled={!s.cloudReady || !s.online || s.busy !== null} onClick={s.analyze}>
            {s.busy === 'analyze' ? <Spinner /> : <Cloud size={14} />} Analyze scrubbed log in cloud
          </button>
        </div>
      )}

      {s.analysis && (
        <article className="card analysis" aria-label="Analysis">
          <header className="analysis-head">
            <div>
              <div className="row">
                <span className="eyebrow">Root-cause analysis</span>
                <SeverityPill level={s.analysis.data.severity} />
                <span className="confidence" title="Model confidence">
                  <span className="bar">
                    <span style={{ width: `${Math.round(s.analysis.data.confidence * 100)}%` }} />
                  </span>
                  {Math.round(s.analysis.data.confidence * 100)}%
                </span>
              </div>
              <h2>
                <R text={s.analysis.data.summary} />
              </h2>
            </div>
            <SourceBadge source={s.analysis.source} ms={s.analysis.ms} mode="PREFER_IN_CLOUD" />
          </header>

          <div className="analysis-grid">
            <section>
              <h3>Likely cause</h3>
              <p>
                <R text={s.analysis.data.likelyCause} />
              </p>
              <h3>Evidence</h3>
              <ul className="evidence">
                {s.analysis.data.evidence.map((e, i) => (
                  <li key={i}>
                    <code>
                      <R text={e.line} />
                    </code>
                    <span>
                      <R text={e.why} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3>Fix</h3>
              <ol className="fix">
                {s.analysis.data.fixSteps.map((f, i) => (
                  <li key={i}>
                    <span className="n">{i + 1}</span>
                    <span>
                      <R text={f} />
                    </span>
                  </li>
                ))}
              </ol>
              {s.analysis.data.followUps.length > 0 && (
                <>
                  <h3>Follow-ups</h3>
                  <ul className="follow">
                    {s.analysis.data.followUps.map((f, i) => (
                      <li key={i}>
                        <R text={f} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>

          <footer className="analysis-foot">
            <span className="muted small">
              {restoredCount} placeholder{restoredCount === 1 ? '' : 's'} restored locally · the cloud never saw the real values
            </span>
            <div className="actions">
              <button className="btn ghost" onClick={copy}>
                {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy as Markdown'}
              </button>
              {!isExtension && (
                <button className="btn secondary" disabled={!firebaseConfigured || !s.cloudReady || s.busy !== null || !!s.savedId} onClick={s.save}>
                  {s.busy === 'save' ? <Spinner /> : s.savedId ? <Check size={16} /> : <Save size={16} />}
                  {s.savedId ? 'Saved (redacted)' : 'Save incident (redacted)'}
                </button>
              )}
            </div>
          </footer>
        </article>
      )}
    </div>
  );
}
