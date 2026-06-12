/**
 * Typed application error mapped to the API contract's standard error envelope
 * (API_CONTRACT.md §1.7). Throw an `ApiError` anywhere in the request pipeline;
 * `toErrorResponse` turns it into the canonical `{ error: { code, message, … } }`
 * body. Anything that is *not* an `ApiError` is treated as an unexpected 500.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'GONE'
  | 'UNPROCESSABLE'
  | 'RATE_LIMITED'
  | 'INTERNAL';

/** Per-field validation messages, e.g. `{ email: "Email is already registered." }`. */
export type FieldErrors = Record<string, string>;

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  GONE: 410,
  UNPROCESSABLE: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: FieldErrors;
  /** Seconds to wait before retrying — emitted as a `Retry-After` header (§1.8). */
  readonly retryAfter?: number;

  constructor(code: ErrorCode, message: string, fields?: FieldErrors, retryAfter?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.fields = fields;
    this.retryAfter = retryAfter;
  }

  static validation(message = 'Request validation failed.', fields?: FieldErrors): ApiError {
    return new ApiError('VALIDATION_ERROR', message, fields);
  }

  static unauthenticated(message = 'Authentication is required.', fields?: FieldErrors): ApiError {
    return new ApiError('UNAUTHENTICATED', message, fields);
  }

  static forbidden(message = 'You are not allowed to perform this action.'): ApiError {
    return new ApiError('FORBIDDEN', message);
  }

  static notFound(message = 'The requested resource was not found.'): ApiError {
    return new ApiError('NOT_FOUND', message);
  }

  static conflict(message: string, fields?: FieldErrors): ApiError {
    return new ApiError('CONFLICT', message, fields);
  }

  static unprocessable(message: string, fields?: FieldErrors): ApiError {
    return new ApiError('UNPROCESSABLE', message, fields);
  }

  static rateLimited(
    message = 'Too many requests. Please try again later.',
    retryAfter?: number,
  ): ApiError {
    return new ApiError('RATE_LIMITED', message, undefined, retryAfter);
  }

  static internal(message = 'An unexpected error occurred.'): ApiError {
    return new ApiError('INTERNAL', message);
  }
}
