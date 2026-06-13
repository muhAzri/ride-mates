/**
 * Composition root for the Forum feature — the one place that knows concrete
 * implementations. Wires the Supabase repository into the use-cases (threads,
 * comments, upvotes, bookmarks) and exposes a ready controller. Route Handlers
 * import only `forumController`.
 */
import { SupabaseForumRepository } from './infrastructure/supabase-forum.repository';
import { ListThreadsUseCase } from './application/list-threads.usecase';
import { CreateThreadUseCase } from './application/create-thread.usecase';
import { GetThreadUseCase } from './application/get-thread.usecase';
import { DeleteThreadUseCase } from './application/delete-thread.usecase';
import { UpvoteThreadUseCase } from './application/upvote-thread.usecase';
import { CommentsUseCase } from './application/comments.usecase';
import { BookmarkThreadsUseCase } from './application/bookmark-threads.usecase';
import { ForumController } from './presentation/forum.controller';

const repository = new SupabaseForumRepository();

export const forumController = new ForumController({
  listThreads: new ListThreadsUseCase(repository),
  createThread: new CreateThreadUseCase(repository),
  getThread: new GetThreadUseCase(repository),
  deleteThread: new DeleteThreadUseCase(repository),
  upvote: new UpvoteThreadUseCase(repository),
  comments: new CommentsUseCase(repository),
  bookmarks: new BookmarkThreadsUseCase(repository),
});
