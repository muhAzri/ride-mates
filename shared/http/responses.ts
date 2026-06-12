/**
 * Small, framework-aware response helpers. Keeping these in one place means
 * controllers never touch `NextResponse` construction details directly.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const REQUEST_ID_HEADER = 'X-Request-Id';

/** Opaque, traceable request id (API_CONTRACT.md §1.7 `requestId`). */
export function newRequestId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, '')}`;
}

/** JSON success response. */
export function json<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** 204 No Content (e.g. logout). */
export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

/**
 * Extract a bearer access token from the `Authorization` header.
 * Returns `null` when absent or malformed so callers can decide the error shape.
 */
export function getBearerToken(request: NextRequest | Request): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}
