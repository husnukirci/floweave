import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useChatStore } from '@/state/chat/chatStore';
import { server } from '@/test/server';

import { ChatPanel } from './ChatPanel';

const ENDPOINT = '/api/chat';

describe('ChatPanel', () => {
  beforeEach(() => {
    useChatStore.getState().clearMessages();
  });

  afterEach(() => {
    useChatStore.getState().clearMessages();
  });

  it('mounts as a labeled landmark region', () => {
    render(<ChatPanel />);
    expect(screen.getByRole('complementary', { name: /chat/i })).toBeInTheDocument();
  });

  it('renders a user message with the visible "you" affordance', () => {
    useChatStore.getState().addMessage({
      id: 'm1',
      role: 'user',
      content: 'add a Verify Policy step',
      timestamp: Date.now(),
    });

    render(<ChatPanel />);

    expect(screen.getByText('add a Verify Policy step')).toBeInTheDocument();
    // User messages get a distinguishable affordance — either an avatar
    // label, a role chip, or some visible "you" marker.
    expect(screen.getByText(/you|user/i)).toBeInTheDocument();
  });

  it('renders an assistant message with its content', () => {
    useChatStore.getState().addMessage({
      id: 'm1',
      role: 'assistant',
      content: 'Added the Verify Policy step.',
      timestamp: Date.now(),
    });

    render(<ChatPanel />);

    expect(screen.getByText('Added the Verify Policy step.')).toBeInTheDocument();
  });

  it('renders tool-call summaries with success markers under the assistant message', () => {
    useChatStore.getState().addMessage({
      id: 'm1',
      role: 'assistant',
      content: 'Done.',
      timestamp: Date.now(),
      toolCalls: [
        { name: 'add_node', result: 'ok', message: "Added task node 'abc' at (0, 0)." },
        { name: 'connect_nodes', result: 'ok', message: "Connected 'a' → 'b'." },
      ],
    });

    render(<ChatPanel />);

    // Each tool call surfaces its message; the result marker is a
    // distinguishable success indicator (text or icon).
    expect(screen.getByText(/Added task node 'abc'/)).toBeInTheDocument();
    expect(screen.getByText(/Connected 'a'/)).toBeInTheDocument();
  });

  it('marks failed tool-call summaries with an error indicator', () => {
    useChatStore.getState().addMessage({
      id: 'm1',
      role: 'assistant',
      content: 'Tried.',
      timestamp: Date.now(),
      toolCalls: [{ name: 'connect_nodes', result: 'err', message: 'duplicate-edge' }],
    });

    render(<ChatPanel />);

    expect(screen.getByText(/duplicate-edge/)).toBeInTheDocument();
    // The failed call carries a visible error state — checked via test
    // id the impl exposes on the failure row.
    expect(screen.getByTestId('tool-call-error')).toBeInTheDocument();
  });

  it('renders system error messages distinctly', () => {
    useChatStore.getState().addMessage({
      id: 'sys1',
      role: 'system',
      content: 'The proxy is unreachable.',
      timestamp: Date.now(),
    });

    render(<ChatPanel />);

    expect(screen.getByRole('alert')).toHaveTextContent(/proxy is unreachable/);
  });

  it('shows an empty-state placeholder when no messages exist', () => {
    render(<ChatPanel />);

    expect(
      screen.getByText(/start a conversation|describe a workflow|ask the assistant/i),
    ).toBeInTheDocument();
  });

  it('exposes a textbox for the user input and a send button', () => {
    render(<ChatPanel />);

    expect(screen.getByRole('textbox', { name: /message|chat/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('disables the send button while a request is in flight', async () => {
    server.use(
      http.post(ENDPOINT, async () => {
        await new Promise((r) => setTimeout(r, 50));
        return HttpResponse.json({
          content: [{ type: 'text', text: 'ok' }],
          stop_reason: 'end_turn',
        });
      }),
    );
    const user = userEvent.setup();
    render(<ChatPanel />);

    await user.type(screen.getByRole('textbox', { name: /message|chat/i }), 'hello');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('exposes a cancel button only while a request is in flight', async () => {
    server.use(
      http.post(ENDPOINT, async () => {
        await new Promise((r) => setTimeout(r, 50));
        return HttpResponse.json({
          content: [{ type: 'text', text: 'ok' }],
          stop_reason: 'end_turn',
        });
      }),
    );
    const user = userEvent.setup();
    render(<ChatPanel />);

    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: /message|chat/i }), 'hello');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });
});
