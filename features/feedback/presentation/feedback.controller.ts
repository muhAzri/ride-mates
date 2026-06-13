/**
 * HTTP boundary for the Feedback feature (API_CONTRACT.md §13, §12.5). The
 * feedback form accepts multipart (with a screenshot) or JSON (without); this
 * controller normalises both into the validated shape. No business logic here.
 */
import type { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, json } from '@/shared/http/responses';
import { ApiError } from '@/shared/http/api-error';
import { parseInput, readJsonBody } from '@/shared/validation/validate';
import { decodeCursor } from '@/shared/http/pagination';
import { getFileParts, getOptionalTextField, readMultipart } from '@/shared/http/form-data';
import type { UploadedImage } from '@/shared/storage';
import type { SubmitFeedbackUseCase } from '../application/submit-feedback.usecase';
import type { FeatureRequestsUseCase } from '../application/feature-requests.usecase';
import type { GetChangelogUseCase } from '../application/get-changelog.usecase';
import {
  createFeatureRequestSchema,
  featureRequestQuerySchema,
  feedbackSchema,
} from './feedback.schemas';
import {
  toChangelogEntryDto,
  toFeatureRequestDto,
  toFeedbackReceiptDto,
  toVoteResultDto,
} from './feedback.mapper';

export interface FeedbackUseCases {
  submitFeedback: SubmitFeedbackUseCase;
  featureRequests: FeatureRequestsUseCase;
  changelog: GetChangelogUseCase;
}

const FEEDBACK_TEXT_FIELDS = ['type', 'message', 'appVersion', 'platform', 'osVersion', 'deviceModel'] as const;

export class FeedbackController {
  constructor(private readonly useCases: FeedbackUseCases) {}

  /** POST /feedback (FB-2) — multipart (with screenshot) or JSON. */
  async submit(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);

    let raw: unknown;
    let screenshot: UploadedImage | undefined;

    if ((request.headers.get('content-type') ?? '').includes('multipart/form-data')) {
      const form = await readMultipart(request);
      const input: Record<string, unknown> = {};
      for (const field of FEEDBACK_TEXT_FIELDS) {
        const value = getOptionalTextField(form, field);
        if (value !== null) input[field] = value;
      }
      input.includeAppInfo = getOptionalTextField(form, 'includeAppInfo') === 'true';
      raw = input;
      screenshot = (await getFileParts(form, 'screenshot'))[0];
    } else {
      raw = await readJsonBody(request);
    }

    const body = parseInput(feedbackSchema, raw);
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
      screenshot,
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
