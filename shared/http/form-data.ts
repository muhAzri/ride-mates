/**
 * Read a single uploaded file from a `multipart/form-data` request
 * (API_CONTRACT.md §1.3, §4.3). Returns the bytes + declared content type +
 * size; semantic validation (type/size limits) is the storage layer's job
 * (`assertValidAvatar`). Maps a missing/empty part to a clean 400.
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

export async function readUploadedFile(
  request: NextRequest,
  field: string,
): Promise<UploadedImage> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw ApiError.validation('Expected a multipart/form-data upload.', {
      _root: 'Send the file as multipart/form-data.',
    });
  }

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
