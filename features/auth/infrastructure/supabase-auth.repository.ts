/**
 * Supabase implementation of the `AuthRepository` port. This is the only layer
 * that talks to Supabase Auth (GoTrue) and the `profiles`/`user_settings`/
 * `user_locations` tables. RLS runs as the caller via a token-scoped client, so
 * precise coordinates are never read here (LP-1) — only `display_area`.
 */
import type { Session } from '@supabase/supabase-js';
import {
  createPublicClient,
  createScopedClient,
} from '@/shared/supabase/server-client';
import { getSupabaseConfig } from '@/shared/config/env';
import { ApiError } from '@/shared/http/api-error';
import type { AuthRepository } from '../domain/auth.repository';
import type {
  AccountSnapshot,
  AuthTokens,
  CyclingType,
  LoginCommand,
  RawSession,
  RegisterCommand,
  SelfUser,
  UserRole,
} from '../domain/auth.types';
import { mapAuthError } from './supabase-auth.errors';

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

export class SupabaseAuthRepository implements AuthRepository {
  async signUpWithPassword(command: RegisterCommand): Promise<RawSession> {
    const supabase = createPublicClient();
    const { data, error } = await supabase.auth.signUp({
      email: command.email,
      password: command.password,
      options: { data: { display_name: command.displayName } },
    });

    if (error) throw mapAuthError(error, 'register');

    // User created but no session => email confirmation is enabled on the
    // Supabase project. The contract (§3) expects immediate tokens on 201, so
    // confirmation must be disabled (Auth → Providers → Email → Confirm email).
    if (data.user && !data.session) {
      throw ApiError.unprocessable(
        'Account created but requires email confirmation. Disable "Confirm email" in Supabase Auth to issue tokens on register.',
      );
    }
    return this.toRawSession(data.session, data.user?.id);
  }

  async signInWithPassword(command: LoginCommand): Promise<RawSession> {
    const supabase = createPublicClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: command.email,
      password: command.password,
    });

    if (error) throw mapAuthError(error, 'login');
    return this.toRawSession(data.session, data.user?.id);
  }

  async signInWithGoogle(idToken: string): Promise<RawSession> {
    const supabase = createPublicClient();
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) throw mapAuthError(error, 'social');
    return this.toRawSession(data.session, data.user?.id);
  }

  async refreshSession(refreshToken: string): Promise<AuthTokens> {
    const supabase = createPublicClient();
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) throw mapAuthError(error, 'refresh');
    if (!data.session) throw ApiError.unauthenticated('Refresh token is invalid or expired.');
    return this.toTokens(data.session);
  }

  async revokeSession(accessToken: string): Promise<void> {
    // GoTrue's logout endpoint revokes the session for the given access token.
    // We call it directly (rather than via a stored session) because this API is
    // stateless — `scope=global` invalidates the user's refresh tokens.
    const { url, key } = getSupabaseConfig();
    const response = await fetch(`${url}/auth/v1/logout?scope=global`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.status === 401) {
      throw ApiError.unauthenticated('Access token is invalid or expired.');
    }
    if (!response.ok && response.status !== 204) {
      throw ApiError.internal('Could not complete logout.');
    }
  }

  async getAccountSnapshot(session: RawSession): Promise<AccountSnapshot> {
    const supabase = createScopedClient(session.tokens.accessToken);
    const userId = session.userId;

    // Email lives in auth.users; read it with the access token.
    const { data: authUser } = await supabase.auth.getUser(session.tokens.accessToken);

    const [profileRes, settingsRes, listingCountRes, threadCountRes, locationRes] =
      await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase
          .from('user_settings')
          .select('contact_preference')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('listings')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', userId),
        supabase
          .from('threads')
          .select('id', { count: 'exact', head: true })
          .eq('author_id', userId)
          .is('removed_at', null),
        supabase
          .from('user_locations')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

    if (profileRes.error || !profileRes.data) {
      throw ApiError.internal('Account profile is not available yet.');
    }

    const profile = profileRes.data as ProfileRow;
    const hasPin = Boolean(locationRes.data);

    const user: SelfUser = {
      id: profile.id,
      email: authUser.user?.email ?? '',
      displayName: profile.display_name,
      bio: profile.bio,
      cyclingType: profile.cycling_type,
      avatarUrl: profile.avatar_url,
      contactPreference: settingsRes.data?.contact_preference ?? 'in_app_chat',
      displayArea: profile.display_area,
      areaLevel: profile.area_level,
      ratingAverage: profile.rating_average,
      listingCount: listingCountRes.count ?? 0,
      threadCount: threadCountRes.count ?? 0,
      role: profile.role,
      createdAt: profile.created_at,
    };

    return {
      user,
      onboarding: {
        // Fresh accounts haven't picked a cycling type (03 Profile setup) …
        needsProfileSetup: profile.cycling_type === null,
        // … nor dropped a location pin (04 Set location).
        needsLocation: !hasPin,
      },
    };
  }

  private toRawSession(session: Session | null, userId: string | undefined): RawSession {
    // With email confirmation disabled (MVP), register/login return a session
    // immediately (API_CONTRACT.md §3 returns tokens on 201/200).
    if (!session || !userId) {
      throw ApiError.internal('Authentication provider returned no session.');
    }
    return { userId, tokens: this.toTokens(session) };
  }

  private toTokens(session: Session): AuthTokens {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
    };
  }
}
