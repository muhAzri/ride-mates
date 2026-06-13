/**
 * POST /threads (CF-1) — start a discussion. Shape is validated at the boundary;
 * this just forwards the command. The new thread appears in the forum list.
 */
import type { ForumRepository } from '../domain/forum.repository';
import type { CreateThreadCommand, Thread } from '../domain/forum.types';

export class CreateThreadUseCase {
  constructor(private readonly repo: ForumRepository) {}

  execute(accessToken: string, command: CreateThreadCommand): Promise<Thread> {
    return this.repo.createThread(accessToken, command);
  }
}
