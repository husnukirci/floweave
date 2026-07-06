import { describe, expect, it } from 'vitest';

import { adoptPropertyRulesIntoDocument, extractPropertyRules } from './propertyRules';

describe('extractPropertyRules', () => {
  it('extracts a single @property rule with its full body', () => {
    const css = `
.a { color: red; }
@property --tw-border-style {
  syntax: "*";
  inherits: false;
  initial-value: solid;
}
.b { color: blue; }`;

    const rules = extractPropertyRules(css);

    expect(rules).toHaveLength(1);
    expect(rules[0]).toContain('@property --tw-border-style');
    expect(rules[0]).toContain('initial-value: solid');
  });

  it('extracts every @property rule in the sheet', () => {
    const css = `
@property --tw-shadow { syntax: "*"; inherits: false; initial-value: 0 0 #0000; }
@property --tw-ring-shadow { syntax: "*"; inherits: false; initial-value: 0 0 #0000; }
@property --tw-blur { syntax: "*"; inherits: false; }`;

    expect(extractPropertyRules(css)).toHaveLength(3);
  });

  it('returns an empty array when the sheet has no @property rules', () => {
    expect(extractPropertyRules('.a { border: 1px solid; } @media (min-width: 0) {}')).toEqual([]);
  });

  it('does not capture rules that follow an @property block', () => {
    const css = `@property --x { syntax: "*"; inherits: false; }
.after { color: red; }`;

    const rules = extractPropertyRules(css);

    expect(rules).toHaveLength(1);
    expect(rules[0]).not.toContain('.after');
  });
});

describe('adoptPropertyRulesIntoDocument', () => {
  const CSS_WITH_RULE = '@property --tw-x { syntax: "*"; inherits: false; initial-value: solid; }';

  const freshDocument = (): Document => document.implementation.createHTMLDocument();

  it('adopts one document-level stylesheet carrying the rules', () => {
    const doc = freshDocument();

    adoptPropertyRulesIntoDocument(CSS_WITH_RULE, doc);

    expect(doc.adoptedStyleSheets).toHaveLength(1);
  });

  it('is idempotent per document — repeat calls adopt nothing further', () => {
    const doc = freshDocument();

    adoptPropertyRulesIntoDocument(CSS_WITH_RULE, doc);
    adoptPropertyRulesIntoDocument(CSS_WITH_RULE, doc);

    expect(doc.adoptedStyleSheets).toHaveLength(1);
  });

  it('adopts nothing when the css has no @property rules', () => {
    const doc = freshDocument();

    adoptPropertyRulesIntoDocument('.a { color: red; }', doc);

    expect(doc.adoptedStyleSheets).toHaveLength(0);
  });

  it('preserves stylesheets the host page already adopted', () => {
    const doc = freshDocument();
    const hostSheet = new CSSStyleSheet();
    doc.adoptedStyleSheets = [hostSheet];

    adoptPropertyRulesIntoDocument(CSS_WITH_RULE, doc);

    expect(doc.adoptedStyleSheets).toHaveLength(2);
    expect(doc.adoptedStyleSheets[0]).toBe(hostSheet);
  });
});
