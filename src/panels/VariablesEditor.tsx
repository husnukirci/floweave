// VariablesEditor — the variables grid inside the PropertiesPanel.
// Each row: key input · type select (string/number/boolean) · value input
// · delete button. Add Variable button appends a new empty row.
//
// Local state holds rawValue strings during edit; type-aware parsing
// happens at commit time (blur on key/value, change on type, click on
// delete). Empty-key rows are not committed — they live in local state
// until the user gives them a key.

import { Plus, Trash2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import {
  type ChangeEvent,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
  useState,
} from 'react';

import { selectNodeById } from '@/state/workflow/selectors';
import { workflowStore } from '@/state/workflow/instance';
import type { Variable } from '@/state/workflow/types';

interface VariablesEditorProps {
  nodeId: string;
}

type ValueType = 'string' | 'number' | 'boolean';

interface Row {
  uiId: string;
  key: string;
  type: ValueType;
  rawValue: string;
}

function typeOfVariable(value: Variable): ValueType {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
}

function parseValue(raw: string, type: ValueType): Variable {
  if (type === 'number') {
    const n = Number(raw);
    return Number.isNaN(n) ? 0 : n;
  }
  if (type === 'boolean') {
    const normalized = raw.trim().toLowerCase();
    return normalized === 'true' || normalized === '1';
  }
  return raw;
}

function rowsToVariables(rows: readonly Row[]): Record<string, Variable> {
  const out: Record<string, Variable> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (key === '') continue;
    out[key] = parseValue(row.rawValue, row.type);
  }
  return out;
}

export function VariablesEditor({ nodeId }: VariablesEditorProps): JSX.Element | null {
  const node = workflowStore(selectNodeById(nodeId));
  const [rows, setRows] = useState<Row[]>(() =>
    Object.entries(node?.data.variables ?? {}).map(([k, v]) => ({
      uiId: nanoid(),
      key: k,
      type: typeOfVariable(v),
      rawValue: String(v),
    })),
  );

  if (!node) return null;

  const commit = (next: readonly Row[]): void => {
    workflowStore.getState().updateNode(nodeId, {
      data: { label: node.data.label, variables: rowsToVariables(next) },
    });
  };

  const addRow = (): void => {
    setRows((prev) => [...prev, { uiId: nanoid(), key: '', type: 'string', rawValue: '' }]);
  };

  const updateRow = (uiId: string, patch: Partial<Row>): Row[] => {
    const next = rows.map((row) => (row.uiId === uiId ? { ...row, ...patch } : row));
    setRows(next);
    return next;
  };

  const handleKeyChange = (uiId: string, value: string): void => {
    updateRow(uiId, { key: value });
  };

  const handleValueChange = (uiId: string, value: string): void => {
    updateRow(uiId, { rawValue: value });
  };

  const handleTypeChange = (uiId: string, type: ValueType): void => {
    const next = updateRow(uiId, { type });
    // Type change commits immediately so the parsed value lands in the store.
    commit(next);
  };

  const handleBlur = (): void => {
    commit(rows);
  };

  const handleEnter = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(rows);
    }
  };

  const handleDelete = (uiId: string): void => {
    const next = rows.filter((row) => row.uiId !== uiId);
    setRows(next);
    commit(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, index) => (
        <div
          key={row.uiId}
          data-testid={`variable-row-${String(index)}`}
          className="flex items-center gap-1.5"
        >
          <input
            type="text"
            data-testid={`variables-key-input-${String(index)}`}
            aria-label={`Variable ${String(index + 1)} key`}
            value={row.key}
            placeholder="key"
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              handleKeyChange(row.uiId, e.target.value);
            }}
            onBlur={handleBlur}
            onKeyDown={handleEnter}
            className="w-24 min-w-0 flex-1 rounded border border-neutral-300 px-1.5 py-1 text-xs focus:border-blue-500 focus:outline-none"
          />
          <select
            data-testid={`variables-type-select-${String(index)}`}
            aria-label={`Variable ${String(index + 1)} type`}
            value={row.type}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => {
              handleTypeChange(row.uiId, e.target.value as ValueType);
            }}
            className="rounded border border-neutral-300 px-1 py-1 text-xs focus:border-blue-500 focus:outline-none"
          >
            <option value="string">str</option>
            <option value="number">num</option>
            <option value="boolean">bool</option>
          </select>
          <input
            type="text"
            data-testid={`variables-value-input-${String(index)}`}
            aria-label={`Variable ${String(index + 1)} value`}
            value={row.rawValue}
            placeholder="value"
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              handleValueChange(row.uiId, e.target.value);
            }}
            onBlur={handleBlur}
            onKeyDown={handleEnter}
            className="w-24 min-w-0 flex-1 rounded border border-neutral-300 px-1.5 py-1 text-xs focus:border-blue-500 focus:outline-none"
          />
          <button
            type="button"
            data-testid={`variables-delete-button-${String(index)}`}
            aria-label={`Delete variable ${String(index + 1)}`}
            onClick={() => {
              handleDelete(row.uiId);
            }}
            className="rounded p-1 text-neutral-500 hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ))}
      <button
        type="button"
        data-testid="variables-add-button"
        onClick={addRow}
        className="mt-1 inline-flex items-center gap-1 self-start rounded border border-dashed border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <Plus className="h-3 w-3" aria-hidden />
        Add variable
      </button>
    </div>
  );
}
