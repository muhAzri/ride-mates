/**
 * Composition root for the Location feature — the one place that knows concrete
 * implementations. Wires the Supabase repository into the use-cases and exposes
 * a ready controller. Reverse geocoding is a client concern, so there is no
 * geocoder adapter here. Route Handlers import only `locationController`.
 */
import { SupabaseLocationRepository } from './infrastructure/supabase-location.repository';
import { SetLocationUseCase } from './application/set-location.usecase';
import { GetLocationUseCase } from './application/get-location.usecase';
import { LocationController } from './presentation/location.controller';

const repository = new SupabaseLocationRepository();

export const locationController = new LocationController({
  setLocation: new SetLocationUseCase(repository),
  getLocation: new GetLocationUseCase(repository),
});
