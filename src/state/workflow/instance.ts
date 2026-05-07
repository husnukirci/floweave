// Phase 2 → Phase 7 expediency. The full Web Component instance model
// (ADR-019) puts the workflow store on a React Context provided by
// each <workflow-editor> mount. Until that lands in Phase 8, the
// canvas/panels components import this singleton directly.
//
// When Phase 8 refactors to Context, this file goes away — every
// `import { workflowStore } from '@/state/workflow/instance'` becomes
// `useWorkflowStore` (a hook that reads from Context).

import { createWorkflowStore } from './factory';

export const workflowStore = createWorkflowStore({ name: 'floweave-workflow' });

declare global {
  interface Window {
    __floweave?: {
      workflowStore: typeof workflowStore;
    };
  }
}

// Dev-only window exposure for Playwright MCP and DevTools. Production
// build strips this branch via import.meta.env.DEV.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__floweave = { workflowStore };
}
