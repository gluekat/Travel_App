import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';
import { WEB_CSP } from './src/lib/csp';

// Served from the site root by default (dev, desktop app). The GitHub Pages
// build sets VITE_BASE=/Travel_App/ because Pages serves the repo from a sub-path.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const base = env.VITE_BASE ?? '/';
// 'dev' for the development preview hosted at /Travel_App/dev/ (see src/lib/channel.ts).
const isDev = env.VITE_CHANNEL === 'dev';

// Content Security Policy (src/lib/csp.ts) for the web build. GitHub Pages
// can't send headers, so it is delivered as a <meta> tag. Skipped for the
// Tauri build (Tauri injects its own CSP) and for the dev server (Vite's live
// reload needs inline scripts).
function webSecurityMeta(): Plugin {
  return {
    name: 'packwise-web-security-meta',
    apply: 'build',
    transformIndexHtml() {
      if (env.TAURI_ENV_PLATFORM) return [];
      return [
        { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: WEB_CSP }, injectTo: 'head-prepend' },
        // Don't tell Open-Meteo which page a request came from.
        { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head-prepend' },
      ];
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    webSecurityMeta(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: isDev ? 'PackWise (dev preview)' : 'PackWise',
        short_name: isDev ? 'PackWise dev' : 'PackWise',
        // Distinct id so the stable and dev versions install as separate apps.
        id: base,
        description: 'Plan and pack outfits for your trip. Your data stays on your device.',
        theme_color: '#0f766e',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache every built asset so the app shell loads with no network.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: `${base}index.html`,
        // The stable app's scope contains the dev preview at <base>dev/; never
        // answer those navigations with the stable app.
        navigateFallbackDenylist: isDev ? [] : [new RegExp(`^${base}dev/`)],
        // Weather API calls are never cached by the service worker; the app
        // caches weather per trip in IndexedDB instead.
        runtimeCaching: [],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
  },
});
