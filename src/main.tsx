import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { createStores } from './state/createStores';
import { StoresProvider } from './state/StoresProvider';
import './styles/globals.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

const stores = createStores();

if (import.meta.env.DEV && typeof window !== 'undefined') {
  // Dev-only window exposure for Playwright MCP and DevTools. The
  // production build strips this branch via import.meta.env.DEV; the
  // <workflow-editor> Custom Element does NOT mount this — each
  // instance owns its stores and exposes nothing global.
  window.__floweave = stores;
}

createRoot(rootElement).render(
  <StrictMode>
    <StoresProvider {...stores}>
      <App />
    </StoresProvider>
  </StrictMode>,
);

declare global {
  interface Window {
    __floweave?: ReturnType<typeof createStores>;
  }
}
