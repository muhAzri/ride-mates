/**
 * HTTP boundary for the Location & geocoding feature (API_CONTRACT.md §5). Maps
 * requests to use-cases and results to responses — no business logic, no data
 * access. Use-cases are injected (wiring lives in `location.module.ts`).
 */
import type { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, json } from '@/shared/http/responses';
import { ApiError } from '@/shared/http/api-error';
import { parseInput, readJsonBody } from '@/shared/validation/validate';
import type { SetLocationUseCase } from '../application/set-location.usecase';
import type { GetLocationUseCase } from '../application/get-location.usecase';
import { setLocationSchema } from './location.schemas';
import { toLocationResultDto, toMyLocationDto } from './location.mapper';

export interface LocationUseCases {
  setLocation: SetLocationUseCase;
  getLocation: GetLocationUseCase;
}

export class LocationController {
  constructor(private readonly useCases: LocationUseCases) {}

  /** PUT /users/me/location (MP-9, LP-1, LP-3). */
  async setLocation(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const body = parseInput(setLocationSchema, await readJsonBody(request));
    const result = await this.useCases.setLocation.execute(accessToken, body);
    return json(toLocationResultDto(result), 200);
  }

  /** GET /users/me/location (MP-12). */
  async getLocation(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const location = await this.useCases.getLocation.execute(accessToken);
    return json(toMyLocationDto(location), 200);
  }

  private requireToken(request: NextRequest): string {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      throw ApiError.unauthenticated('You must be signed in to continue.');
    }
    return accessToken;
  }
}
