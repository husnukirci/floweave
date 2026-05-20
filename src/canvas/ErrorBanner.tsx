// ErrorBanner — transient notification surface at the top of the canvas.
// Auto-dismisses after 3 seconds. Replaces the toast system in Phase 4
// Tier 2; for Phase 3 this is the inline error path required by PLAN.md
// §6 ("Validation errors during connection drag show toast or inline
// message").
//
// Renders an aria-live=polite region so screen readers announce the
// notification.

import { type JSX, useEffect } from 'react';

import { useUiStore } from '@/state/StoresProvider';

const AUTO_DISMISS_MS = 3000;

export function ErrorBanner(): JSX.Element | null {
  const notification = useUiStore((s) => s.notification);
  const setNotification = useUiStore((s) => s.setNotification);

  // CONNECTING hints are sticky — they describe an interactive mode rather
  // than a one-shot error, so they should remain until the user finishes
  // or cancels the connection. Other notifications auto-dismiss.
  const isConnectingHint = notification?.code === 'CONNECTING';

  useEffect(() => {
    if (!notification || isConnectingHint) return undefined;
    const handle = setTimeout(() => {
      setNotification(null);
    }, AUTO_DISMISS_MS);
    return () => {
      clearTimeout(handle);
    };
  }, [notification, isConnectingHint, setNotification]);

  if (!notification) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="error-banner"
      className={
        isConnectingHint
          ? 'pointer-events-none absolute left-1/2 top-4 [transform:translateX(-50%)] rounded-md bg-amber-100 px-4 py-2 text-sm text-amber-900 shadow-md ring-1 ring-amber-300'
          : 'pointer-events-none absolute left-1/2 top-4 [transform:translateX(-50%)] rounded-md bg-rose-100 px-4 py-2 text-sm text-rose-900 shadow-md ring-1 ring-rose-300'
      }
    >
      {notification.message}
    </div>
  );
}
