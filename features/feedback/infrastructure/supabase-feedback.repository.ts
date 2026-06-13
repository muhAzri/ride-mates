/**
 * Supabase implementation of the `FeedbackRepository` port. Feedback is inserted
 * as the caller (RLS `user_id = auth.uid()`); feature requests are public-read /
 * propose-self with trigger-managed vote counts; changelog is public-read. The
 * screenshot bytes are uploaded by the use-case; only the URL is persisted here.
 */
import { createScopedClient } from '@/shared/supabase/server-client';
import { rethrowIfAuthError } from '@/shared/supabase/errors';
import { ApiError } from '@/shared/http/api-error';
import type { FeatureRequestSort, FeedbackRepository } from '../domain/feedback.repository';
import type {
  ChangelogEntry,
  CreateFeatureRequestCommand,
  CreateFeedbackCommand,
  FeatureRequest,
  FeatureRequestStatus,
  FeedbackReceipt,
  VoteResult,
} from '../domain/feedback.types';

type ScopedClient = ReturnType<typeof createScopedClient>;

interface FeatureRequestRow {
  id: string;
  title: string;
  description: string | null;
  status: FeatureRequestStatus;
  vote_count: number | string;
  created_at: string;
}

interface ChangelogRow {
  version: string;
  released_on: string;
  title: string;
  items: string[] | null;
}

export class SupabaseFeedbackRepository implements FeedbackRepository {
  async getUserId(accessToken: string): Promise<string> {
    const supabase = createScopedClient(accessToken);
    return this.requireUserId(supabase, accessToken);
  }

  async submitFeedback(
    accessToken: string,
    command: CreateFeedbackCommand,
  ): Promise<FeedbackReceipt> {
    const supabase = createScopedClient(accessToken);
    const userId = await this.requireUserId(supabase, accessToken);

    const { data, error } = await supabase
      .from('feedback')
      .insert({
        user_id: userId,
        type: command.type,
        message: command.message,
        screenshot_url: command.screenshotUrl,
        include_app_info: command.includeAppInfo,
        app_version: command.appInfo.appVersion,
        platform: command.appInfo.platform,
        os_version: command.appInfo.osVersion,
        device_model: command.appInfo.deviceModel,
      })
      .select('id, status')
      .single();

    if (error || !data) {
      rethrowIfAuthError(error);
      console.error('[feedback] submit failed', error);
      throw ApiError.internal('Could not send your feedback. Please try again.');
    }

    const row = data as { id: string; status: string };
    return { id: row.id, status: row.status };
  }

  async listFeatureRequests(
    accessToken: string,
    sort: FeatureRequestSort,
    limit: number,
    offset: number,
  ): Promise<FeatureRequest[]> {
    const supabase = createScopedClient(accessToken);

    let qb = supabase
      .from('feature_requests')
      .select('id, title, description, status, vote_count, created_at');
    qb =
      sort === 'top'
        ? qb.order('vote_count', { ascending: false }).order('created_at', { ascending: false })
        : qb.order('created_at', { ascending: false });

    const { data, error } = await qb.range(offset, offset + limit - 1);
    if (error) {
      rethrowIfAuthError(error);
      console.error('[feedback] list feature requests failed', error);
      throw ApiError.internal('Could not load feature requests. Please try again.');
    }

    const rows = (data ?? []) as FeatureRequestRow[];
    const votedIds = await this.votedAmong(
      supabase,
      rows.map((r) => r.id),
    );
    return rows.map((row) => toFeatureRequest(row, votedIds.has(row.id)));
  }

  async createFeatureRequest(
    accessToken: string,
    command: CreateFeatureRequestCommand,
  ): Promise<FeatureRequest> {
    const supabase = createScopedClient(accessToken);
    const userId = await this.requireUserId(supabase, accessToken);

    const { data, error } = await supabase
      .from('feature_requests')
      .insert({ author_id: userId, title: command.title, description: command.description ?? null })
      .select('id, title, description, status, vote_count, created_at')
      .single();

    if (error || !data) {
      rethrowIfAuthError(error);
      console.error('[feedback] create feature request failed', error);
      throw ApiError.internal('Could not submit your feature request. Please try again.');
    }

    return toFeatureRequest(data as FeatureRequestRow, false);
  }

  async setVote(accessToken: string, requestId: string, on: boolean): Promise<VoteResult> {
    const supabase = createScopedClient(accessToken);
    const userId = await this.requireUserId(supabase, accessToken);

    if (on) {
      const { error } = await supabase
        .from('feature_request_votes')
        .upsert(
          { request_id: requestId, user_id: userId },
          { onConflict: 'request_id,user_id', ignoreDuplicates: true },
        );
      if (error) throw this.mapVoteError(error);
    } else {
      const { error } = await supabase
        .from('feature_request_votes')
        .delete()
        .eq('request_id', requestId)
        .eq('user_id', userId);
      if (error) throw this.mapVoteError(error);
    }

    const { data, error } = await supabase
      .from('feature_requests')
      .select('vote_count')
      .eq('id', requestId)
      .maybeSingle();
    if (error) {
      rethrowIfAuthError(error);
      console.error('[feedback] vote count read failed', error);
      throw ApiError.internal();
    }
    if (!data) throw ApiError.notFound('Feature request not found.');

    return {
      voteCount: Number((data as { vote_count: number | string }).vote_count),
      isVotedByMe: on,
    };
  }

  async listChangelog(accessToken: string): Promise<ChangelogEntry[]> {
    const supabase = createScopedClient(accessToken);

    const { data, error } = await supabase
      .from('changelog_entries')
      .select('version, released_on, title, items')
      .order('released_on', { ascending: false });

    if (error) {
      rethrowIfAuthError(error);
      console.error('[feedback] changelog read failed', error);
      throw ApiError.internal('Could not load the changelog. Please try again.');
    }

    return (data as ChangelogRow[]).map((row) => ({
      version: row.version,
      date: row.released_on,
      title: row.title,
      items: row.items ?? [],
    }));
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private async requireUserId(supabase: ScopedClient, accessToken: string): Promise<string> {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data.user) {
      throw ApiError.unauthenticated('Your session has expired. Please sign in again.');
    }
    return data.user.id;
  }

  private async votedAmong(supabase: ScopedClient, ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const { data, error } = await supabase
      .from('feature_request_votes')
      .select('request_id')
      .in('request_id', ids);
    if (error) {
      rethrowIfAuthError(error);
      console.error('[feedback] votes lookup failed', error);
      return new Set();
    }
    return new Set((data as Array<{ request_id: string }>).map((r) => r.request_id));
  }

  private mapVoteError(error: { code?: string } | null): ApiError {
    rethrowIfAuthError(error as Parameters<typeof rethrowIfAuthError>[0]);
    if (error?.code === '23503') return ApiError.notFound('Feature request not found.');
    console.error('[feedback] vote toggle failed', error);
    return ApiError.internal('Could not update your vote. Please try again.');
  }
}

function toFeatureRequest(row: FeatureRequestRow, isVotedByMe: boolean): FeatureRequest {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    voteCount: Number(row.vote_count),
    status: row.status,
    isVotedByMe,
    createdAt: row.created_at,
  };
}
