/**
 * Helpers for reading `multipart/form-data` requests (API_CONTRACT.md §1.3, §4.3).
 * A request body can only be consumed once, so `readMultipart` parses it a single
 * time and the field accessors operate on the resulting `FormData`. Semantic
 * validation (image type/size) is the storage layer's job.
 */
import type { NextRequest } from 'next/server';
import { ApiError } from './api-error';
import type { UploadedImage } from '@/shared/storage';

/**
 * Duck-type the part instead of `instanceof File`: `request.formData()` returns
 * undici's `File`, whose constructor reference can differ from the global `File`
 * in scope — so `instanceof File` yields false negatives even for a real upload.
 * A text field is a plain `string`; a file part is a File with `arrayBuffer()`.
 */
function isFilePart(part: FormDataEntryValue | null): part is File {
  return (
    part !== null &&
    typeof part !== 'string' &&
    typeof (part as File).arrayBuffer === 'function'
  );
}

/** Parse the request body as form-data once, mapping a non-multipart body to 400. */
export async function readMultipart(request: NextRequest): Promise<FormData> {
  try {
    return await request.formData();
  } catch {
    throw ApiError.validation('Expected a multipart/form-data upload.', {
      _root: 'Send the file as multipart/form-data.',
    });
  }
}

/** Extract a required file part (with its bytes) from already-parsed form-data. */
export async function getFilePart(form: FormData, field: string): Promise<UploadedImage> {
  const part = form.get(field);
  if (!isFilePart(part)) {
    throw ApiError.validation('No file was uploaded.', {
      [field]: `A "${field}" file part is required (send it as a File, not text).`,
    });
  }
  const body = Buffer.from(await part.arrayBuffer());
  return {
    body,
    size: body.byteLength,
    contentType: part.type || 'application/octet-stream',
  };
}

/** Optional positive-integer text field (e.g. an image's `width`); null if absent/invalid. */
export function getOptionalIntField(form: FormData, field: string): number | null {
  const raw = form.get(field);
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

/** A single optional text field, trimmed; `null` when absent or blank. */
export function getOptionalTextField(form: FormData, field: string): string | null {
  const raw = form.get(field);
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null;
}

/** Whether a field is present at all (even if blank) — distinguishes "omitted" from "empty". */
export function hasField(form: FormData, field: string): boolean {
  return form.has(field);
}

/** All non-blank text values for a (possibly repeated) field, e.g. `keepPhotoIds`. */
export function getTextValues(form: FormData, field: string): string[] {
  return form
    .getAll(field)
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => v !== '');
}

/** All file parts (with bytes) for a (possibly repeated) field, e.g. `photos`. */
export async function getFileParts(form: FormData, field: string): Promise<UploadedImage[]> {
  const parts = form.getAll(field).filter(isFilePart);
  return Promise.all(
    parts.map(async (part) => {
      const body = Buffer.from(await part.arrayBuffer());
      return { body, size: body.byteLength, contentType: part.type || 'application/octet-stream' };
    }),
  );
}

/**
 * Read a single uploaded file from a `multipart/form-data` request. Convenience
 * wrapper around `readMultipart` + `getFilePart` for endpoints that need only the
 * file (e.g. avatar upload).
 */
export async function readUploadedFile(
  request: NextRequest,
  field: string,
): Promise<UploadedImage> {
  const form = await readMultipart(request);
  return await getFilePart(form, field);
}
