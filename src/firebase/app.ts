import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check';

const env = import.meta.env;

const config: FirebaseOptions = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

/** True when a real Firebase project is configured in .env.local. */
export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

/** Running as the Chrome extension side panel (reCAPTCHA cannot load there). */
export const isExtension = Boolean((globalThis as { chrome?: { runtime?: { id?: string } } }).chrome?.runtime?.id);

/**
 * Without a project we still initialize with inert values: ONLY_ON_DEVICE
 * inference never touches the network, so local scrubbing keeps working.
 */
export const app = initializeApp(
  firebaseConfigured ? config : { apiKey: 'local-only', projectId: 'local-only', appId: '1:0:web:local-only' },
);

export type AppCheckState = 'recaptcha-enterprise' | 'recaptcha-v3' | 'debug' | 'missing' | 'unsupported';

function setupAppCheck(): { appCheck: AppCheck | null; state: AppCheckState } {
  if (!firebaseConfigured) return { appCheck: null, state: 'missing' };
  if (isExtension) return { appCheck: null, state: 'unsupported' };
  const enterpriseKey = env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
  const v3Key = env.VITE_RECAPTCHA_V3_SITE_KEY;
  let state: AppCheckState = enterpriseKey ? 'recaptcha-enterprise' : v3Key ? 'recaptcha-v3' : 'missing';
  // Debug provider: dev server only, token comes from .env.local (never committed).
  if (env.DEV && env.VITE_APPCHECK_DEBUG_TOKEN) {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      env.VITE_APPCHECK_DEBUG_TOKEN === 'true' ? true : env.VITE_APPCHECK_DEBUG_TOKEN;
    state = 'debug';
  }
  if (state === 'missing') return { appCheck: null, state };
  const siteKey = enterpriseKey || v3Key || 'debug-only';
  const provider = enterpriseKey ? new ReCaptchaEnterpriseProvider(siteKey) : new ReCaptchaV3Provider(siteKey);
  const appCheck = initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
  return { appCheck, state };
}

export const { appCheck, state: appCheckState } = setupAppCheck();

/** Cloud features (Gemini in the cloud, Firestore, Remote Config) need a project AND App Check. */
export const cloudReady = firebaseConfigured && appCheck !== null;
