/**
 * POST /feedback (FB-2) — unified bug/idea/other form. If a screenshot is
 * attached it is validated and uploaded to object storage first, then the
 * submission (with the screenshot URL) is persisted. App diagnostics are kept
 * only when the user opted in (`includeAppInfo`).
 */
import type { ObjectStorage, UploadedImage } from '@/shared/storage';
import { assertValidScreenshot } from '@/shared/storage';
import type { FeedbackRepository } from '../domain/feedback.repository';
import type { AppInfo, FeedbackReceipt, FeedbackType } from '../domain/feedback.types';
import { screenshotKey } from '../domain/screenshot-key';

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
    screenshot: UploadedImage | undefined,
  ): Promise<FeedbackReceipt> {
    let screenshotUrl: string | null = null;
    if (screenshot) {
      const contentType = assertValidScreenshot(screenshot);
      const userId = await this.repo.getUserId(accessToken);
      screenshotUrl = await this.storage.put({
        key: screenshotKey(userId),
        body: screenshot.body,
        contentType,
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
