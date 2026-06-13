/**
 * Supabase implementation of the `UsersRepository` port. The only layer that
 * talks to Supabase Auth and the `profiles` / `user_settings` tables. Every call
 * uses a token-scoped client so RLS runs as the caller:
 *
 *  - `profiles` is public-read, owner-write (a row guard blocks role/rating
 *    escalation), so reads of other users return only public columns.
 *  - precise coordinates live in `user_locations` (owner-only) and are never
 *    read here — only `display_area` / `area_level` (LP-1, LP-2).
 */
import { createScopedClient } from '@/shared/supabase/server-client';
import { rethrowIfAuthError } from '@/shared/supabase/errors';
import { ApiError } from '@/shared/http/api-error';
import type { UsersRepository } from '../domain/users.repository';
import type {
  AuthIdentity,
  CyclingType,
  NotificationPreferences,
  PublicProfile,
  SelfProfile,
  UpdateNotificationPreferencesCommand,
  UpdateProfileCommand,
  UserRole,
} from '../domain/user.types';

interface ProfileRow {
  id: string;
  display_name: string;
  bio: string | null;
  cycling_type: CyclingType | null;
  avatar_url: string | null;
  display_area: string | null;
  area_level: string | null;
  rating_average: number | null;
  role: UserRole;
  created_at: string;
}

export class SupabaseUsersRepository implements UsersRepository {
  async getIdentity(accessToken: string): Promise<AuthIdentity> {
    const supabase = createScopedClient(accessToken);
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data.user) {
      throw ApiError.unauthenticated('Your session has expired. Please sign in again.');
    }
    return { id: data.user.id, email: data.user.email ?? '' };
  }

  async getSelf(accessToken: string): Promise<SelfProfile> {
    const supabase = createScopedClient(accessToken);
    const { id, email } = await this.getIdentity(accessToken);

    const [profileRes, settingsRes, listingCountRes, threadCountRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase
        .from('user_settings')
        .select('contact_preference')
        .eq('user_id', id)
        .maybeSingle(),
      supabase.from('listings').select('id', { count: 'exact', head: true }).eq('owner_id', id),
      supabase
        .from('threads')
        .select('id', { count: 'exact', head: true })
        .eq('author_id', id)
        .is('removed_at', null),
    ]);

    if (profileRes.error || !profileRes.data) {
      rethrowIfAuthError(profileRes.error);
      console.error('[users] profile row missing for authenticated user', profileRes.error);
      throw ApiError.internal();
    }

    const profile = profileRes.data as ProfileRow;
    return {
      ...this.toPublic(profile, listingCountRes.count ?? 0, threadCountRes.count ?? 0),
      email,
      contactPreference: settingsRes.data?.contact_preference ?? 'in_app_chat',
      role: profile.role,
    };
  }

  async updateProfile(
    accessToken: string,
    command: UpdateProfileCommand,
  ): Promise<SelfProfile> {
    const supabase = createScopedClient(accessToken);
    const { id } = await this.getIdentity(accessToken);

    // `profiles` columns vs. the `contact_preference` that lives in user_settings.
    const profilePatch: Record<string, unknown> = {};
    if (command.displayName !== undefined) profilePatch.display_name = command.displayName;
    if (command.bio !== undefined) profilePatch.bio = command.bio;
    if (command.cyclingType !== undefined) profilePatch.cycling_type = command.cyclingType;

    if (Object.keys(profilePatch).length > 0) {
      const { error } = await supabase.from('profiles').update(profilePatch).eq('id', id);
      if (error) {
        rethrowIfAuthError(error);
        console.error('[users] profile update failed', error);
        throw ApiError.internal('Could not update your profile. Please try again.');
      }
    }

    if (command.contactPreference !== undefined) {
      const { error } = await supabase
        .from('user_settings')
        .update({ contact_preference: command.contactPreference })
        .eq('user_id', id);
      if (error) {
        rethrowIfAuthError(error);
        console.error('[users] settings update failed', error);
        throw ApiError.internal('Could not update your profile. Please try again.');
      }
    }

    return this.getSelf(accessToken);
  }

  async getPublicProfile(accessToken: string, userId: string): Promise<PublicProfile> {
    const supabase = createScopedClient(accessToken);

    const [profileRes, listingCountRes, threadCountRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId),
      supabase
        .from('threads')
        .select('id', { count: 'exact', head: true })
        .eq('author_id', userId)
        .is('removed_at', null),
    ]);

    if (profileRes.error) {
      rethrowIfAuthError(profileRes.error);
      console.error('[users] public profile read failed', profileRes.error);
      throw ApiError.internal();
    }
    if (!profileRes.data) {
      throw ApiError.notFound('User not found.');
    }

    return this.toPublic(
      profileRes.data as ProfileRow,
      listingCountRes.count ?? 0,
      threadCountRes.count ?? 0,
    );
  }

  async setAvatarUrl(accessToken: string, avatarUrl: string | null): Promise<void> {
    const supabase = createScopedClient(accessToken);
    const { id } = await this.getIdentity(accessToken);

    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', id);
    if (error) {
      rethrowIfAuthError(error);
      console.error('[users] avatar url update failed', error);
      throw ApiError.internal('Could not save your avatar. Please try again.');
    }
  }

  async getNotificationPreferences(accessToken: string): Promise<NotificationPreferences> {
    const supabase = createScopedClient(accessToken);
    const { id } = await this.getIdentity(accessToken);

    const { data, error } = await supabase
      .from('user_settings')
      .select('notif_new_messages, notif_thread_replies')
      .eq('user_id', id)
      .maybeSingle();

    if (error) {
      rethrowIfAuthError(error);
      console.error('[users] notification prefs read failed', error);
      throw ApiError.internal();
    }

    const row = data as { notif_new_messages?: boolean; notif_thread_replies?: boolean } | null;
    // Defaults mirror the DB (`true`) when no settings row exists yet.
    return {
      newMessages: row?.notif_new_messages ?? true,
      threadReplies: row?.notif_thread_replies ?? true,
    };
  }

  async updateNotificationPreferences(
    accessToken: string,
    command: UpdateNotificationPreferencesCommand,
  ): Promise<NotificationPreferences> {
    const supabase = createScopedClient(accessToken);
    const { id } = await this.getIdentity(accessToken);

    const patch: Record<string, unknown> = {};
    if (command.newMessages !== undefined) patch.notif_new_messages = command.newMessages;
    if (command.threadReplies !== undefined) patch.notif_thread_replies = command.threadReplies;

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from('user_settings').update(patch).eq('user_id', id);
      if (error) {
        rethrowIfAuthError(error);
        console.error('[users] notification prefs update failed', error);
        throw ApiError.internal('Could not update your notification settings. Please try again.');
      }
    }

    return this.getNotificationPreferences(accessToken);
  }

  /** Shared mapping of the public columns + aggregate counts. */
  private toPublic(
    profile: ProfileRow,
    listingCount: number,
    threadCount: number,
  ): PublicProfile {
    return {
      id: profile.id,
      displayName: profile.display_name,
      bio: profile.bio,
      cyclingType: profile.cycling_type,
      avatarUrl: profile.avatar_url,
      displayArea: profile.display_area,
      areaLevel: profile.area_level,
      ratingAverage: profile.rating_average,
      listingCount,
      threadCount,
      createdAt: profile.created_at,
    };
  }
}
