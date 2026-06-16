/**
 * HTTP boundary for the Users & profile feature (API_CONTRACT.md §4). Each method
 * maps a request to a use-case and a result to a response — no business logic,
 * no data access. Use-cases are injected (wiring lives in `users.module.ts`).
 */
import type { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, json, noContent } from '@/shared/http/responses';
import { ApiError } from '@/shared/http/api-error';
import { parseInput, readJsonBody } from '@/shared/validation/validate';
import type { GetMeUseCase } from '../application/get-me.usecase';
import type { UpdateProfileUseCase } from '../application/update-profile.usecase';
import type { GetPublicProfileUseCase } from '../application/get-public-profile.usecase';
import type { IssueAvatarUploadUrlUseCase } from '../application/issue-avatar-upload-url.usecase';
import type { CommitAvatarUseCase } from '../application/commit-avatar.usecase';
import type { RemoveAvatarUseCase } from '../application/remove-avatar.usecase';
import type { GetNotificationPreferencesUseCase } from '../application/get-notification-preferences.usecase';
import type { UpdateNotificationPreferencesUseCase } from '../application/update-notification-preferences.usecase';
import {
  avatarUploadUrlSchema,
  updateNotificationPreferencesSchema,
  updateProfileSchema,
} from './users.schemas';
import { toNotificationPreferencesDto, toPublicUserDto, toSelfUserDto } from './users.mapper';

export interface UsersUseCases {
  getMe: GetMeUseCase;
  updateProfile: UpdateProfileUseCase;
  getPublicProfile: GetPublicProfileUseCase;
  issueAvatarUploadUrl: IssueAvatarUploadUrlUseCase;
  commitAvatar: CommitAvatarUseCase;
  removeAvatar: RemoveAvatarUseCase;
  getNotificationPreferences: GetNotificationPreferencesUseCase;
  updateNotificationPreferences: UpdateNotificationPreferencesUseCase;
}

export class UsersController {
  constructor(private readonly useCases: UsersUseCases) {}

  /** GET /users/me (UA-3). */
  async getMe(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const user = await this.useCases.getMe.execute(accessToken);
    return json(toSelfUserDto(user), 200);
  }

  /** PATCH /users/me (UA-3). */
  async updateMe(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const body = parseInput(updateProfileSchema, await readJsonBody(request));
    const user = await this.useCases.updateProfile.execute(accessToken, body);
    return json(toSelfUserDto(user), 200);
  }

  /**
   * POST /users/me/avatar/upload-url (UA-4, step 1). Issue a pre-signed PUT so the
   * client uploads the avatar straight to object storage (R16). Body: `{ contentType }`.
   */
  async issueAvatarUploadUrl(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const { contentType } = parseInput(avatarUploadUrlSchema, await readJsonBody(request));
    const result = await this.useCases.issueAvatarUploadUrl.execute(accessToken, contentType);
    return json(result, 200);
  }

  /**
   * PUT /users/me/avatar (UA-4, step 2). Confirm the pre-signed upload: validate the
   * stored object's metadata and record the URL. No request body.
   */
  async commitAvatar(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const { avatarUrl } = await this.useCases.commitAvatar.execute(accessToken);
    return json({ avatarUrl }, 200);
  }

  /** DELETE /users/me/avatar (UA-4). */
  async removeAvatar(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    await this.useCases.removeAvatar.execute(accessToken);
    return noContent();
  }

  /** GET /me/notification-preferences (§14). */
  async getNotificationPreferences(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const prefs = await this.useCases.getNotificationPreferences.execute(accessToken);
    return json(toNotificationPreferencesDto(prefs), 200);
  }

  /** PATCH /me/notification-preferences (§14). */
  async updateNotificationPreferences(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const body = parseInput(updateNotificationPreferencesSchema, await readJsonBody(request));
    const prefs = await this.useCases.updateNotificationPreferences.execute(accessToken, body);
    return json(toNotificationPreferencesDto(prefs), 200);
  }

  /** GET /users/{userId} — public projection (UA-3). */
  async getPublicProfile(request: NextRequest, userId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const user = await this.useCases.getPublicProfile.execute(accessToken, userId);
    return json(toPublicUserDto(user), 200);
  }

  private requireToken(request: NextRequest): string {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      throw ApiError.unauthenticated('You must be signed in to continue.');
    }
    return accessToken;
  }
}
