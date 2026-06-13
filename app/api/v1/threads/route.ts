// /api/v1/threads — list/search (CF-1/4/5) & create (CF-1) — API_CONTRACT.md §8
import { forumController } from '@/features/forum/forum.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const GET = withRoute((request) => forumController.listThreads(request));
export const POST = withRoute((request) => forumController.createThread(request));
