/**
 * Feedback data port (Dependency Inversion). The Supabase adapter implements it.
 * Feedback is insert-self; feature requests are public-read / propose-self with
 * trigger-managed vote counts; changelog is public-read.
 */
import type {
  ChangelogEntry,
  CreateFeatureRequestCommand,
  CreateFeedbackCommand,
  FeatureRequest,
  FeedbackReceipt,
  VoteResult,
} from './feedback.types';

export type FeatureRequestSort = 'top' | 'new';

export interface FeedbackRepository {
  /** Resolve the caller's user id (used to key an uploaded screenshot). */
  getUserId(accessToken: string): Promise<string>;

  /** Persist a feedback submission (FB-2). Must not be silently lost. */
  submitFeedback(accessToken: string, command: CreateFeedbackCommand): Promise<FeedbackReceipt>;

  /** List the feature-request board (FB-3). Fetches `limit` rows. */
  listFeatureRequests(
    accessToken: string,
    sort: FeatureRequestSort,
    limit: number,
    offset: number,
  ): Promise<FeatureRequest[]>;

  /** Propose a feature request (FB-3). */
  createFeatureRequest(
    accessToken: string,
    command: CreateFeatureRequestCommand,
  ): Promise<FeatureRequest>;

  /** Toggle the caller's vote (FB-3). Returns the persisted count + my state. */
  setVote(accessToken: string, requestId: string, on: boolean): Promise<VoteResult>;

  /** Released changelog entries, newest first (§12.5). */
  listChangelog(accessToken: string): Promise<ChangelogEntry[]>;
}
