/**
 * Feature requests (FB-3) — the "Vote on what we build next" board: list,
 * propose, and toggle a vote (one per user). `list` owns cursor pagination.
 */
import { buildPage, type Page } from '@/shared/http/pagination';
import type { FeatureRequestSort, FeedbackRepository } from '../domain/feedback.repository';
import type {
  CreateFeatureRequestCommand,
  FeatureRequest,
  VoteResult,
} from '../domain/feedback.types';

export class FeatureRequestsUseCase {
  constructor(private readonly repo: FeedbackRepository) {}

  /** GET /feature-requests?sort=top|new — paginated. */
  async list(
    accessToken: string,
    sort: FeatureRequestSort,
    limit: number,
    offset: number,
  ): Promise<Page<FeatureRequest>> {
    const rows = await this.repo.listFeatureRequests(accessToken, sort, limit + 1, offset);
    return buildPage(rows, limit, offset);
  }

  /** POST /feature-requests. */
  create(accessToken: string, command: CreateFeatureRequestCommand): Promise<FeatureRequest> {
    return this.repo.createFeatureRequest(accessToken, command);
  }

  /** PUT /feature-requests/{id}/vote. */
  vote(accessToken: string, requestId: string): Promise<VoteResult> {
    return this.repo.setVote(accessToken, requestId, true);
  }

  /** DELETE /feature-requests/{id}/vote. */
  unvote(accessToken: string, requestId: string): Promise<VoteResult> {
    return this.repo.setVote(accessToken, requestId, false);
  }
}
