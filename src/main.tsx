import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { isTauri } from '@tauri-apps/api/core';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import { App } from './App';
import { seedIfFirstRun } from './db/seed';
import { requestPersistentStorage } from './db/persist';
import { initSync } from './storage/fileSync';
import { IS_DEV_CHANNEL } from './lib/channel';

if (IS_DEV_CHANNEL) document.title = 'PackWise (dev)';

async function start() {
  await seedIfFirstRun();
  if (isTauri()) {
    // Desktop app: always save to Documents/PackWise (no service worker needed).
    try {
      const { desktopAdapter } = await import('./storage/desktopAdapter');
      await initSync(await desktopAdapter());
    } catch (e) {
      console.error('Desktop data file unavailable', e);
      await initSync();
    }
  } else {
    registerSW({ immediate: true });
    void requestPersistentStorage();
    await initSync();
  }
}
void start();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
