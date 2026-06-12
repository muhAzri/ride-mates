/**
 * Higher-order wrapper for Route Handlers. It owns the cross-cutting concerns
 * every endpoint shares — request-id generation, attaching `X-Request-Id`, and
 * funnelling thrown `ApiError`s through the standard envelope — so individual
 * handlers stay focused on their own behaviour (Open/Closed: add endpoints
 * without re-implementing this).
 */
import type { NextRequest, NextResponse } from 'next/server';
import { newRequestId, REQUEST_ID_HEADER } from './responses';
import { toErrorResponse } from './error-handler';

/**
 * Next.js passes dynamic route segments via a context whose `params` is a
 * Promise (e.g. `{ params: Promise<{ userId: string }> }`). Static routes get an
 * empty params object. Handlers that don't need params simply ignore it.
 */
export type RouteContext<P = Record<string, string>> = { params: Promise<P> };

export type RouteHandler<P = Record<string, string>> = (
  request: NextRequest,
  context: RouteContext<P>,
  requestId: string,
) => Promise<NextResponse>;

export function withRoute<P = Record<string, string>>(handler: RouteHandler<P>) {
  return async (request: NextRequest, context: RouteContext<P>): Promise<NextResponse> => {
    const requestId = newRequestId();
    try {
      const response = await handler(request, context, requestId);
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    } catch (error) {
      return toErrorResponse(error, requestId);
    }
  };
}
