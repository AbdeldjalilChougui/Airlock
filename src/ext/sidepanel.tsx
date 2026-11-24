import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../App';
import '../styles.css';

// Minimal typing for the bits of the extension API we use.
declare const chrome: {
  storage: {
    session: {
      get(key: string): Promise<Record<string, { text: string; at: number } | undefined>>;
      remove(key: string): Promise<void>;
      onChanged: { addListener(cb: (changes: Record<string, { newValue?: { text: string; at: number } }>) => void): void };
    };
  };
};

/** Side panel: receives "Scrub selection" text from the background worker. */
function SidePanel() {
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    chrome.storage.session.get('pending').then((r) => {
      if (r.pending?.text) setPending(r.pending.text);
      chrome.storage.session.remove('pending');
    });
    chrome.storage.session.onChanged.addListener((changes) => {
      const v = changes.pending?.newValue;
      if (v?.text) {
        setPending(v.text + '​'.repeat(v.at % 2)); // force a new value for repeated selections
        chrome.storage.session.remove('pending');
      }
    });
  }, []);
  return <App pendingText={pending?.replace(/​/g, '') ?? null} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SidePanel />
  </StrictMode>,
);
