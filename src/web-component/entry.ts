// Library bundle entry. The Vite WC build (vite.wc.config.ts) treats
// this file as its single entry point: it imports the
// WorkflowEditorElement class, registers the <workflow-editor> Custom
// Element, and inlines all transitive dependencies (React, Zustand,
// Tailwind) so consumers can drop a single <script> tag without a
// build step.

import { registerWorkflowEditor } from './WorkflowEditorElement';

registerWorkflowEditor();
