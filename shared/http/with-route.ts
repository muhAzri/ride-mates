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

export type RouteHandler = (
  request: NextRequest,
  requestId: string,
) => Promise<NextResponse>;

export function withRoute(handler: RouteHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const requestId = newRequestId();
    try {
      const response = await handler(request, requestId);
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    } catch (error) {
      return toErrorResponse(error, requestId);
    }
  };
}
