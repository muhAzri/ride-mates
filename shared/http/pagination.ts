/**
 * Cursor pagination helpers (API_CONTRACT.md §1.5). List endpoints return
 * `{ data, page: { nextCursor, hasMore } }`. The cursor is an opaque, base64url
 * token; internally it carries a row offset, so the underlying RPCs stay simple
 * (limit/offset) while clients only ever see and echo back the opaque string.
 *
 * `limit` defaults to 20 and is capped at 50 (§1.5). To detect `hasMore` a caller
 * fetches `limit + 1` rows and passes them to `buildPage`, which trims the extra.
 */
import { ApiError } from './api-error';

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;

export interface PageInfo {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface Page<T> {
  data: T[];
  page: PageInfo;
}

/** Clamp a requested page size to the contract's bounds (default 20, max 50). */
export function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || Number.isNaN(limit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
}

/** Encode a row offset as an opaque cursor. */
export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset }), 'utf8').toString('base64url');
}

/**
 * Decode a cursor to its row offset. A malformed cursor is a client error
 * (`400 VALIDATION_ERROR`), not a silent reset, so paging bugs surface early.
 */
export function decodeCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const offset = Number(parsed?.o);
    if (!Number.isInteger(offset) || offset < 0) throw new Error('bad offset');
    return offset;
  } catch {
    throw ApiError.validation('Invalid pagination cursor.', { cursor: 'The cursor is malformed.' });
  }
}

/**
 * Build a page envelope from rows fetched with `limit + 1`. If the extra row is
 * present there is a next page; it is trimmed and a `nextCursor` is emitted.
 */
export function buildPage<T>(rows: T[], limit: number, offset: number): Page<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  return {
    data,
    page: {
      hasMore,
      nextCursor: hasMore ? encodeCursor(offset + limit) : null,
    },
  };
}
