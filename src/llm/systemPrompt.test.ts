import { describe, expect, it } from 'vitest';

import { buildSystemPrompt } from './systemPrompt';
import { buildEdge, buildNode, buildWorkflow } from '@/test/factories';

describe('buildSystemPrompt', () => {
  it('wraps the workflow state in <workflow_state> delimiter tags', () => {
    const state = buildWorkflow();
    const prompt = buildSystemPrompt(state);

    expect(prompt).toMatch(/<workflow_state>[\s\S]*<\/workflow_state>/);
  });

  it('includes the data-not-instructions mitigation', () => {
    const prompt = buildSystemPrompt(buildWorkflow());

    expect(prompt.toLowerCase()).toContain('data, not instructions');
  });

  it('serializes the actual workflow state into the delimited block', () => {
    const a = buildNode({ id: 'a', kind: 'task' });
    const b = buildNode({ id: 'b', kind: 'task' });
    const e = buildEdge({ id: 'e1', source: 'a', target: 'b' });
    const state = buildWorkflow({ nodes: { a, b }, edges: { e1: e } });

    const prompt = buildSystemPrompt(state);
    const match = /<workflow_state>([\s\S]*?)<\/workflow_state>/.exec(prompt);
    expect(match).not.toBeNull();
    if (!match) return;
    const parsed = JSON.parse(match[1]?.trim() ?? '{}') as { nodes: object; edges: object };
    expect(parsed.nodes).toEqual({ a, b });
    expect(parsed.edges).toEqual({ e1: e });
  });

  it('mentions the four connection rules', () => {
    const prompt = buildSystemPrompt(buildWorkflow());

    expect(prompt.toLowerCase()).toContain('cannot connect to itself');
    expect(prompt.toLowerCase()).toContain('most one edge');
    expect(prompt.toLowerCase()).toContain('start nodes cannot receive');
    expect(prompt.toLowerCase()).toContain('end nodes cannot have outgoing');
  });

  it('includes the narrow-panel response-style guideline', () => {
    const prompt = buildSystemPrompt(buildWorkflow());

    expect(prompt.toLowerCase()).toContain('narrow chat panel');
    expect(prompt.toLowerCase()).toContain('avoid wide tables');
  });

  it('lists the 9 insurance custom node types', () => {
    const prompt = buildSystemPrompt(buildWorkflow());

    for (const customType of [
      'createAccount',
      'createPolicy',
      'createDocument',
      'sendEmail',
      'verifyPolicy',
      'assessDamage',
      'calculatePayout',
      'approveClaim',
      'denyClaim',
    ]) {
      expect(prompt).toContain(customType);
    }
  });
});
