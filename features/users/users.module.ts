/**
 * Composition root for the Users & profile feature — the one place that knows
 * concrete implementations. Wires the Supabase repository and the shared object
 * storage into the use-cases and exposes a ready controller. Route Handlers
 * import only `usersController`.
 */
import { getObjectStorage } from '@/shared/storage';
import { SupabaseUsersRepository } from './infrastructure/supabase-users.repository';
import { GetMeUseCase } from './application/get-me.usecase';
import { UpdateProfileUseCase } from './application/update-profile.usecase';
import { GetPublicProfileUseCase } from './application/get-public-profile.usecase';
import { IssueAvatarUploadUrlUseCase } from './application/issue-avatar-upload-url.usecase';
import { CommitAvatarUseCase } from './application/commit-avatar.usecase';
import { RemoveAvatarUseCase } from './application/remove-avatar.usecase';
import { GetNotificationPreferencesUseCase } from './application/get-notification-preferences.usecase';
import { UpdateNotificationPreferencesUseCase } from './application/update-notification-preferences.usecase';
import { UsersController } from './presentation/users.controller';

const repository = new SupabaseUsersRepository();
const storage = getObjectStorage();

export const usersController = new UsersController({
  getMe: new GetMeUseCase(repository),
  updateProfile: new UpdateProfileUseCase(repository),
  getPublicProfile: new GetPublicProfileUseCase(repository),
  issueAvatarUploadUrl: new IssueAvatarUploadUrlUseCase(repository, storage),
  commitAvatar: new CommitAvatarUseCase(repository, storage),
  removeAvatar: new RemoveAvatarUseCase(repository, storage),
  getNotificationPreferences: new GetNotificationPreferencesUseCase(repository),
  updateNotificationPreferences: new UpdateNotificationPreferencesUseCase(repository),
});
