// StoresProvider — per-instance React Context for the three Zustand
// stores (workflow / ui / chat). Each <workflow-editor> Custom Element
// instance creates its own stores and provides them; React components
// consume them via the typed selector hooks below (ADR-019
// multi-instance support).
//
// The Phase 7 module-level singletons (workflowStore, useUiStore,
// useChatStore) are gone. Tests and the dev SPA explicitly construct
// stores and wrap renders in <StoresProvider>.

// Hooks are co-located with the provider component because they share
// the (private) StoresContext. The colocation triggers
// react-refresh/only-export-components — Fast Refresh's intent is real,
// but the cost of split-file plumbing for state hooks that change
// rarely outweighs the HMR benefit.
/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, type JSX, type ReactNode } from 'react';
import { useStore } from 'zustand';

import type { ChatState, ChatStore } from '@/state/chat/chatStore';
import type { UiState, UiStore } from '@/state/ui/uiStore';
import type { WorkflowStore } from '@/state/workflow/factory';
import type { WorkflowStoreState } from '@/state/workflow/storeState';

export interface StoresContextValue {
  workflowStore: WorkflowStore;
  uiStore: UiStore;
  chatStore: ChatStore;
}

const StoresContext = createContext<StoresContextValue | null>(null);

export interface StoresProviderProps extends StoresContextValue {
  children?: ReactNode;
}

export function StoresProvider({
  workflowStore,
  uiStore,
  chatStore,
  children,
}: StoresProviderProps): JSX.Element {
  return (
    <StoresContext.Provider value={{ workflowStore, uiStore, chatStore }}>
      {children}
    </StoresContext.Provider>
  );
}

function useStoresContext(): StoresContextValue {
  const ctx = useContext(StoresContext);
  if (!ctx) {
    throw new Error(
      'StoresProvider missing — wrap the editor tree in <StoresProvider workflowStore={…} uiStore={…} chatStore={…}>.',
    );
  }
  return ctx;
}

// Direct store-API hooks — return the Zustand StoreApi, useful for
// imperative access (`getState()`, `setState()`, `subscribe()`) inside
// event handlers and effects. Stable per provider mount so they're
// safe to put in dependency arrays.
export function useWorkflowStoreApi(): WorkflowStore {
  return useStoresContext().workflowStore;
}

export function useUiStoreApi(): UiStore {
  return useStoresContext().uiStore;
}

export function useChatStoreApi(): ChatStore {
  return useStoresContext().chatStore;
}

// Selector hooks — subscribe a component to a slice of store state.
// Same call signature as the previous bound-store hooks, so most
// components migrate by just changing the import.
export function useWorkflowStore<T>(selector: (state: WorkflowStoreState) => T): T {
  return useStore(useWorkflowStoreApi(), selector);
}

export function useUiStore<T>(selector: (state: UiState) => T): T {
  return useStore(useUiStoreApi(), selector);
}

export function useChatStore<T>(selector: (state: ChatState) => T): T {
  return useStore(useChatStoreApi(), selector);
}
