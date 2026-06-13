// GET /api/v1/me/saved/threads — bookmarks hub (14 Saved › Threads) — §9
import { forumController } from '@/features/forum/forum.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const GET = withRoute((request) => forumController.listSavedThreads(request));
