// POST /api/v1/me/devices — register a push device token, NT-3 (API_CONTRACT.md §11)
import { devicesController } from '@/features/devices/devices.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const POST = withRoute((request) => devicesController.register(request));
