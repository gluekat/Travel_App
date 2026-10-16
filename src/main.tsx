import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import { App } from './App';
import { seedIfFirstRun } from './db/seed';
import { requestPersistentStorage } from './db/persist';
import { initSync } from './storage/fileSync';

registerSW({ immediate: true });
void seedIfFirstRun();
void requestPersistentStorage();
void initSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
