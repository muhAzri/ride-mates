// POST /api/v1/users/me/avatar/upload-url — UA-4 step 1 (auth required) (API_CONTRACT.md §4, R16)
// Issues a pre-signed PUT so the client uploads the avatar straight to object
// storage; the bytes never pass through this server. Confirm with PUT ../avatar.
import { usersController } from '@/features/users/users.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const POST = withRoute((request) => usersController.issueAvatarUploadUrl(request));
