// /api/v1/conversations — list (MS-4) & open/contact seller (MP-6, MS-1) — API_CONTRACT.md §10
import { messagingController } from '@/features/messaging/messaging.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const GET = withRoute((request) => messagingController.listConversations(request));
export const POST = withRoute((request) => messagingController.openConversation(request));
