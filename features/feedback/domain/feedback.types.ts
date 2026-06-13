/**
 * Feedback / feature-request / changelog domain models (API_CONTRACT.md §13,
 * §12.5; FSD FB-2/FB-3). "Report a bug" is merged into one Send-feedback form
 * (design R4) with a Type chip. Feature requests are a public, votable board.
 */

export type FeedbackType = 'bug' | 'idea' | 'other';
export type FeatureRequestStatus = 'open' | 'planned' | 'in_progress' | 'shipped';

/** Optional app diagnostics, attached only when the user opts in (`includeAppInfo`). */
export interface AppInfo {
  appVersion: string | null;
  platform: string | null;
  osVersion: string | null;
  deviceModel: string | null;
}

export interface CreateFeedbackCommand {
  type: FeedbackType;
  message: string;
  includeAppInfo: boolean;
  appInfo: AppInfo;
  /** Public URL of an uploaded screenshot (the use-case stores it first). */
  screenshotUrl: string | null;
}

/** What the client gets back after sending feedback (§13). */
export interface FeedbackReceipt {
  id: string;
  status: string;
}

/** A feature-request board item (§13, FB-3). */
export interface FeatureRequest {
  id: string;
  title: string;
  description: string | null;
  voteCount: number;
  status: FeatureRequestStatus;
  isVotedByMe: boolean;
  createdAt: string;
}

export interface CreateFeatureRequestCommand {
  title: string;
  description?: string;
}

/** Result of toggling a feature-request vote. */
export interface VoteResult {
  voteCount: number;
  isVotedByMe: boolean;
}

/** A released changelog entry — "What's new" (§12.5, Settings 16). */
export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  items: string[];
}
