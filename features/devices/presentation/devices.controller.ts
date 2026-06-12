/**
 * HTTP boundary for the Devices feature (API_CONTRACT.md §11). Maps the request to
 * the register use-case — no business logic, no data access.
 */
import type { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, json } from '@/shared/http/responses';
import { ApiError } from '@/shared/http/api-error';
import { parseInput, readJsonBody } from '@/shared/validation/validate';
import type { RegisterDeviceUseCase } from '../application/register-device.usecase';
import { registerDeviceSchema } from './devices.schemas';

export interface DevicesUseCases {
  register: RegisterDeviceUseCase;
}

export class DevicesController {
  constructor(private readonly useCases: DevicesUseCases) {}

  /** POST /me/devices — register a push device token (NT-3). */
  async register(request: NextRequest): Promise<NextResponse> {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      throw ApiError.unauthenticated('You must be signed in to continue.');
    }
    const body = parseInput(registerDeviceSchema, await readJsonBody(request));
    await this.useCases.register.execute(accessToken, body);
    return json({ registered: true }, 200);
  }
}
