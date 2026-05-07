// UI store — ephemeral interaction state that should never enter the
// workflow undo/redo history or be persisted. Only subscribeWithSelector
// middleware (CLAUDE.md §4 architecture invariant): no immer, no
// devtools, no temporal, no persist.
//
// Per-instance via createUiStore(); each <workflow-editor> Custom
// Element provides its own store through StoresProvider (ADR-019).

import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface ViewportOffset {
  x: number;
  y: number;
}

export type PanelKey = 'properties' | 'chat';

export interface UiNotification {
  message: string;
  /** Optional code (e.g. 'CANNOT_CONNECT') for tests + analytics. */
  code?: string;
}

export interface UiState {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  hoveredNodeId: string | null;
  hoveredEdgeId: string | null;
  viewport: ViewportOffset;
  isConnecting: boolean;
  connectingFromNodeId: string | null;
  /** Live cursor position in world coordinates during a connection drag. */
  connectingCursor: ViewportOffset | null;
  panels: Record<PanelKey, boolean>;
  /** Transient user-facing notification (e.g. validation failure). */
  notification: UiNotification | null;
  /**
   * IDs of nodes flagged for the AI-added pulse highlight. Each entry
   * clears itself via setTimeout after PULSE_DURATION_MS, so the canvas
   * pulse animation matches the CSS keyframe duration with no manual
   * cleanup at the call site.
   */
  recentlyAddedNodeIds: ReadonlySet<string>;

  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  hoverNode: (id: string | null) => void;
  hoverEdge: (id: string | null) => void;
  setViewport: (viewport: ViewportOffset) => void;
  panViewport: (delta: ViewportOffset) => void;
  startConnecting: (sourceNodeId: string) => void;
  updateConnectingCursor: (cursor: ViewportOffset) => void;
  finishConnecting: () => void;
  setPanelOpen: (panel: PanelKey, open: boolean) => void;
  togglePanel: (panel: PanelKey) => void;
  setNotification: (notification: UiNotification | null) => void;
  /**
   * Mark a batch of node ids as recently added (LLM-driven add_node /
   * insert_between). Each id is auto-cleared after the duration so the
   * pulse highlight in Node.tsx fades on its own.
   */
  markRecentlyAdded: (ids: readonly string[], options?: { durationMs?: number }) => void;
}

export const PULSE_DURATION_MS = 1200;

const initialState: Pick<
  UiState,
  | 'selectedNodeId'
  | 'selectedEdgeId'
  | 'hoveredNodeId'
  | 'hoveredEdgeId'
  | 'viewport'
  | 'isConnecting'
  | 'connectingFromNodeId'
  | 'connectingCursor'
  | 'panels'
  | 'notification'
  | 'recentlyAddedNodeIds'
> = {
  selectedNodeId: null,
  selectedEdgeId: null,
  hoveredNodeId: null,
  hoveredEdgeId: null,
  viewport: { x: 0, y: 0 },
  isConnecting: false,
  connectingFromNodeId: null,
  connectingCursor: null,
  panels: { properties: false, chat: false },
  notification: null,
  recentlyAddedNodeIds: new Set<string>(),
};

export type UiStore = UseBoundStore<StoreApi<UiState>>;

export function createUiStore(): UiStore {
  return create<UiState>()(
    subscribeWithSelector((set) => ({
      ...initialState,

      // Selecting a node clears any selected edge (and vice versa) so
      // the properties panel always reflects exactly one selection.
      selectNode: (id) => {
        set({ selectedNodeId: id, selectedEdgeId: null });
      },
      selectEdge: (id) => {
        set({ selectedEdgeId: id, selectedNodeId: null });
      },

      hoverNode: (id) => {
        set({ hoveredNodeId: id });
      },
      hoverEdge: (id) => {
        set({ hoveredEdgeId: id });
      },

      setViewport: (viewport) => {
        set({ viewport });
      },
      panViewport: ({ x, y }) => {
        set((state) => ({ viewport: { x: state.viewport.x + x, y: state.viewport.y + y } }));
      },

      startConnecting: (sourceNodeId) => {
        set({ isConnecting: true, connectingFromNodeId: sourceNodeId, connectingCursor: null });
      },
      updateConnectingCursor: (cursor) => {
        set({ connectingCursor: cursor });
      },
      finishConnecting: () => {
        set({ isConnecting: false, connectingFromNodeId: null, connectingCursor: null });
      },

      setPanelOpen: (panel, open) => {
        set((state) => ({ panels: { ...state.panels, [panel]: open } }));
      },
      togglePanel: (panel) => {
        set((state) => ({ panels: { ...state.panels, [panel]: !state.panels[panel] } }));
      },

      setNotification: (notification) => {
        set({ notification });
      },

      markRecentlyAdded: (ids, options) => {
        const duration = options?.durationMs ?? PULSE_DURATION_MS;
        if (ids.length === 0) return;
        set((state) => {
          const next = new Set(state.recentlyAddedNodeIds);
          for (const id of ids) next.add(id);
          return { recentlyAddedNodeIds: next };
        });
        // Each id schedules its own clearance so a later batch on a
        // different node doesn't reset earlier timers. setTimeout's
        // ordering guarantee per-id is sufficient for the visual cue.
        for (const id of ids) {
          setTimeout(() => {
            set((state) => {
              if (!state.recentlyAddedNodeIds.has(id)) return state;
              const next = new Set(state.recentlyAddedNodeIds);
              next.delete(id);
              return { recentlyAddedNodeIds: next };
            });
          }, duration);
        }
      },
    })),
  );
}
