/**
 * HTTP boundary for the auth feature. Each method maps a request to a use-case
 * and a use-case result to a response — no business logic, no data access. The
 * use-cases are injected (Dependency Inversion), so the controller is trivially
 * testable and the wiring lives in `auth.module.ts`.
 */
import type { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, json, noContent } from '@/shared/http/responses';
import { ApiError } from '@/shared/http/api-error';
import { parseInput, readJsonBody } from '@/shared/validation/validate';
import type { RegisterUseCase } from '../application/register.usecase';
import type { LoginUseCase } from '../application/login.usecase';
import type { GoogleLoginUseCase } from '../application/google-login.usecase';
import type { RefreshSessionUseCase } from '../application/refresh-session.usecase';
import type { LogoutUseCase } from '../application/logout.usecase';
import {
  googleSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
} from './auth.schemas';
import { toAuthResponse, toTokensResponse } from './auth.mapper';

export interface AuthUseCases {
  register: RegisterUseCase;
  login: LoginUseCase;
  google: GoogleLoginUseCase;
  refresh: RefreshSessionUseCase;
  logout: LogoutUseCase;
}

export class AuthController {
  constructor(private readonly useCases: AuthUseCases) {}

  /** POST /auth/register (UA-1). */
  async register(request: NextRequest): Promise<NextResponse> {
    const body = parseInput(registerSchema, await readJsonBody(request));
    const result = await this.useCases.register.execute(body);
    return json(toAuthResponse(result), 201);
  }

  /** POST /auth/login (UA-2). */
  async login(request: NextRequest): Promise<NextResponse> {
    const body = parseInput(loginSchema, await readJsonBody(request));
    const result = await this.useCases.login.execute(body);
    return json(toAuthResponse(result), 200);
  }

  /** POST /auth/social/google (UA-6). */
  async google(request: NextRequest): Promise<NextResponse> {
    const body = parseInput(googleSchema, await readJsonBody(request));
    const result = await this.useCases.google.execute(body.idToken);
    return json(toAuthResponse(result), 200);
  }

  /** POST /auth/refresh (UA-2). */
  async refresh(request: NextRequest): Promise<NextResponse> {
    const body = parseInput(refreshSchema, await readJsonBody(request));
    const tokens = await this.useCases.refresh.execute(body.refreshToken);
    return json(toTokensResponse(tokens), 200);
  }

  /** POST /auth/logout (auth required, UA-2). */
  async logout(request: NextRequest): Promise<NextResponse> {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      throw ApiError.unauthenticated('A bearer access token is required.');
    }
    await this.useCases.logout.execute(accessToken);
    return noContent();
  }
}
