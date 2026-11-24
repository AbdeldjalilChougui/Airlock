import type { ReactNode } from 'react';
import type { InferenceSourceLabel, Severity } from '../lib/types';
import type { Segment } from '../lib/vault';
import { Chip, Cloud, Shield, X } from './icons';

/** Shows where inference REALLY ran, read from response.inferenceSource. */
export function SourceBadge({ source, ms, mode }: { source: InferenceSourceLabel; ms?: number; mode?: string }) {
  const label = source === 'on_device' ? 'On-device · Gemini Nano' : source === 'in_cloud' ? 'Cloud · Gemini' : 'Rules · local';
  const Icon = source === 'in_cloud' ? Cloud : source === 'on_device' ? Chip : Shield;
  return (
    <span className={`source-badge src-${source}`} title={mode ? `Requested mode: ${mode}. Actual source: ${source}.` : undefined}>
      <span className="pulse" aria-hidden="true" />
      <Icon size={14} />
      <span>{label}</span>
      {ms !== undefined && <span className="badge-ms">{ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`}</span>}
    </span>
  );
}

export function SeverityPill({ level }: { level: Severity['level'] }) {
  return <span className={`sev sev-${level}`}>{level}</span>;
}

export function Rehydrated({ segments, showPlaceholders }: { segments: Segment[]; showPlaceholders: boolean }) {
  return (
    <>
      {segments.map((s, i) =>
        s.placeholder ? (
          showPlaceholders ? (
            <span key={i} className="ph">
              {s.placeholder}
            </span>
          ) : (
            <span key={i} className="restored" title={`Restored locally from ${s.placeholder}`}>
              {s.text}
            </span>
          )
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

export function Drawer({ title, onClose, children, icon }: { title: string; onClose: () => void; children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="drawer-scrim" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <h2>
            {icon}
            {title}
          </h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span className="knob" />
    </button>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}
