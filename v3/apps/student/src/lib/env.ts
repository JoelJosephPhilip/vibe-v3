/**
 * Runtime configuration from Vite env vars (see .env.example).
 * Local development defaults to the local backend + Firebase Auth emulator.
 */
const e = import.meta.env;

export const env = {
  /** Backend origin. Empty = same origin (the Vite dev server proxies /api to the local backend). */
  apiBaseUrl: (e.VITE_API_BASE_URL as string | undefined) ?? '',
  firebase: {
    apiKey: (e.VITE_FIREBASE_API_KEY as string | undefined) ?? 'demo-api-key',
    authDomain: e.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
    projectId: (e.VITE_FIREBASE_PROJECT_ID as string | undefined) ?? 'demo-vibe',
    appId: e.VITE_FIREBASE_APP_ID as string | undefined,
  },
  /**
   * When set, Firebase Auth talks to the emulator. "same-origin" routes it through
   * the Vite dev proxy (works over an SSH tunnel); a URL points at it directly.
   */
  authEmulatorUrl:
    e.VITE_FIREBASE_AUTH_EMULATOR_URL === 'same-origin'
      ? window.location.origin
      : (e.VITE_FIREBASE_AUTH_EMULATOR_URL as string | undefined),
} as const;
