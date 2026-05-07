// UI store — ephemeral interaction state that should never enter the
// workflow undo/redo history or be persisted. Only subscribeWithSelector
// middleware (CLAUDE.md §4 architecture invariant): no immer, no
// devtools, no temporal, no persist.
//
// Module-level singleton via useUiStore; tests instantiate a fresh
// store per case via createUiStore() to keep cases isolated.

import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface ViewportOffset {
  x: number;
  y: number;
}

export type PanelKey = 'properties' | 'chat';

export interface UiState {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  hoveredNodeId: string | null;
  hoveredEdgeId: string | null;
  viewport: ViewportOffset;
  isConnecting: boolean;
  connectingFromNodeId: string | null;
  panels: Record<PanelKey, boolean>;

  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  hoverNode: (id: string | null) => void;
  hoverEdge: (id: string | null) => void;
  setViewport: (viewport: ViewportOffset) => void;
  panViewport: (delta: ViewportOffset) => void;
  startConnecting: (sourceNodeId: string) => void;
  finishConnecting: () => void;
  setPanelOpen: (panel: PanelKey, open: boolean) => void;
  togglePanel: (panel: PanelKey) => void;
}

const initialState: Pick<
  UiState,
  | 'selectedNodeId'
  | 'selectedEdgeId'
  | 'hoveredNodeId'
  | 'hoveredEdgeId'
  | 'viewport'
  | 'isConnecting'
  | 'connectingFromNodeId'
  | 'panels'
> = {
  selectedNodeId: null,
  selectedEdgeId: null,
  hoveredNodeId: null,
  hoveredEdgeId: null,
  viewport: { x: 0, y: 0 },
  isConnecting: false,
  connectingFromNodeId: null,
  panels: { properties: false, chat: false },
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
        set({ isConnecting: true, connectingFromNodeId: sourceNodeId });
      },
      finishConnecting: () => {
        set({ isConnecting: false, connectingFromNodeId: null });
      },

      setPanelOpen: (panel, open) => {
        set((state) => ({ panels: { ...state.panels, [panel]: open } }));
      },
      togglePanel: (panel) => {
        set((state) => ({ panels: { ...state.panels, [panel]: !state.panels[panel] } }));
      },
    })),
  );
}

export const useUiStore = createUiStore();
