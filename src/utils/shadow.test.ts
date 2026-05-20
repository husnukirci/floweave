// Shadow DOM helper tests. Hit-testing primitives (elementFromPoint)
// are not faithfully implemented in happy-dom, so getDeepElementFromPoint
// is exercised via stubbed elementFromPoint on document and shadow roots
// — that's the same surface the real browsers expose, and what the
// helper actually depends on.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { getDeepActiveElement, getDeepElementFromPoint } from './shadow';

describe('getDeepActiveElement', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns document.activeElement when no shadow root is involved', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    expect(getDeepActiveElement()).toBe(input);
  });

  it('walks into a shadow root to find the real active element', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    root.appendChild(input);
    input.focus();

    expect(getDeepActiveElement()).toBe(input);
  });

  it('walks into nested shadow roots', () => {
    const outer = document.createElement('div');
    document.body.appendChild(outer);
    const outerRoot = outer.attachShadow({ mode: 'open' });
    const inner = document.createElement('div');
    outerRoot.appendChild(inner);
    const innerRoot = inner.attachShadow({ mode: 'open' });
    const button = document.createElement('button');
    innerRoot.appendChild(button);
    button.focus();

    expect(getDeepActiveElement()).toBe(button);
  });
});

describe('getDeepElementFromPoint', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-dom does not implement ShadowRoot.elementFromPoint, so attach
  // a stub before spying. Reset after each test.
  function attachShadowRoot(host: Element, returns: Element | null): ShadowRoot {
    const root = host.attachShadow({ mode: 'open' });
    Object.defineProperty(root, 'elementFromPoint', {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue(returns),
    });
    return root;
  }

  it('returns the result of document.elementFromPoint when no shadow root is present', () => {
    const div = document.createElement('div');
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(div);

    expect(getDeepElementFromPoint(10, 20)).toBe(div);
  });

  it('pierces a shadow root when the topmost element is a host', () => {
    const host = document.createElement('div');
    const inner = document.createElement('span');
    attachShadowRoot(host, inner);

    vi.spyOn(document, 'elementFromPoint').mockReturnValue(host);

    expect(getDeepElementFromPoint(0, 0)).toBe(inner);
  });

  it('pierces nested shadow roots', () => {
    const outer = document.createElement('div');
    const middle = document.createElement('div');
    const leaf = document.createElement('span');
    attachShadowRoot(outer, middle);
    attachShadowRoot(middle, leaf);

    vi.spyOn(document, 'elementFromPoint').mockReturnValue(outer);

    expect(getDeepElementFromPoint(0, 0)).toBe(leaf);
  });

  it('stops recursing when the shadow root returns null', () => {
    const host = document.createElement('div');
    attachShadowRoot(host, null);

    vi.spyOn(document, 'elementFromPoint').mockReturnValue(host);

    expect(getDeepElementFromPoint(0, 0)).toBe(host);
  });

  it('stops recursing when the shadow root returns the host itself', () => {
    // Defensive: an implementation could return the host again, which
    // would otherwise spin forever.
    const host = document.createElement('div');
    attachShadowRoot(host, host);

    vi.spyOn(document, 'elementFromPoint').mockReturnValue(host);

    expect(getDeepElementFromPoint(0, 0)).toBe(host);
  });

  it('returns null when document.elementFromPoint returns null', () => {
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(null);

    expect(getDeepElementFromPoint(0, 0)).toBeNull();
  });
});
