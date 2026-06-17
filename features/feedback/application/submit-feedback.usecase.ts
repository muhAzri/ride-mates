/**
 * POST /feedback (FB-2) — unified bug/idea/other form. If a screenshot was
 * uploaded pre-signed (R17), its `ref` is validated and the staged object is
 * promoted to a final public key before the submission (with the screenshot URL)
 * is persisted. App diagnostics are kept only when the user opted in
 * (`includeAppInfo`).
 */
import { ApiError } from '@/shared/http/api-error';
import type { ObjectStorage } from '@/shared/storage';
import { assertValidScreenshotMeta, commitStagedImage, isUploadRef } from '@/shared/storage';
import type { FeedbackRepository } from '../domain/feedback.repository';
import type { AppInfo, FeedbackReceipt, FeedbackType } from '../domain/feedback.types';
import { screenshotKey, screenshotStagingKey } from '../domain/screenshot-key';

const SCREENSHOT_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const EMPTY_APP_INFO: AppInfo = {
  appVersion: null,
  platform: null,
  osVersion: null,
  deviceModel: null,
};

export interface SubmitFeedbackInput {
  type: FeedbackType;
  message: string;
  includeAppInfo: boolean;
  appInfo: AppInfo;
}

export class SubmitFeedbackUseCase {
  constructor(
    private readonly repo: FeedbackRepository,
    private readonly storage: ObjectStorage,
  ) {}

  async execute(
    accessToken: string,
    input: SubmitFeedbackInput,
    screenshotRef: string | undefined,
  ): Promise<FeedbackReceipt> {
    let screenshotUrl: string | null = null;
    if (screenshotRef) {
      if (!isUploadRef(screenshotRef)) {
        throw ApiError.unprocessable('The screenshot upload reference is invalid.', {
          screenshotRef: 'Re-upload the screenshot and try again.',
        });
      }
      const userId = await this.repo.getUserId(accessToken);
      screenshotUrl = await commitStagedImage(this.storage, {
        stagingKey: screenshotStagingKey(userId, screenshotRef),
        finalKey: screenshotKey(userId),
        validate: assertValidScreenshotMeta,
        cacheControl: SCREENSHOT_CACHE_CONTROL,
      });
    }

    return this.repo.submitFeedback(accessToken, {
      type: input.type,
      message: input.message,
      includeAppInfo: input.includeAppInfo,
      appInfo: input.includeAppInfo ? input.appInfo : EMPTY_APP_INFO,
      screenshotUrl,
    });
  }
}
