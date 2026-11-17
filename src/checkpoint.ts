import { retryRateLimited } from './http.js';
import { readListenPage, type ListenerOptions } from './listener.js';

export interface CheckpointOptions extends ListenerOptions {
  readonly onPage?: (details: CheckpointPageDetails) => void | Promise<void>;
  readonly sleep?: (ms: number, signal: AbortSignal | undefined) => Promise<void>;
}

export interface CheckpointPageDetails {
  readonly skipped: number;
  readonly cursor: string | null;
  readonly hasMore: boolean;
}

export interface CheckpointResult {
  readonly cursor: string | null;
  readonly pages: number;
  readonly skipped: number;
}

export async function checkpointListenCursor(
  options: CheckpointOptions,
): Promise<CheckpointResult> {
  let cursor = options.cursor ?? null;
  let pages = 0;
  let skipped = 0;

  while (true) {
    const page = await retryRateLimited(
      () => readListenPage({
        ...options,
        cursor: cursor ?? undefined,
      }),
      options,
    );
    pages += 1;
    skipped += page.data.length;
    cursor = page.cursor ?? cursor;
    const hasMore = page.hasMore;
    await options.onPage?.({
      skipped: page.data.length,
      cursor,
      hasMore,
    });
    if (!hasMore) break;
  }

  return { cursor, pages, skipped };
}
