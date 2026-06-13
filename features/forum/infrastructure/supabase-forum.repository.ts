/**
 * Supabase implementation of the `ForumRepository` port. The only layer that
 * talks to the forum tables. Everything goes through a token-scoped client so RLS
 * / `auth.uid()` run as the caller — removed threads/comments are hidden from
 * non-owners structurally. Denormalized counts and the NT-2 reply notification
 * are maintained by DB triggers, so they are never computed here. The author
 * mini-card is fetched with a PostgREST embed on `profiles` (public-read).
 */
import { createScopedClient } from '@/shared/supabase/server-client';
import { rethrowIfAuthError } from '@/shared/supabase/errors';
import { ApiError } from '@/shared/http/api-error';
import type {
  CommentOwnership,
  ForumRepository,
  SavedThreadsResult,
  ThreadOwnership,
} from '../domain/forum.repository';
import type {
  AuthorMini,
  Comment,
  CreateThreadCommand,
  CyclingType,
  Thread,
  ThreadCategory,
  ThreadQuery,
  UpvoteResult,
} from '../domain/forum.types';

type ScopedClient = ReturnType<typeof createScopedClient>;

const AUTHOR_EMBED = 'author:profiles!author_id(id, display_name, avatar_url, cycling_type, rating_average)';
const THREAD_SELECT =
  `id, author_id, title, body, category, upvote_count, comment_count, created_at, ${AUTHOR_EMBED}`;
const COMMENT_SELECT = `id, thread_id, body, created_at, ${AUTHOR_EMBED}`;

interface AuthorRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  cycling_type: CyclingType | null;
  rating_average: number | string | null;
}

interface ThreadRow {
  id: string;
  author_id: string;
  title: string;
  body: string;
  category: ThreadCategory | null;
  upvote_count: number | string;
  comment_count: number | string;
  created_at: string;
  author: AuthorRow | AuthorRow[] | null;
}

interface CommentRow {
  id: string;
  thread_id: string;
  body: string;
  created_at: string;
  author: AuthorRow | AuthorRow[] | null;
}

export class SupabaseForumRepository implements ForumRepository {
  async getViewer(accessToken: string): Promise<{ id: string; isAdmin: boolean }> {
    const supabase = createScopedClient(accessToken);
    const id = await this.requireUserId(supabase, accessToken);
    const { data } = await supabase.from('profiles').select('role').eq('id', id).maybeSingle();
    return { id, isAdmin: (data as { role?: string } | null)?.role === 'admin' };
  }

  async listThreads(accessToken: string, query: ThreadQuery): Promise<Thread[]> {
    const supabase = createScopedClient(accessToken);

    let qb = supabase.from('threads').select(THREAD_SELECT).is('removed_at', null);

    const term = query.q ? sanitizeLike(query.q) : '';
    if (term) qb = qb.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
    if (query.category) qb = qb.eq('category', query.category);

    qb =
      query.sort === 'top'
        ? qb.order('upvote_count', { ascending: false }).order('created_at', { ascending: false })
        : qb.order('created_at', { ascending: false });

    const { data, error } = await qb.range(query.offset, query.offset + query.limit - 1);
    if (error) {
      rethrowIfAuthError(error);
      console.error('[forum] list threads failed', error);
      throw ApiError.internal('Could not load the forum. Please try again.');
    }

    const rows = (data ?? []) as ThreadRow[];
    const ids = rows.map((r) => r.id);
    const [upvoted, bookmarked] = await Promise.all([
      this.flaggedAmong(supabase, 'thread_upvotes', ids),
      this.flaggedAmong(supabase, 'thread_bookmarks', ids),
    ]);

    return rows.map((row) => toThread(row, upvoted.has(row.id), bookmarked.has(row.id)));
  }

  async listByAuthor(
    accessToken: string,
    authorId: string,
    limit: number,
    offset: number,
  ): Promise<Thread[]> {
    const supabase = createScopedClient(accessToken);

    const { data, error } = await supabase
      .from('threads')
      .select(THREAD_SELECT)
      .eq('author_id', authorId)
      .is('removed_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      rethrowIfAuthError(error);
      console.error('[forum] list by author failed', error);
      throw ApiError.internal("Could not load the user's threads. Please try again.");
    }

    const rows = (data ?? []) as ThreadRow[];
    const ids = rows.map((r) => r.id);
    const [upvoted, bookmarked] = await Promise.all([
      this.flaggedAmong(supabase, 'thread_upvotes', ids),
      this.flaggedAmong(supabase, 'thread_bookmarks', ids),
    ]);
    return rows.map((row) => toThread(row, upvoted.has(row.id), bookmarked.has(row.id)));
  }

  async createThread(accessToken: string, command: CreateThreadCommand): Promise<Thread> {
    const supabase = createScopedClient(accessToken);
    const userId = await this.requireUserId(supabase, accessToken);

    const { data, error } = await supabase
      .from('threads')
      .insert({
        author_id: userId,
        title: command.title,
        body: command.body,
        category: command.category ?? null,
      })
      .select(THREAD_SELECT)
      .single();

    if (error || !data) {
      rethrowIfAuthError(error);
      console.error('[forum] create thread failed', error);
      throw ApiError.internal('Could not create your thread. Please try again.');
    }

    return toThread(data as ThreadRow, false, false);
  }

  async getThread(accessToken: string, threadId: string): Promise<Thread | null> {
    const supabase = createScopedClient(accessToken);

    const { data, error } = await supabase
      .from('threads')
      .select(THREAD_SELECT)
      .eq('id', threadId)
      .maybeSingle();

    if (error) {
      rethrowIfAuthError(error);
      console.error('[forum] get thread failed', error);
      throw ApiError.internal('Could not load the thread. Please try again.');
    }
    if (!data) return null;

    const [upvoted, bookmarked] = await Promise.all([
      this.flaggedAmong(supabase, 'thread_upvotes', [threadId]),
      this.flaggedAmong(supabase, 'thread_bookmarks', [threadId]),
    ]);
    return toThread(data as ThreadRow, upvoted.has(threadId), bookmarked.has(threadId));
  }

  async getThreadOwnership(
    accessToken: string,
    threadId: string,
  ): Promise<ThreadOwnership | null> {
    const supabase = createScopedClient(accessToken);
    const { data, error } = await supabase
      .from('threads')
      .select('author_id, removed_at')
      .eq('id', threadId)
      .maybeSingle();

    if (error) {
      rethrowIfAuthError(error);
      console.error('[forum] thread ownership read failed', error);
      throw ApiError.internal();
    }
    if (!data) return null;

    const row = data as { author_id: string; removed_at: string | null };
    return { authorId: row.author_id, isRemoved: row.removed_at !== null };
  }

  async deleteThread(accessToken: string, threadId: string): Promise<void> {
    const supabase = createScopedClient(accessToken);
    const { error } = await supabase.from('threads').delete().eq('id', threadId);
    if (error) {
      rethrowIfAuthError(error);
      console.error('[forum] delete thread failed', error);
      throw ApiError.internal('Could not delete your thread. Please try again.');
    }
  }

  async setUpvote(accessToken: string, threadId: string, on: boolean): Promise<UpvoteResult> {
    const supabase = createScopedClient(accessToken);
    const userId = await this.requireUserId(supabase, accessToken);

    if (on) {
      const { error } = await supabase
        .from('thread_upvotes')
        .upsert(
          { thread_id: threadId, user_id: userId },
          { onConflict: 'thread_id,user_id', ignoreDuplicates: true },
        );
      if (error) throw this.mapToggleError(error, 'upvote');
    } else {
      const { error } = await supabase
        .from('thread_upvotes')
        .delete()
        .eq('thread_id', threadId)
        .eq('user_id', userId);
      if (error) throw this.mapToggleError(error, 'upvote');
    }

    const { data, error } = await supabase
      .from('threads')
      .select('upvote_count')
      .eq('id', threadId)
      .maybeSingle();
    if (error) {
      rethrowIfAuthError(error);
      console.error('[forum] upvote count read failed', error);
      throw ApiError.internal();
    }
    if (!data) throw ApiError.notFound('Thread not found.');

    return { upvoteCount: Number((data as { upvote_count: number | string }).upvote_count), isUpvotedByMe: on };
  }

  async setBookmark(accessToken: string, threadId: string, on: boolean): Promise<void> {
    const supabase = createScopedClient(accessToken);
    const userId = await this.requireUserId(supabase, accessToken);

    if (on) {
      const { error } = await supabase
        .from('thread_bookmarks')
        .upsert(
          { thread_id: threadId, user_id: userId },
          { onConflict: 'thread_id,user_id', ignoreDuplicates: true },
        );
      if (error) throw this.mapToggleError(error, 'bookmark');
    } else {
      const { error } = await supabase
        .from('thread_bookmarks')
        .delete()
        .eq('thread_id', threadId)
        .eq('user_id', userId);
      if (error) throw this.mapToggleError(error, 'bookmark');
    }
  }

  async listBookmarkedThreads(
    accessToken: string,
    limit: number,
    offset: number,
  ): Promise<SavedThreadsResult> {
    const supabase = createScopedClient(accessToken);
    const userId = await this.requireUserId(supabase, accessToken);

    const { data: bookmarks, count, error } = await supabase
      .from('thread_bookmarks')
      .select('thread_id, created_at', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      rethrowIfAuthError(error);
      console.error('[forum] bookmarks read failed', error);
      throw ApiError.internal('Could not load your saved threads. Please try again.');
    }

    const ids = (bookmarks as Array<{ thread_id: string }>).map((b) => b.thread_id);
    if (ids.length === 0) return { items: [], totalCount: count ?? 0 };

    const { data: threadsData, error: threadsError } = await supabase
      .from('threads')
      .select(THREAD_SELECT)
      .in('id', ids)
      .is('removed_at', null);
    if (threadsError) {
      rethrowIfAuthError(threadsError);
      console.error('[forum] bookmarked threads read failed', threadsError);
      throw ApiError.internal();
    }

    const byId = new Map((threadsData as ThreadRow[]).map((t) => [t.id, t]));
    const upvoted = await this.flaggedAmong(supabase, 'thread_upvotes', ids);

    // Preserve bookmark order; a bookmarked-then-removed thread drops out.
    const items = ids
      .map((id) => byId.get(id))
      .filter((row): row is ThreadRow => Boolean(row))
      .map((row) => toThread(row, upvoted.has(row.id), true));

    return { items, totalCount: count ?? 0 };
  }

  async listComments(
    accessToken: string,
    threadId: string,
    limit: number,
    offset: number,
  ): Promise<Comment[]> {
    const supabase = createScopedClient(accessToken);

    const { data, error } = await supabase
      .from('comments')
      .select(COMMENT_SELECT)
      .eq('thread_id', threadId)
      .is('removed_at', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      rethrowIfAuthError(error);
      console.error('[forum] list comments failed', error);
      throw ApiError.internal('Could not load the comments. Please try again.');
    }

    return (data as CommentRow[]).map(toComment);
  }

  async createComment(accessToken: string, threadId: string, body: string): Promise<Comment> {
    const supabase = createScopedClient(accessToken);
    const userId = await this.requireUserId(supabase, accessToken);

    const { data, error } = await supabase
      .from('comments')
      .insert({ thread_id: threadId, author_id: userId, body })
      .select(COMMENT_SELECT)
      .single();

    if (error || !data) {
      rethrowIfAuthError(error);
      if (error?.code === '23503') throw ApiError.notFound('Thread not found.');
      console.error('[forum] create comment failed', error);
      throw ApiError.internal('Could not post your comment. Please try again.');
    }

    return toComment(data as CommentRow);
  }

  async getCommentOwnership(
    accessToken: string,
    commentId: string,
  ): Promise<CommentOwnership | null> {
    const supabase = createScopedClient(accessToken);
    const { data, error } = await supabase
      .from('comments')
      .select('author_id, removed_at')
      .eq('id', commentId)
      .maybeSingle();

    if (error) {
      rethrowIfAuthError(error);
      console.error('[forum] comment ownership read failed', error);
      throw ApiError.internal();
    }
    if (!data) return null;

    const row = data as { author_id: string; removed_at: string | null };
    return { authorId: row.author_id, isRemoved: row.removed_at !== null };
  }

  async deleteComment(accessToken: string, commentId: string): Promise<void> {
    const supabase = createScopedClient(accessToken);
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) {
      rethrowIfAuthError(error);
      console.error('[forum] delete comment failed', error);
      throw ApiError.internal('Could not delete your comment. Please try again.');
    }
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private async requireUserId(supabase: ScopedClient, accessToken: string): Promise<string> {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data.user) {
      throw ApiError.unauthenticated('Your session has expired. Please sign in again.');
    }
    return data.user.id;
  }

  /**
   * Which of the given thread ids the caller has a row for in a membership table
   * (`thread_upvotes`/`thread_bookmarks`). RLS scopes those tables to the caller,
   * so a plain `in (ids)` already returns only the caller's rows.
   */
  private async flaggedAmong(
    supabase: ScopedClient,
    table: 'thread_upvotes' | 'thread_bookmarks',
    ids: string[],
  ): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const { data, error } = await supabase.from(table).select('thread_id').in('thread_id', ids);
    if (error) {
      rethrowIfAuthError(error);
      console.error(`[forum] ${table} lookup failed`, error);
      return new Set(); // non-fatal: render without the flag
    }
    return new Set((data as Array<{ thread_id: string }>).map((r) => r.thread_id));
  }

  /** Map an upvote/bookmark toggle error: missing thread → 404, else 500. */
  private mapToggleError(error: { code?: string } | null, what: string): ApiError {
    rethrowIfAuthError(error as Parameters<typeof rethrowIfAuthError>[0]);
    if (error?.code === '23503') return ApiError.notFound('Thread not found.');
    console.error(`[forum] ${what} toggle failed`, error);
    return ApiError.internal('Could not update. Please try again.');
  }
}

/** Strip PostgREST `or()` structural chars and LIKE wildcards from a search term. */
function sanitizeLike(q: string): string {
  return q.replace(/[%_,()*\\]/g, ' ').trim();
}

function normalizeAuthor(raw: AuthorRow | AuthorRow[] | null): AuthorMini {
  const a = Array.isArray(raw) ? raw[0] : raw;
  if (!a) {
    return { id: '', displayName: '', avatarUrl: null, cyclingType: null, ratingAverage: null };
  }
  return {
    id: a.id,
    displayName: a.display_name,
    avatarUrl: a.avatar_url,
    cyclingType: a.cycling_type,
    ratingAverage: a.rating_average === null ? null : Number(a.rating_average),
  };
}

function toThread(row: ThreadRow, isUpvotedByMe: boolean, isBookmarkedByMe: boolean): Thread {
  return {
    id: row.id,
    author: normalizeAuthor(row.author),
    title: row.title,
    body: row.body,
    category: row.category,
    upvoteCount: Number(row.upvote_count),
    commentCount: Number(row.comment_count),
    isUpvotedByMe,
    isBookmarkedByMe,
    createdAt: row.created_at,
  };
}

function toComment(row: CommentRow): Comment {
  return {
    id: row.id,
    threadId: row.thread_id,
    author: normalizeAuthor(row.author),
    body: row.body,
    createdAt: row.created_at,
  };
}
