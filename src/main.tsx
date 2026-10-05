import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import { App } from './App';
import { seedIfFirstRun } from './db/seed';
import { requestPersistentStorage } from './db/persist';

registerSW({ immediate: true });
void seedIfFirstRun();
void requestPersistentStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
