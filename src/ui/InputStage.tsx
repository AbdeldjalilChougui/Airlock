import { useRef } from 'react';
import { chunkBudgetChars, chunkText, DEFAULT_CONTEXT_TOKENS, estimateTokens } from '../lib/chunk';
import { MESSY_LOG, SAMPLE_CONFIG } from '../lib/samples';
import type { AirlockState } from '../useAirlock';
import { Spinner, Switch } from './bits';
import { Arrow, Clipboard, Flask, Image, Lock, X } from './icons';

export function InputStage({ s }: { s: AirlockState }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const tokens = estimateTokens(s.input);
  const chunks = s.input ? chunkText(s.input, chunkBudgetChars(DEFAULT_CONTEXT_TOKENS)).length : 0;
  const nanoPossible = s.device !== 'unsupported' && s.device !== 'unavailable';

  const pasteClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) s.setInput(t);
    } catch {
      s.setError('Clipboard access was blocked — paste with Ctrl/Cmd+V instead.');
    }
  };

  return (
    <section className="card input-card" aria-labelledby="input-title">
      <div className="card-head">
        <div>
          <h1 id="input-title">Paste the incident</h1>
          <p className="muted">Logs, stack traces, configs or a screenshot. Nothing leaves this device until you approve the scrubbed version.</p>
        </div>
        <div className="sample-row">
          <button className="chip-btn" onClick={() => s.setInput(MESSY_LOG)}>
            <Flask size={14} /> Messy log
          </button>
          <button className="chip-btn" onClick={() => s.setInput(SAMPLE_CONFIG)}>
            <Flask size={14} /> Leaky config
          </button>
          <button className="chip-btn" onClick={pasteClipboard}>
            <Clipboard size={14} /> Clipboard
          </button>
          <button className="chip-btn" onClick={() => fileRef.current?.click()} disabled={s.busy === 'ocr'}>
            {s.busy === 'ocr' ? <Spinner /> : <Image size={14} />} Screenshot
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) s.ocr(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {s.image && (
        <div className="attached">
          <img src={s.image.dataUrl} alt="" />
          <div>
            <strong>{s.image.name}</strong>
            <span className="muted">
              {s.busy === 'ocr' ? 'Transcribing with Gemini Nano on this device…' : 'Transcribed locally. The image is never uploaded.'}
            </span>
          </div>
          <button className="icon-btn" aria-label="Remove screenshot" onClick={() => s.setImage(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className="editor">
        <textarea
          value={s.input}
          onChange={(e) => s.setInput(e.target.value)}
          placeholder={'2026-11-24T09:41:13Z ERROR pg: connect ETIMEDOUT 10.42.7.19:5432\n    at Connection.<anonymous> (node_modules/pg/lib/client.js:132:73)\n…'}
          spellCheck={false}
          aria-label="Log input"
        />
      </div>

      <footer className="card-foot">
        <div className="meta">
          <span>{s.input.length.toLocaleString()} chars</span>
          <span>~{tokens.toLocaleString()} tokens</span>
          {chunks > 1 && <span className="tag">{chunks} Nano chunks</span>}
        </div>
        <label className={`nano-toggle ${nanoPossible ? '' : 'disabled'}`}>
          <Switch checked={s.useNano && nanoPossible} onChange={s.setUseNano} label="Context scan with Gemini Nano" />
          <span>
            Context scan with Gemini Nano
            <small>{nanoPossible ? 'names, customers, codenames · ONLY_ON_DEVICE' : 'needs Chrome built-in AI — rules still run'}</small>
          </span>
        </label>
        <button className="btn primary" disabled={!s.input.trim() || s.busy !== null} onClick={s.scrub}>
          {s.busy === 'scrub' ? <Spinner /> : <Lock size={16} />}
          Scrub on this device
          <Arrow size={16} />
        </button>
      </footer>
    </section>
  );
}
