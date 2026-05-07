// Chat panel — floating bottom-right card hosting the LLM chat
// experience. Consumes the chat store (messages, status, error) and
// drives sendMessage / cancelInFlight via its actions.
//
// This file is the Phase 7 commit-1 stub. The rendering and
// interaction implementation lands in commit 2 (message list +
// rendering) and commit 3 (input, send, cancel, error states).

import type { JSX } from 'react';

export function ChatPanel(): JSX.Element {
  return <aside aria-label="Chat" data-testid="chat-panel" />;
}
