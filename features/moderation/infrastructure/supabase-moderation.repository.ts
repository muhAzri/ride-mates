/**
 * Supabase implementation of the `ModerationRepository` port. Reports are
 * inserted as the caller (RLS `reporter_id = auth.uid()`); blocks are owner-
 * managed (RLS `blocker_id = auth.uid()`). The blocked user's public mini is
 * fetched with a PostgREST embed on `profiles` (public-read).
 */
import { createScopedClient } from '@/shared/supabase/server-client';
import { rethrowIfAuthError } from '@/shared/supabase/errors';
import { ApiError } from '@/shared/http/api-error';
import type { ModerationRepository } from '../domain/moderation.repository';
import type {
  BlockedUser,
  CreateReportCommand,
  CyclingType,
  ReportReceipt,
  ReportStatus,
} from '../domain/moderation.types';

type ScopedClient = ReturnType<typeof createScopedClient>;

const BLOCKED_EMBED = 'blocked:profiles!blocked_id(id, display_name, avatar_url, cycling_type, rating_average)';

interface BlockedProfileRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  cycling_type: CyclingType | null;
  rating_average: number | string | null;
}

interface BlockRow {
  created_at: string;
  blocked: BlockedProfileRow | BlockedProfileRow[] | null;
}

export class SupabaseModerationRepository implements ModerationRepository {
  async createReport(accessToken: string, command: CreateReportCommand): Promise<ReportReceipt> {
    const supabase = createScopedClient(accessToken);
    const reporterId = await this.requireUserId(supabase, accessToken);

    const { data, error } = await supabase
      .from('reports')
      .insert({
        reporter_id: reporterId,
        target_type: command.targetType,
        target_id: command.targetId,
        reason: command.reason,
        details: command.details ?? null,
      })
      .select('id, status')
      .single();

    if (error || !data) {
      rethrowIfAuthError(error);
      // DB backstop for the "something_else needs details" check.
      if (error?.code === '23514') {
        throw ApiError.validation('Some fields need your attention.', {
          details: 'Please describe the problem.',
        });
      }
      console.error('[moderation] create report failed', error);
      throw ApiError.internal('Could not submit your report. Please try again.');
    }

    const row = data as { id: string; status: ReportStatus };
    return { id: row.id, status: row.status };
  }

  async listBlocks(accessToken: string): Promise<BlockedUser[]> {
    const supabase = createScopedClient(accessToken);

    const { data, error } = await supabase
      .from('blocks')
      .select(`created_at, ${BLOCKED_EMBED}`)
      .order('created_at', { ascending: false });

    if (error) {
      rethrowIfAuthError(error);
      console.error('[moderation] list blocks failed', error);
      throw ApiError.internal('Could not load your blocked users. Please try again.');
    }

    return (data as BlockRow[])
      .map((row) => {
        const p = Array.isArray(row.blocked) ? row.blocked[0] : row.blocked;
        if (!p) return null;
        return {
          id: p.id,
          displayName: p.display_name,
          avatarUrl: p.avatar_url,
          cyclingType: p.cycling_type,
          ratingAverage: p.rating_average === null ? null : Number(p.rating_average),
          blockedAt: row.created_at,
        } satisfies BlockedUser;
      })
      .filter((u): u is BlockedUser => u !== null);
  }

  async block(accessToken: string, userId: string): Promise<void> {
    const supabase = createScopedClient(accessToken);
    const blockerId = await this.requireUserId(supabase, accessToken);

    if (userId === blockerId) {
      throw ApiError.unprocessable('You cannot block yourself.', { userId: 'Invalid target.' });
    }

    const { error } = await supabase
      .from('blocks')
      .upsert(
        { blocker_id: blockerId, blocked_id: userId },
        { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
      );

    if (error) {
      rethrowIfAuthError(error);
      if (error.code === '23503') throw ApiError.notFound('User not found.');
      if (error.code === '23514') {
        throw ApiError.unprocessable('You cannot block yourself.', { userId: 'Invalid target.' });
      }
      console.error('[moderation] block failed', error);
      throw ApiError.internal('Could not block the user. Please try again.');
    }
  }

  async unblock(accessToken: string, userId: string): Promise<void> {
    const supabase = createScopedClient(accessToken);
    const blockerId = await this.requireUserId(supabase, accessToken);

    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', userId);

    if (error) {
      rethrowIfAuthError(error);
      console.error('[moderation] unblock failed', error);
      throw ApiError.internal('Could not unblock the user. Please try again.');
    }
  }

  private async requireUserId(supabase: ScopedClient, accessToken: string): Promise<string> {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data.user) {
      throw ApiError.unauthenticated('Your session has expired. Please sign in again.');
    }
    return data.user.id;
  }
}
