import { describe, expect, it } from 'vitest';

import { TOOL_SCHEMAS, type ToolName } from './tools';

describe('TOOL_SCHEMAS', () => {
  it('exports a schema for each of the five atomic tools (ADR-009)', () => {
    const expectedNames: ToolName[] = [
      'add_node',
      'connect_nodes',
      'update_node',
      'remove_node',
      'insert_between',
    ];

    for (const name of expectedNames) {
      const schema = TOOL_SCHEMAS.find((s) => s.name === name);
      expect(schema, `missing schema for ${name}`).toBeDefined();
    }
    expect(TOOL_SCHEMAS).toHaveLength(expectedNames.length);
  });

  it('every schema has a non-empty description and a valid input_schema shape', () => {
    for (const schema of TOOL_SCHEMAS) {
      expect(schema.description.length).toBeGreaterThan(20);
      expect(schema.input_schema.type).toBe('object');
      expect(typeof schema.input_schema.properties).toBe('object');
    }
  });

  it('add_node schema requires kind and position', () => {
    const addNode = TOOL_SCHEMAS.find((s) => s.name === 'add_node');
    expect(addNode?.input_schema.required).toEqual(expect.arrayContaining(['kind', 'position']));
  });

  it('insert_between schema disallows start and end as the new node kind', () => {
    const insertBetween = TOOL_SCHEMAS.find((s) => s.name === 'insert_between');
    const kindProp = insertBetween?.input_schema.properties.kind as { enum?: string[] } | undefined;
    expect(kindProp?.enum).toEqual(['task', 'custom']);
  });
});
