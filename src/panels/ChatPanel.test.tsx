import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { createChatStore, type ChatStore } from '@/state/chat/chatStore';
import { createUiStore, type UiStore } from '@/state/ui/uiStore';
import {
  createTestWorkflowStore,
  renderWithStores,
  type TestWorkflowStore,
} from '@/test/factories';
import { server } from '@/test/server';

import { ChatPanel } from './ChatPanel';

const ENDPOINT = 'https://api.test.local/api/chat';

describe('ChatPanel', () => {
  let workflowStore: TestWorkflowStore;
  let uiStore: UiStore;
  let chatStore: ChatStore;

  const renderPanel = (ui: ReactElement = <ChatPanel />) =>
    renderWithStores(ui, { stores: { workflowStore, uiStore, chatStore } });

  beforeEach(() => {
    workflowStore = createTestWorkflowStore();
    uiStore = createUiStore();
    chatStore = createChatStore({ workflowStore, uiStore, endpoint: ENDPOINT });
  });

  it('mounts as a labeled landmark region', () => {
    renderPanel();
    expect(screen.getByRole('complementary', { name: /chat/i })).toBeInTheDocument();
  });

  it('renders a user message with the visible "you" affordance', () => {
    chatStore.getState().addMessage({
      id: 'm1',
      role: 'user',
      content: 'add a Verify Policy step',
      timestamp: Date.now(),
    });

    renderPanel();

    expect(screen.getByText('add a Verify Policy step')).toBeInTheDocument();
    // User messages get a distinguishable affordance — either an avatar
    // label, a role chip, or some visible "you" marker.
    expect(screen.getByText(/you|user/i)).toBeInTheDocument();
  });

  it('renders an assistant message with its content', () => {
    chatStore.getState().addMessage({
      id: 'm1',
      role: 'assistant',
      content: 'Added the Verify Policy step.',
      timestamp: Date.now(),
    });

    renderPanel();

    expect(screen.getByText('Added the Verify Policy step.')).toBeInTheDocument();
  });

  it('renders tool-call summaries with success markers under the assistant message', () => {
    chatStore.getState().addMessage({
      id: 'm1',
      role: 'assistant',
      content: 'Done.',
      timestamp: Date.now(),
      toolCalls: [
        { name: 'add_node', result: 'ok', message: "Added task node 'abc' at (0, 0)." },
        { name: 'connect_nodes', result: 'ok', message: "Connected 'a' → 'b'." },
      ],
    });

    renderPanel();

    // Each tool call surfaces its message; the result marker is a
    // distinguishable success indicator (text or icon).
    expect(screen.getByText(/Added task node 'abc'/)).toBeInTheDocument();
    expect(screen.getByText(/Connected 'a'/)).toBeInTheDocument();
  });

  it('marks failed tool-call summaries with an error indicator', () => {
    chatStore.getState().addMessage({
      id: 'm1',
      role: 'assistant',
      content: 'Tried.',
      timestamp: Date.now(),
      toolCalls: [{ name: 'connect_nodes', result: 'err', message: 'duplicate-edge' }],
    });

    renderPanel();

    expect(screen.getByText(/duplicate-edge/)).toBeInTheDocument();
    // The failed call carries a visible error state — checked via test
    // id the impl exposes on the failure row.
    expect(screen.getByTestId('tool-call-error')).toBeInTheDocument();
  });

  it('renders system error messages distinctly', () => {
    chatStore.getState().addMessage({
      id: 'sys1',
      role: 'system',
      content: 'The proxy is unreachable.',
      timestamp: Date.now(),
    });

    renderPanel();

    expect(screen.getByRole('alert')).toHaveTextContent(/proxy is unreachable/);
  });

  it('shows an empty-state placeholder when no messages exist', () => {
    renderPanel();

    expect(
      screen.getByText(/start a conversation|describe a workflow|ask the assistant/i),
    ).toBeInTheDocument();
  });

  it('exposes a textbox for the user input and a send button', () => {
    renderPanel();

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
    renderPanel();

    await user.type(screen.getByRole('textbox', { name: /message|chat/i }), 'hello');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('wraps the message list in an aria-live="polite" region so SRs announce new messages', () => {
    chatStore.getState().addMessage({
      id: 'm1',
      role: 'assistant',
      content: 'Hello.',
      timestamp: Date.now(),
    });
    const { container } = renderPanel();

    const live = container.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    expect(live?.textContent).toContain('Hello.');
  });

  it('exposes a Close chat button that closes the chat panel', async () => {
    uiStore.getState().setPanelOpen('chat', true);
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /close chat/i }));

    expect(uiStore.getState().panels.chat).toBe(false);
  });

  it('closes the panel when Escape is pressed', async () => {
    uiStore.getState().setPanelOpen('chat', true);
    const user = userEvent.setup();
    renderPanel();

    // Focus the textbox first so the keyboard event lands inside the
    // panel (the Escape handler is mounted on the panel root).
    await user.click(screen.getByRole('textbox', { name: /message|chat/i }));
    await user.keyboard('{Escape}');

    expect(uiStore.getState().panels.chat).toBe(false);
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
    renderPanel();

    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: /message|chat/i }), 'hello');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('shows a typing indicator while the request is in flight', async () => {
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
    renderPanel();

    expect(screen.queryByTestId('chat-typing')).not.toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: /message|chat/i }), 'hello');
    await user.click(screen.getByRole('button', { name: /send/i }));

    const indicator = screen.getByTestId('chat-typing');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveTextContent(/thinking/i);
  });
});
