// GET/PUT /api/v1/users/me/location — MP-9, MP-12, LP-1 (auth required) (API_CONTRACT.md §5)
import { locationController } from '@/features/location/location.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const GET = withRoute((request) => locationController.getLocation(request));
export const PUT = withRoute((request) => locationController.setLocation(request));
