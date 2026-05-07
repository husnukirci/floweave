// Chat panel — floating bottom-right card hosting the LLM chat
// experience. Subscribes to the chat store messages slice and renders
// each role with its own affordance: user (right-aligned, "You"
// label), assistant (left-aligned, optional tool-call summaries),
// system (red alert region — surfaces proxy / iteration-cap errors).
//
// Input plumbing (textbox, send, cancel) lands in commit 3.

import type { JSX } from 'react';
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
    </aside>
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
