// @property rule extraction for the Shadow DOM stylesheet workaround.
//
// Tailwind v4 gives its internal --tw-* variables their initial values
// via @property rules (e.g. --tw-border-style: solid). Per the CSS
// spec, custom-property registration only takes effect from *document*
// stylesheets — @property rules inside a sheet adopted by a shadow
// root are silently ignored. Without those initial values the
// border/shadow/ring utilities collapse to none inside the Web
// Component. The element extracts these rules and registers them at
// document level (see WorkflowEditorElement).
//
// @property bodies contain no nested braces, so a non-greedy regex is
// sufficient and avoids depending on CSSOM parsing (which test DOMs
// don't implement for CSSPropertyRule).

const PROPERTY_RULE_PATTERN = /@property\s+--[\w-]+\s*\{[^}]*\}/g;

/** Returns every top-level `@property` rule found in the CSS text. */
export function extractPropertyRules(css: string): string[] {
  return css.match(PROPERTY_RULE_PATTERN) ?? [];
}

// One registration per document. @property registration is page-global
// metadata, so a second editor instance (or a repeat connect) must not
// stack duplicate sheets onto the host page.
const adoptedDocuments = new WeakSet<Document>();

/**
 * Registers the CSS text's `@property` rules at document level, once
 * per document. Appends to `adoptedStyleSheets` so host-page sheets are
 * preserved. Registration only carries variable metadata (--tw-*
 * namespace) — no selectors, so nothing can restyle the host page.
 */
export function adoptPropertyRulesIntoDocument(css: string, doc: Document = document): void {
  if (adoptedDocuments.has(doc)) return;
  adoptedDocuments.add(doc);

  const rules = extractPropertyRules(css);
  if (rules.length === 0) return;

  const sheet = new CSSStyleSheet();
  sheet.replaceSync(rules.join('\n'));
  doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
}
