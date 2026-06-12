/**
 * Centralised error → HTTP envelope translation (API_CONTRACT.md §1.7).
 * The only place that knows how to serialise a failure, so every route reports
 * errors identically.
 */
import { NextResponse } from 'next/server';
import { ApiError } from './api-error';
import { REQUEST_ID_HEADER } from './responses';

export function toErrorResponse(error: unknown, requestId: string): NextResponse {
  const apiError = error instanceof ApiError ? error : ApiError.internal();

  // Unexpected (non-ApiError) failures are bugs — log the real cause but never
  // leak internals to the client (NFR Security; must not silently drop — we log).
  if (!(error instanceof ApiError)) {
    console.error(`[api] unhandled error (requestId=${requestId})`, error);
  }

  const body = {
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.fields ? { fields: apiError.fields } : {}),
      requestId,
    },
  };

  return NextResponse.json(body, {
    status: apiError.status,
    headers: { [REQUEST_ID_HEADER]: requestId },
  });
}
