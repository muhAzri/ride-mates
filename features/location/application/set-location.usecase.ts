/**
 * PUT /users/me/location (MP-9, LP-1, LP-3) — set/move the caller's pin.
 *
 * Orchestration (API_CONTRACT.md §5):
 *  1. Validate the coordinate ranges (422 if out of range).
 *  2. Persist the precise pin server-side + cache the client-supplied area
 *     label. Reverse geocoding is done on the client (device-native or OSM), so
 *     the server stores the area as-is; distance stays server-computed from the
 *     coordinates (LP-3), so a cosmetic label can never affect proximity.
 */
import type { LocationRepository } from '../domain/location.repository';
import { CoordinatesPolicy } from '../domain/coordinates-policy';
import type { LocationResult, SetLocationCommand } from '../domain/location.types';

export class SetLocationUseCase {
  constructor(private readonly repo: LocationRepository) {}

  execute(accessToken: string, command: SetLocationCommand): Promise<LocationResult> {
    CoordinatesPolicy.assertValid(command.lat, command.lng);
    return this.repo.setPin(accessToken, command);
  }
}
