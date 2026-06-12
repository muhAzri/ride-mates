/**
 * Bridges zod validation to the contract's `VALIDATION_ERROR` envelope. Schema
 * failures become a `400` with a per-field `fields` map (API_CONTRACT.md §1.7).
 *
 * Note: this layer validates request *shape* only. Semantic rules (e.g. password
 * strength → `422 UNPROCESSABLE`) live in the domain, not here.
 */
import type { ZodType } from 'zod';
import { ApiError, type FieldErrors } from '../http/api-error';

/** Parse an already-decoded JSON value against a schema, or throw `ApiError`. */
export function parseInput<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const fields: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_root';
    fields[key] ??= issue.message;
  }
  throw ApiError.validation('Request validation failed.', fields);
}

/**
 * Read and JSON-parse a request body, mapping malformed JSON to a clean `400`
 * rather than an unhandled exception.
 */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw ApiError.validation('Request body must be valid JSON.', {
      _root: 'Expected a JSON object.',
    });
  }
}
