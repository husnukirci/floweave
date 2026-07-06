import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ChatMarkdown } from './ChatMarkdown';

describe('ChatMarkdown', () => {
  it('renders bold text as a strong element', () => {
    render(<ChatMarkdown content="a **bold** claim" />);

    expect(screen.getByText('bold').tagName).toBe('STRONG');
  });

  it('renders bullet items as list items', () => {
    render(<ChatMarkdown content={'- first step\n- second step'} />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('first step');
  });

  it('renders GFM tables as table semantics inside a scrollable wrapper', () => {
    const table = '| Step | Node |\n|---|---|\n| Start | start |';
    render(<ChatMarkdown content={table} />);

    const cell = screen.getByRole('cell', { name: 'Start' });
    expect(cell).toBeInTheDocument();
    // Wide tables must scroll within the bubble, not blow out the panel.
    expect(screen.getByRole('table').parentElement).toHaveClass('overflow-x-auto');
  });

  it('demotes headings to plain emphasized text', () => {
    render(<ChatMarkdown content="## Workflow Overview" />);

    const heading = screen.getByText('Workflow Overview');
    expect(heading.tagName).toBe('P');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('does not render raw HTML in the content as elements', () => {
    render(<ChatMarkdown content='before <img src="x" onerror="alert(1)"> after' />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('hardens links to open in a new tab without an opener', () => {
    render(<ChatMarkdown content="[docs](https://example.com)" />);

    const link = screen.getByRole('link', { name: 'docs' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
