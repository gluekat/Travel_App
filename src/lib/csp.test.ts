import { describe, expect, it } from 'vitest';
import tauriConf from '../../src-tauri/tauri.conf.json';
import { ALLOWED_CONNECT_ORIGINS, WEB_CSP } from './csp';

const directive = (csp: string, name: string) =>
  csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `))?.split(/\s+/).slice(1) ?? [];

describe('content security policy', () => {
  it('allows network requests only to this site and Open-Meteo', () => {
    expect(ALLOWED_CONNECT_ORIGINS).toEqual([
      'https://geocoding-api.open-meteo.com',
      'https://api.open-meteo.com',
      'https://archive-api.open-meteo.com',
    ]);
    expect(directive(WEB_CSP, 'connect-src')).toEqual(["'self'", ...ALLOWED_CONNECT_ORIGINS]);
  });

  it('allows no inline or remote scripts or styles', () => {
    expect(directive(WEB_CSP, 'script-src')).toEqual(["'self'"]);
    expect(directive(WEB_CSP, 'style-src')).toEqual(["'self'"]);
    expect(WEB_CSP).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
    expect(directive(WEB_CSP, 'object-src')).toEqual(["'none'"]);
  });

  it('matches the desktop app policy for outbound hosts', () => {
    const desktop = directive(tauriConf.app.security.csp, 'connect-src').filter((s) => s.startsWith('https://'));
    expect(desktop.sort()).toEqual([...ALLOWED_CONNECT_ORIGINS].sort());
  });
});
