/**
 * HTTP boundary for the Forum feature (API_CONTRACT.md §8, §9). Maps requests to
 * use-cases and results to responses — no business logic, no data access.
 * Use-cases are injected (wiring lives in `forum.module.ts`).
 */
import type { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, json, noContent } from '@/shared/http/responses';
import { ApiError } from '@/shared/http/api-error';
import { parseInput, readJsonBody } from '@/shared/validation/validate';
import { decodeCursor } from '@/shared/http/pagination';
import type { ListThreadsUseCase } from '../application/list-threads.usecase';
import type { CreateThreadUseCase } from '../application/create-thread.usecase';
import type { GetThreadUseCase } from '../application/get-thread.usecase';
import type { DeleteThreadUseCase } from '../application/delete-thread.usecase';
import type { UpvoteThreadUseCase } from '../application/upvote-thread.usecase';
import type { CommentsUseCase } from '../application/comments.usecase';
import type { BookmarkThreadsUseCase } from '../application/bookmark-threads.usecase';
import type { ListAuthorThreadsUseCase } from '../application/list-author-threads.usecase';
import {
  createCommentSchema,
  createThreadSchema,
  listQuerySchema,
  threadQuerySchema,
} from './forum.schemas';
import { toCommentDto, toThreadDto, toThreadListDto } from './forum.mapper';

export interface ForumUseCases {
  listThreads: ListThreadsUseCase;
  createThread: CreateThreadUseCase;
  getThread: GetThreadUseCase;
  deleteThread: DeleteThreadUseCase;
  upvote: UpvoteThreadUseCase;
  comments: CommentsUseCase;
  bookmarks: BookmarkThreadsUseCase;
  authorThreads: ListAuthorThreadsUseCase;
}

export class ForumController {
  constructor(private readonly useCases: ForumUseCases) {}

  /** GET /threads (CF-1/4/5). */
  async listThreads(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const params = parseInput(threadQuerySchema, Object.fromEntries(request.nextUrl.searchParams));
    const offset = decodeCursor(request.nextUrl.searchParams.get('cursor'));

    const page = await this.useCases.listThreads.execute(accessToken, {
      q: params.q,
      category: params.category,
      sort: params.sort,
      limit: params.limit,
      offset,
    });
    return json({ data: page.data.map(toThreadListDto), page: page.page }, 200);
  }

  /** POST /threads (CF-1). */
  async createThread(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const body = parseInput(createThreadSchema, await readJsonBody(request));
    const thread = await this.useCases.createThread.execute(accessToken, body);
    return json(toThreadDto(thread), 201);
  }

  /** GET /threads/{id} (CF-2). */
  async getThread(request: NextRequest, threadId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const thread = await this.useCases.getThread.execute(accessToken, threadId);
    return json(toThreadDto(thread), 200);
  }

  /** DELETE /threads/{id} (CF-1). */
  async deleteThread(request: NextRequest, threadId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    await this.useCases.deleteThread.execute(accessToken, threadId);
    return noContent();
  }

  /** PUT /threads/{id}/upvote (CF-3). */
  async upvote(request: NextRequest, threadId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const result = await this.useCases.upvote.add(accessToken, threadId);
    return json(result, 200);
  }

  /** DELETE /threads/{id}/upvote (CF-3). */
  async removeUpvote(request: NextRequest, threadId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const result = await this.useCases.upvote.remove(accessToken, threadId);
    return json(result, 200);
  }

  /** GET /threads/{id}/comments (CF-2). */
  async listComments(request: NextRequest, threadId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const { limit } = parseInput(listQuerySchema, Object.fromEntries(request.nextUrl.searchParams));
    const offset = decodeCursor(request.nextUrl.searchParams.get('cursor'));

    const page = await this.useCases.comments.list(accessToken, threadId, limit, offset);
    return json({ data: page.data.map(toCommentDto), page: page.page }, 200);
  }

  /** POST /threads/{id}/comments (CF-2). */
  async createComment(request: NextRequest, threadId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const body = parseInput(createCommentSchema, await readJsonBody(request));
    const comment = await this.useCases.comments.create(accessToken, threadId, body.body);
    return json(toCommentDto(comment), 201);
  }

  /** DELETE /comments/{id} (CF-2). */
  async deleteComment(request: NextRequest, commentId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    await this.useCases.comments.delete(accessToken, commentId);
    return noContent();
  }

  /** PUT /threads/{id}/bookmark (§9). */
  async bookmark(request: NextRequest, threadId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const result = await this.useCases.bookmarks.bookmark(accessToken, threadId);
    return json(result, 200);
  }

  /** DELETE /threads/{id}/bookmark (§9). */
  async removeBookmark(request: NextRequest, threadId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const result = await this.useCases.bookmarks.unbookmark(accessToken, threadId);
    return json(result, 200);
  }

  /** GET /users/{userId}/threads (CF-1, 13 Profile › Threads). */
  async listByAuthor(request: NextRequest, authorId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const { limit } = parseInput(listQuerySchema, Object.fromEntries(request.nextUrl.searchParams));
    const offset = decodeCursor(request.nextUrl.searchParams.get('cursor'));

    const page = await this.useCases.authorThreads.execute(accessToken, authorId, limit, offset);
    return json({ data: page.data.map(toThreadListDto), page: page.page }, 200);
  }

  /** GET /me/saved/threads (§9, 14 Saved › Threads). */
  async listSavedThreads(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const { limit } = parseInput(listQuerySchema, Object.fromEntries(request.nextUrl.searchParams));
    const offset = decodeCursor(request.nextUrl.searchParams.get('cursor'));

    const { page, count } = await this.useCases.bookmarks.list(accessToken, limit, offset);
    return json({ data: page.data.map(toThreadListDto), page: page.page, count }, 200);
  }

  private requireToken(request: NextRequest): string {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      throw ApiError.unauthenticated('You must be signed in to continue.');
    }
    return accessToken;
  }
}
