/**
 * GET /changelog (§12.5) — released "What's new" entries, newest first.
 */
import type { FeedbackRepository } from '../domain/feedback.repository';
import type { ChangelogEntry } from '../domain/feedback.types';

export class GetChangelogUseCase {
  constructor(private readonly repo: FeedbackRepository) {}

  execute(accessToken: string): Promise<ChangelogEntry[]> {
    return this.repo.listChangelog(accessToken);
  }
}
