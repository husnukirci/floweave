import { describe, expect, it } from 'vitest';

import { CUSTOM_NODE_REGISTRY } from './registry';
import type { CustomNodeType } from '@/state/workflow/types';

const ALL_CUSTOM_TYPES: readonly CustomNodeType[] = [
  'createAccount',
  'createPolicy',
  'createDocument',
  'sendEmail',
  'verifyPolicy',
  'assessDamage',
  'calculatePayout',
  'approveClaim',
  'denyClaim',
];

describe('CUSTOM_NODE_REGISTRY', () => {
  it('has an entry for every CustomNodeType', () => {
    for (const type of ALL_CUSTOM_TYPES) {
      const spec = CUSTOM_NODE_REGISTRY[type];
      expect(spec, `missing entry for ${type}`).toBeDefined();
    }
    expect(Object.keys(CUSTOM_NODE_REGISTRY).sort()).toEqual([...ALL_CUSTOM_TYPES].sort());
  });

  it('every entry has a non-empty label and an icon', () => {
    for (const type of ALL_CUSTOM_TYPES) {
      const spec = CUSTOM_NODE_REGISTRY[type];
      expect(spec.label.length).toBeGreaterThan(0);
      expect(spec.icon).toBeDefined();
    }
  });

  it('every entry carries border, bg, text, and icon Tailwind classes', () => {
    for (const type of ALL_CUSTOM_TYPES) {
      const spec = CUSTOM_NODE_REGISTRY[type];
      expect(spec.borderClass).toMatch(/^border-/);
      expect(spec.bgClass).toMatch(/^bg-/);
      expect(spec.textClass).toMatch(/^text-/);
      expect(spec.iconClass).toMatch(/^text-/);
    }
  });
});
