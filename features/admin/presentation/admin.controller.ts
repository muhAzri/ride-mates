/**
 * HTTP boundary for the Admin feature (API_CONTRACT.md §15). Maps requests to the
 * admin-reports use-case and results to responses — the admin gate lives in the
 * use-case. No business logic here.
 */
import type { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, json } from '@/shared/http/responses';
import { ApiError } from '@/shared/http/api-error';
import { parseInput, readJsonBody } from '@/shared/validation/validate';
import { decodeCursor } from '@/shared/http/pagination';
import type { AdminReportsUseCase } from '../application/admin-reports.usecase';
import { adminReportsQuerySchema, resolveReportSchema } from './admin.schemas';
import { toAdminReportDto } from './admin.mapper';

export interface AdminUseCases {
  reports: AdminReportsUseCase;
}

export class AdminController {
  constructor(private readonly useCases: AdminUseCases) {}

  /** GET /admin/reports (MD-4). */
  async listReports(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const params = parseInput(
      adminReportsQuerySchema,
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const offset = decodeCursor(request.nextUrl.searchParams.get('cursor'));

    const page = await this.useCases.reports.list(accessToken, {
      status: params.status,
      targetType: params.targetType,
      limit: params.limit,
      offset,
    });
    return json({ data: page.data.map(toAdminReportDto), page: page.page }, 200);
  }

  /** GET /admin/reports/{id} (MD-4). */
  async getReport(request: NextRequest, reportId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const report = await this.useCases.reports.get(accessToken, reportId);
    return json(toAdminReportDto(report), 200);
  }

  /** POST /admin/reports/{id}/resolve (MD-4). */
  async resolveReport(request: NextRequest, reportId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const body = parseInput(resolveReportSchema, await readJsonBody(request));
    const report = await this.useCases.reports.resolve(accessToken, reportId, body);
    return json(toAdminReportDto(report), 200);
  }

  private requireToken(request: NextRequest): string {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      throw ApiError.unauthenticated('You must be signed in to continue.');
    }
    return accessToken;
  }
}
