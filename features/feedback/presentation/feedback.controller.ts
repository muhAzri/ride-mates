/**
 * HTTP boundary for the Feedback feature (API_CONTRACT.md §13, §12.5). POST
 * /feedback is `application/json`: an optional screenshot uploads pre-signed
 * (R17), so the body carries a `screenshotRef`. No business logic here.
 */
import type { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, json } from '@/shared/http/responses';
import { ApiError } from '@/shared/http/api-error';
import { parseInput, readJsonBody } from '@/shared/validation/validate';
import { decodeCursor } from '@/shared/http/pagination';
import type { SubmitFeedbackUseCase } from '../application/submit-feedback.usecase';
import type { IssueScreenshotUploadUrlUseCase } from '../application/issue-screenshot-upload-url.usecase';
import type { FeatureRequestsUseCase } from '../application/feature-requests.usecase';
import type { GetChangelogUseCase } from '../application/get-changelog.usecase';
import {
  createFeatureRequestSchema,
  featureRequestQuerySchema,
  feedbackSchema,
  screenshotUploadUrlSchema,
} from './feedback.schemas';
import {
  toChangelogEntryDto,
  toFeatureRequestDto,
  toFeedbackReceiptDto,
  toVoteResultDto,
} from './feedback.mapper';

export interface FeedbackUseCases {
  submitFeedback: SubmitFeedbackUseCase;
  issueScreenshotUploadUrl: IssueScreenshotUploadUrlUseCase;
  featureRequests: FeatureRequestsUseCase;
  changelog: GetChangelogUseCase;
}

export class FeedbackController {
  constructor(private readonly useCases: FeedbackUseCases) {}

  /** POST /feedback/screenshot-upload-url (FB-2 / R17). Issue a pre-signed PUT. */
  async issueScreenshotUploadUrl(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const { contentType } = parseInput(screenshotUploadUrlSchema, await readJsonBody(request));
    const result = await this.useCases.issueScreenshotUploadUrl.execute(accessToken, contentType);
    return json(result, 200);
  }

  /** POST /feedback (FB-2) — JSON; optional `screenshotRef` from a pre-signed upload. */
  async submit(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const body = parseInput(feedbackSchema, await readJsonBody(request));

    const receipt = await this.useCases.submitFeedback.execute(
      accessToken,
      {
        type: body.type,
        message: body.message,
        includeAppInfo: body.includeAppInfo,
        appInfo: {
          appVersion: body.appVersion ?? null,
          platform: body.platform ?? null,
          osVersion: body.osVersion ?? null,
          deviceModel: body.deviceModel ?? null,
        },
      },
      body.screenshotRef,
    );
    return json(toFeedbackReceiptDto(receipt), 201);
  }

  /** GET /feature-requests (FB-3). */
  async listFeatureRequests(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const { sort, limit } = parseInput(
      featureRequestQuerySchema,
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const offset = decodeCursor(request.nextUrl.searchParams.get('cursor'));

    const page = await this.useCases.featureRequests.list(accessToken, sort, limit, offset);
    return json({ data: page.data.map(toFeatureRequestDto), page: page.page }, 200);
  }

  /** POST /feature-requests (FB-3). */
  async createFeatureRequest(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const body = parseInput(createFeatureRequestSchema, await readJsonBody(request));
    const created = await this.useCases.featureRequests.create(accessToken, body);
    return json(toFeatureRequestDto(created), 201);
  }

  /** PUT /feature-requests/{id}/vote (FB-3). */
  async vote(request: NextRequest, requestId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const result = await this.useCases.featureRequests.vote(accessToken, requestId);
    return json(toVoteResultDto(result), 200);
  }

  /** DELETE /feature-requests/{id}/vote (FB-3). */
  async unvote(request: NextRequest, requestId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const result = await this.useCases.featureRequests.unvote(accessToken, requestId);
    return json(toVoteResultDto(result), 200);
  }

  /** GET /changelog (§12.5). */
  async changelog(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const entries = await this.useCases.changelog.execute(accessToken);
    return json({ data: entries.map(toChangelogEntryDto) }, 200);
  }

  private requireToken(request: NextRequest): string {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      throw ApiError.unauthenticated('You must be signed in to continue.');
    }
    return accessToken;
  }
}
