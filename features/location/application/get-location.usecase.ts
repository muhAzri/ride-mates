/**
 * GET /users/me/location (MP-12) — return the caller's area label + whether a
 * pin is set, for the Settings "Location & area" row (16). Never coordinates.
 */
import type { LocationRepository } from '../domain/location.repository';
import type { MyLocation } from '../domain/location.types';

export class GetLocationUseCase {
  constructor(private readonly repo: LocationRepository) {}

  execute(accessToken: string): Promise<MyLocation> {
    return this.repo.getMyLocation(accessToken);
  }
}
