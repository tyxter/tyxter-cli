import { setTimeout as delay } from 'node:timers/promises';

export type FetchLike = typeof fetch;

interface FetchErrorCause extends Error {
  readonly address?: string;
  readonly code?: string;
  readonly port?: number | string;
  readonly syscall?: string;
}

export async function withRequestTimeout<T>(
  signal: AbortSignal | undefined,
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  const timer = setTimeout(() => {
    controller.abort(new DOMException('Request timed out', 'TimeoutError'));
  }, timeoutMs);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  try {
    controller.signal.throwIfAborted();
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export class HttpStatusError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
    readonly action: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'HttpStatusError';
  }
}

export async function retryRateLimited<T>(
  run: () => Promise<T>,
  options: {
    readonly signal?: AbortSignal;
    readonly deadlineMs?: number;
    readonly onRateLimited?: (details: { retryAfterMs: number }) => void | Promise<void>;
    readonly sleep?: (ms: number, signal: AbortSignal | undefined) => Promise<void>;
  } = {},
): Promise<T> {
  let retryDelayMs = 1_000;
  while (true) {
    options.signal?.throwIfAborted();
    try {
      return await run();
    } catch (error) {
      if (!(error instanceof HttpStatusError) || error.status !== 429) throw error;
      options.signal?.throwIfAborted();
      const retryAfterMs = error.retryAfterMs ?? retryDelayMs;
      const durationError = new Error(
        `${error.action} rate limited; retry after ${retryAfterMs}ms; wait exceeds remaining run duration`,
      );
      if (options.deadlineMs !== undefined && Date.now() + retryAfterMs >= options.deadlineMs) {
        throw durationError;
      }
      await options.onRateLimited?.({ retryAfterMs });
      await (options.sleep ?? sleep)(retryAfterMs, options.signal);
      options.signal?.throwIfAborted();
      if (options.deadlineMs !== undefined && Date.now() >= options.deadlineMs) {
        throw durationError;
      }
      retryDelayMs = Math.min(30_000, retryDelayMs * 2);
    }
  }
}

async function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  await delay(ms, undefined, { signal });
}

/** The system error code behind a failed fetch, such as ECONNREFUSED. */
export function requestErrorCode(error: unknown): string | undefined {
  if (!(error instanceof Error) || !(error.cause instanceof Error)) return undefined;
  const code = (error.cause as FetchErrorCause).code;
  return typeof code === 'string' ? code : undefined;
}

/** The message plus any fetch cause, e.g. "fetch failed: ECONNREFUSED connect 127.0.0.1:3000". */
export function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause;
  const causeMessage = causeDiagnostic(cause);
  return causeMessage ? `${error.message}: ${causeMessage}` : error.message;
}

function causeDiagnostic(cause: unknown): string | undefined {
  if (!(cause instanceof Error)) return cause === undefined ? undefined : String(cause);
  const detail = cause as FetchErrorCause;
  const address = detail.address ? String(detail.address) : undefined;
  const port = detail.port === undefined ? undefined : String(detail.port);
  const endpoint = address && port ? `${address}:${port}` : address ?? port;
  const parts = [detail.code, detail.syscall, endpoint].filter(
    (part): part is string => typeof part === 'string' && part.length > 0,
  );
  if (parts.length > 0) return parts.join(' ');
  return cause.message;
}

export function endpointUrl(baseUrl: string, path: string): URL {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\//, ''), normalizedBase);
}

export async function readFailure(response: Response, action: string): Promise<never> {
  const body = await response.text().catch(() => '');
  throw new HttpStatusError(
    `${action} failed with HTTP ${response.status}`,
    response.status,
    body,
    action,
    retryAfterMs(response, body),
  );
}

function retryAfterMs(response: Response, body: string): number | undefined {
  const headerMs = retryAfterHeaderMs(response.headers.get('retry-after'));
  if (headerMs !== undefined) return headerMs;
  return retryAfterBodyMs(body);
}

function retryAfterHeaderMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  return undefined;
}

function retryAfterBodyMs(body: string): number | undefined {
  try {
    const parsed = JSON.parse(body) as unknown;
    const retryAfter = (parsed as { error?: { retry_after_ms?: unknown } }).error
      ?.retry_after_ms;
    if (typeof retryAfter === 'number' && Number.isFinite(retryAfter) && retryAfter >= 0) {
      return Math.ceil(retryAfter);
    }
  } catch {
    return undefined;
  }
  return undefined;
}
