/**
 * HTTP boundary for the Moderation feature (API_CONTRACT.md §12). Maps requests
 * to use-cases and results to responses — no business logic, no data access.
 */
import type { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, json } from '@/shared/http/responses';
import { ApiError } from '@/shared/http/api-error';
import { parseInput, readJsonBody } from '@/shared/validation/validate';
import type { SubmitReportUseCase } from '../application/submit-report.usecase';
import type { BlocksUseCase } from '../application/blocks.usecase';
import { createReportSchema } from './moderation.schemas';
import { toBlockedUserDto, toReportReceiptDto } from './moderation.mapper';

export interface ModerationUseCases {
  submitReport: SubmitReportUseCase;
  blocks: BlocksUseCase;
}

export class ModerationController {
  constructor(private readonly useCases: ModerationUseCases) {}

  /** POST /reports (MD-1/2/3). */
  async createReport(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const body = parseInput(createReportSchema, await readJsonBody(request));
    const receipt = await this.useCases.submitReport.execute(accessToken, body);
    return json(toReportReceiptDto(receipt), 201);
  }

  /** GET /me/blocks (MD-5, Settings 16). */
  async listBlocks(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const { items, count } = await this.useCases.blocks.list(accessToken);
    return json({ data: items.map(toBlockedUserDto), count }, 200);
  }

  /** PUT /users/{userId}/block (MD-5). */
  async block(request: NextRequest, userId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const result = await this.useCases.blocks.block(accessToken, userId);
    return json(result, 200);
  }

  /** DELETE /users/{userId}/block (MD-5). */
  async unblock(request: NextRequest, userId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const result = await this.useCases.blocks.unblock(accessToken, userId);
    return json(result, 200);
  }

  private requireToken(request: NextRequest): string {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      throw ApiError.unauthenticated('You must be signed in to continue.');
    }
    return accessToken;
  }
}
