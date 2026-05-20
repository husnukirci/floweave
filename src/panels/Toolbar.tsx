// Toolbar — top bar with the Add Node menu and IO controls (Import,
// Export, Clear). Mounted by App above the Canvas.
//
// The Add menu is a controlled disclosure with click-outside dismissal.
// Keyboard navigation (arrow keys, Escape, Tab) lands in commit 2 along
// with full ARIA role mapping per CLAUDE.md §4 accessibility invariant.

import {
  ChevronDown,
  Download,
  MessageSquare,
  Plus,
  Trash2,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import {
  type ChangeEvent,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import { CUSTOM_NODE_REGISTRY } from '@/nodes/registry';
import { useUiStore, useUiStoreApi, useWorkflowStoreApi } from '@/state/StoresProvider';
import type { CustomNodeType } from '@/state/workflow/types';

type BasicKind = 'start' | 'task' | 'end';

const BASIC_KINDS: readonly { kind: BasicKind; label: string }[] = [
  { kind: 'start', label: 'Start' },
  { kind: 'task', label: 'Task' },
  { kind: 'end', label: 'End' },
];

const NODE_HALF_WIDTH = 70;
const NODE_HALF_HEIGHT = 28;

// World-coordinate position for a freshly added node — center of the
// visible canvas with a small per-add cascade so multiple adds do not
// stack. Stores are passed in (rather than imported) because Toolbar
// is mounted inside a per-instance StoresProvider.
function defaultPosition(
  viewport: { x: number; y: number },
  nodeCount: number,
): { x: number; y: number } {
  const root = document.querySelector('[role="application"]');
  const rect = root?.getBoundingClientRect();
  const cx = rect ? rect.width / 2 : 400;
  const cy = rect ? rect.height / 2 : 300;
  const cascade = (nodeCount % 8) * 32;
  return {
    x: Math.round(cx - viewport.x - NODE_HALF_WIDTH + cascade),
    y: Math.round(cy - viewport.y - NODE_HALF_HEIGHT + cascade),
  };
}

export function Toolbar(): JSX.Element {
  const [addOpen, setAddOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const menuItemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Outside-click dismissal — only attached while the menu is open.
  // event.target on document is retargeted to the shadow host when the
  // event originates inside Shadow DOM (i.e. inside <workflow-editor>),
  // so `container.contains(event.target)` would always be false from
  // inside the shadow tree and the menu would close on its own
  // menuitems. Use composedPath() instead — it pierces shadow roots.
  useEffect(() => {
    if (!addOpen) return undefined;
    const handler = (event: MouseEvent): void => {
      const container = menuContainerRef.current;
      if (!container) return;
      if (!event.composedPath().includes(container)) {
        setAddOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
    };
  }, [addOpen]);

  // When the menu opens, focus the first item so keyboard users can
  // immediately navigate. When it closes, return focus to the trigger.
  useEffect(() => {
    if (addOpen) {
      menuItemRefs.current[0]?.focus();
    }
  }, [addOpen]);

  const closeMenu = (returnFocus: boolean): void => {
    setAddOpen(false);
    if (returnFocus) {
      addButtonRef.current?.focus();
    }
  };

  const focusItemAt = (index: number): void => {
    const items = menuItemRefs.current.filter((el): el is HTMLButtonElement => el !== null);
    if (items.length === 0) return;
    const wrapped = ((index % items.length) + items.length) % items.length;
    items[wrapped]?.focus();
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key === 'Tab') {
      // Tabbing out closes the menu (focus naturally moves to next form
      // control, then back to the trigger via shift-tab).
      closeMenu(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const items = menuItemRefs.current.filter((el): el is HTMLButtonElement => el !== null);
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      focusItemAt(current === -1 ? 0 : current + offset);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      focusItemAt(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      const items = menuItemRefs.current.filter((el) => el !== null);
      focusItemAt(items.length - 1);
    }
  };

  const handleAddButtonKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>): void => {
    if ((event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') && !addOpen) {
      // Open and focus first item on ArrowDown / Enter / Space.
      // Enter/Space will also fire onClick which toggles addOpen — preventDefault
      // for ArrowDown only; for Enter/Space the click handler covers it.
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setAddOpen(true);
      }
    }
  };

  const workflowStoreApi = useWorkflowStoreApi();
  const uiStoreApi = useUiStoreApi();

  const positionForNewNode = (): { x: number; y: number } => {
    const viewport = uiStoreApi.getState().viewport;
    const nodeCount = Object.keys(workflowStoreApi.getState().nodes).length;
    return defaultPosition(viewport, nodeCount);
  };

  const addBasic = (kind: BasicKind): void => {
    workflowStoreApi.getState().addNode({ kind, position: positionForNewNode() });
    setAddOpen(false);
  };

  const addCustom = (customType: CustomNodeType): void => {
    const label = CUSTOM_NODE_REGISTRY[customType].label;
    workflowStoreApi.getState().addNode({
      kind: 'custom',
      customType,
      position: positionForNewNode(),
      data: { label },
    });
    setAddOpen(false);
  };

  const handleImportClick = (): void => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = workflowStoreApi.getState().importJSON(text);
    if (!result.ok) {
      uiStoreApi.getState().setNotification({
        code: result.error.code,
        message: friendlyImportError(result.error.code),
      });
    }
    // Reset so re-selecting the same file re-imports.
    event.target.value = '';
  };

  const handleExport = (): void => {
    const json = workflowStoreApi.getState().exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `floweave-workflow-${String(Date.now())}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleClear = (): void => {
    if (!window.confirm('Clear the workflow? All nodes and edges will be removed.')) {
      return;
    }
    workflowStoreApi.getState().clear();
  };

  const chatOpen = useUiStore((s) => s.panels.chat);
  const handleToggleChat = (): void => {
    uiStoreApi.getState().togglePanel('chat');
  };

  return (
    <div
      role="toolbar"
      aria-label="Workflow editor toolbar"
      className="flex items-center gap-1 border-b border-neutral-200 bg-white px-3 py-2 text-sm"
    >
      <div className="relative" ref={menuContainerRef}>
        <ToolbarButton
          icon={Plus}
          ref={addButtonRef}
          onClick={() => {
            setAddOpen((open) => !open);
          }}
          onKeyDown={handleAddButtonKeyDown}
          aria-haspopup="menu"
          aria-expanded={addOpen}
          data-testid="toolbar-add-button"
        >
          Add Node
          <ChevronDown className="h-3 w-3" aria-hidden />
        </ToolbarButton>
        {addOpen ? (
          <AddMenu
            onAddBasic={addBasic}
            onAddCustom={addCustom}
            onKeyDown={handleMenuKeyDown}
            itemRefs={menuItemRefs}
          />
        ) : null}
      </div>

      <div className="flex-1" />

      <ToolbarButton icon={Upload} onClick={handleImportClick} data-testid="toolbar-import-button">
        Import
      </ToolbarButton>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,application/JSON,.json"
        onChange={(event) => {
          void handleImportFile(event);
        }}
        className="hidden"
        data-testid="toolbar-import-input"
        aria-hidden
      />

      <ToolbarButton icon={Download} onClick={handleExport} data-testid="toolbar-export-button">
        Export
      </ToolbarButton>

      <ToolbarButton icon={Trash2} onClick={handleClear} data-testid="toolbar-clear-button">
        Clear
      </ToolbarButton>

      <ToolbarButton
        icon={MessageSquare}
        onClick={handleToggleChat}
        data-testid="toolbar-chat-button"
        aria-pressed={chatOpen}
      >
        Chat
      </ToolbarButton>
    </div>
  );
}

interface ToolbarButtonProps {
  icon: LucideIcon;
  onClick: () => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
  'aria-haspopup'?: 'menu';
  'aria-expanded'?: boolean;
  'data-testid'?: string;
}

function ToolbarButton({
  icon: Icon,
  onClick,
  onKeyDown,
  children,
  ref,
  ...rest
}: ToolbarButtonProps): JSX.Element {
  return (
    <button
      type="button"
      ref={ref}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-neutral-700 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      {...rest}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {children}
    </button>
  );
}

interface AddMenuProps {
  onAddBasic: (kind: BasicKind) => void;
  onAddCustom: (customType: CustomNodeType) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  itemRefs: React.RefObject<(HTMLButtonElement | null)[]>;
}

function AddMenu({ onAddBasic, onAddCustom, onKeyDown, itemRefs }: AddMenuProps): JSX.Element {
  return (
    <div
      role="menu"
      tabIndex={-1}
      aria-orientation="vertical"
      data-testid="toolbar-add-menu"
      onKeyDown={onKeyDown}
      className="absolute left-0 top-full z-20 mt-1 min-w-[220px] rounded-md border border-neutral-200 bg-white p-1 shadow-lg"
    >
      <MenuSection label="Basic">
        {BASIC_KINDS.map(({ kind, label }, i) => (
          <MenuItem
            key={kind}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            data-testid={`toolbar-add-${kind}`}
            onClick={() => {
              onAddBasic(kind);
            }}
          >
            <span className="inline-block h-3 w-3 rounded-full bg-neutral-300" aria-hidden />
            {label}
          </MenuItem>
        ))}
      </MenuSection>
      <MenuSection label="Insurance">
        {Object.entries(CUSTOM_NODE_REGISTRY).map(([type, spec], i) => {
          const customType = type as CustomNodeType;
          const Icon = spec.icon;
          const refIndex = BASIC_KINDS.length + i;
          return (
            <MenuItem
              key={type}
              ref={(el) => {
                itemRefs.current[refIndex] = el;
              }}
              data-testid={`toolbar-add-${type}`}
              onClick={() => {
                onAddCustom(customType);
              }}
            >
              <Icon className={`h-4 w-4 ${spec.iconClass}`} aria-hidden />
              {spec.label}
            </MenuItem>
          );
        })}
      </MenuSection>
    </div>
  );
}

interface MenuSectionProps {
  label: string;
  children: React.ReactNode;
}

function MenuSection({ label, children }: MenuSectionProps): JSX.Element {
  return (
    <div>
      <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

interface MenuItemProps {
  onClick: () => void;
  children: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
  'data-testid'?: string;
}

function MenuItem({ onClick, children, ref, ...rest }: MenuItemProps): JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      ref={ref}
      onClick={onClick}
      className="flex items-center gap-2 rounded px-3 py-1.5 text-left text-sm text-neutral-800 hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-none focus-visible:bg-neutral-100"
      {...rest}
    >
      {children}
    </button>
  );
}

function friendlyImportError(code: string): string {
  if (code === 'INVALID_JSON') return "That file isn't valid JSON.";
  if (code === 'SCHEMA_INVALID') return "That file isn't a valid floweave workflow.";
  return 'Import failed.';
}
