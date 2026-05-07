// Structured JSON logger. One line per log call → trivially aggregatable
// by stdout-shipping log collectors (Loki, Cloud Logging, Vector). The
// caller passes a flat object; the logger adds ts and level. There's no
// child-logger / context propagation beyond the request-scoped helper
// in handlers/chat.ts — explicit fields per call keep the schema honest.

export type LogLevel = 'info' | 'warn' | 'error';

export interface Logger {
  info: (data: Record<string, unknown>) => void;
  warn: (data: Record<string, unknown>) => void;
  error: (data: Record<string, unknown>) => void;
}

function emit(level: LogLevel, data: Record<string, unknown>): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    ...data,
  });
  // info → stdout, warn → stderr, error → stderr. Standard Twelve-Factor.
  // The server's no-console override (eslint.config.js) allows console.log
  // here because stdout is the canonical sink for structured server logs.
  if (level === 'info') console.log(line);
  else if (level === 'warn') console.warn(line);
  else console.error(line);
}

export function createLogger(): Logger {
  return {
    info: (data) => {
      emit('info', data);
    },
    warn: (data) => {
      emit('warn', data);
    },
    error: (data) => {
      emit('error', data);
    },
  };
}

// Silent logger for tests — drops every call. Tests can pass this when
// they don't care about log output (most cases) and a vi.fn() variant
// when they want to assert on a specific log call.
export function createSilentLogger(): Logger {
  return {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}
