// PUT/DELETE /api/v1/users/me/avatar — UA-4 (auth required) (API_CONTRACT.md §4)
// Avatars upload via a pre-signed URL (R16): clients first POST .../avatar/upload-url
// for a signed PUT, upload the bytes straight to storage, then PUT here to confirm.
import { usersController } from '@/features/users/users.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const PUT = withRoute((request) => usersController.commitAvatar(request));
export const DELETE = withRoute((request) => usersController.removeAvatar(request));
