/**
 * Content Security Policy for the web build (injected as a <meta> tag by
 * vite.config.ts). The only allowed outbound hosts are derived from the
 * weather client's URLs, so the policy and the code can't drift apart.
 * Mirrors the desktop app's CSP in src-tauri/tauri.conf.json.
 */
import { ARCHIVE_URL, FORECAST_URL, GEOCODE_URL } from '../weather/openMeteo';

export const ALLOWED_CONNECT_ORIGINS = [GEOCODE_URL, FORECAST_URL, ARCHIVE_URL].map((u) => new URL(u).origin);

export const WEB_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self' ${ALLOWED_CONNECT_ORIGINS.join(' ')}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
