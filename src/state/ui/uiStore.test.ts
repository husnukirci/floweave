import { beforeEach, describe, expect, it } from 'vitest';

import { createUiStore, type UiStore } from './uiStore';

describe('uiStore', () => {
  let store: UiStore;

  beforeEach(() => {
    store = createUiStore();
  });

  it('starts with no selection, no hover, viewport at origin, both panels closed', () => {
    const state = store.getState();
    expect(state.selectedNodeId).toBeNull();
    expect(state.selectedEdgeId).toBeNull();
    expect(state.hoveredNodeId).toBeNull();
    expect(state.hoveredEdgeId).toBeNull();
    expect(state.viewport).toEqual({ x: 0, y: 0 });
    expect(state.isConnecting).toBe(false);
    expect(state.panels).toEqual({ properties: false, chat: false });
  });

  describe('selection', () => {
    it('selectNode clears any selected edge', () => {
      store.getState().selectEdge('e1');
      store.getState().selectNode('n1');

      expect(store.getState().selectedNodeId).toBe('n1');
      expect(store.getState().selectedEdgeId).toBeNull();
    });

    it('selectEdge clears any selected node', () => {
      store.getState().selectNode('n1');
      store.getState().selectEdge('e1');

      expect(store.getState().selectedEdgeId).toBe('e1');
      expect(store.getState().selectedNodeId).toBeNull();
    });

    it('passing null clears the selection', () => {
      store.getState().selectNode('n1');
      store.getState().selectNode(null);
      expect(store.getState().selectedNodeId).toBeNull();
    });
  });

  describe('hover', () => {
    it('hoverNode and hoverEdge are independent', () => {
      store.getState().hoverNode('n1');
      store.getState().hoverEdge('e1');
      expect(store.getState().hoveredNodeId).toBe('n1');
      expect(store.getState().hoveredEdgeId).toBe('e1');
    });
  });

  describe('viewport', () => {
    it('setViewport replaces the offset', () => {
      store.getState().setViewport({ x: 100, y: 200 });
      expect(store.getState().viewport).toEqual({ x: 100, y: 200 });
    });

    it('panViewport adds the delta', () => {
      store.getState().setViewport({ x: 10, y: 20 });
      store.getState().panViewport({ x: 5, y: -3 });
      expect(store.getState().viewport).toEqual({ x: 15, y: 17 });
    });
  });

  describe('connecting', () => {
    it('startConnecting sets isConnecting and source', () => {
      store.getState().startConnecting('source-id');
      expect(store.getState().isConnecting).toBe(true);
      expect(store.getState().connectingFromNodeId).toBe('source-id');
    });

    it('finishConnecting clears the in-progress state', () => {
      store.getState().startConnecting('source-id');
      store.getState().finishConnecting();
      expect(store.getState().isConnecting).toBe(false);
      expect(store.getState().connectingFromNodeId).toBeNull();
    });
  });

  describe('panels', () => {
    it('setPanelOpen sets a single panel without affecting others', () => {
      store.getState().setPanelOpen('chat', true);
      expect(store.getState().panels).toEqual({ properties: false, chat: true });
    });

    it('togglePanel flips the boolean', () => {
      store.getState().togglePanel('properties');
      expect(store.getState().panels.properties).toBe(true);
      store.getState().togglePanel('properties');
      expect(store.getState().panels.properties).toBe(false);
    });
  });
});
