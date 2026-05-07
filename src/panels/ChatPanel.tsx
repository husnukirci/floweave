// Chat panel — floating bottom-right card hosting the LLM chat
// experience. Subscribes to the chat store messages slice and renders
// each role with its own affordance: user (right-aligned, "You"
// label), assistant (left-aligned, optional tool-call summaries),
// system (red alert region — surfaces proxy / iteration-cap errors).
//
// The input form drives sendMessage / cancelInFlight; the input stays
// enabled during pending so focus is preserved (WCAG Tier 1). Only
// the send button is disabled while a request is in flight; a Cancel
// button surfaces alongside it for the duration of the pending state.

import { useRef, useState, type JSX } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useChatStore, type ChatMessage } from '@/state/chat/chatStore';

export function ChatPanel(): JSX.Element {
  const messages = useChatStore(useShallow((s) => s.messages));

  return (
    <aside
      aria-label="Chat"
      data-testid="chat-panel"
      className="fixed bottom-4 right-4 flex max-h-[60vh] w-96 flex-col rounded-lg border border-neutral-200 bg-white shadow-lg"
    >
      <header className="border-b border-neutral-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">Chat</h2>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Start a conversation — describe a workflow you want to build.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((m) => (
              <MessageItem key={m.id} message={m} />
            ))}
          </ul>
        )}
      </div>
      <ChatInput />
    </aside>
  );
}

function ChatInput(): JSX.Element {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const status = useChatStore((s) => s.status);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const cancelInFlight = useChatStore((s) => s.cancelInFlight);

  const isPending = status === 'pending';
  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !isPending;

  // Type inferred from <form onSubmit={...}> — explicit React types
  // (FormEvent / FormEventHandler) are flagged deprecated by
  // typescript-eslint/no-deprecated; inference avoids the complaint
  // without losing safety.
  function handleSubmit(event: { preventDefault: () => void }): void {
    event.preventDefault();
    if (!canSend) return;
    setValue('');
    // Fire and forget — chat store owns the result envelope and
    // surfaces failures as system messages in role="alert".
    void sendMessage(trimmed);
    // Restore focus so the user keeps a keyboard flow without
    // tabbing back into the input after each turn.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 border-t border-neutral-200 px-3 py-2"
    >
      <input
        ref={inputRef}
        type="text"
        aria-label="Message"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        placeholder="Describe a workflow…"
        className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
      />
      {isPending ? (
        <button
          type="button"
          onClick={cancelInFlight}
          className="shrink-0 rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100"
        >
          Cancel
        </button>
      ) : null}
      <button
        type="submit"
        disabled={!canSend}
        className="shrink-0 rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Send
      </button>
    </form>
  );
}

function MessageItem({ message }: { message: ChatMessage }): JSX.Element {
  if (message.role === 'system') {
    return (
      <li role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
        {message.content}
      </li>
    );
  }

  if (message.role === 'user') {
    return (
      <li className="flex flex-col items-end gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">You</span>
        <p className="max-w-[85%] rounded bg-blue-50 px-3 py-2 text-sm text-neutral-900">
          {message.content}
        </p>
      </li>
    );
  }

  // Assistant.
  return (
    <li className="flex flex-col items-start gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        Assistant
      </span>
      <p className="max-w-[85%] rounded bg-neutral-100 px-3 py-2 text-sm text-neutral-900">
        {message.content}
      </p>
      {message.toolCalls && message.toolCalls.length > 0 ? (
        <ul className="mt-1 flex flex-col gap-0.5 pl-2">
          {message.toolCalls.map((tc, index) => (
            <li
              // Tool calls are immutable per assistant message; index
              // key is stable here.
              key={index}
              className={`text-xs ${tc.result === 'err' ? 'text-red-700' : 'text-neutral-600'}`}
              {...(tc.result === 'err' && { 'data-testid': 'tool-call-error' })}
            >
              <span aria-hidden="true">{tc.result === 'ok' ? '✓' : '✗'}</span>{' '}
              <span className="sr-only">{tc.result === 'ok' ? 'Succeeded' : 'Failed'}:</span>{' '}
              {tc.message}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
