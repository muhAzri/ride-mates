/**
 * Maps location domain results to the exact JSON wire shapes (API_CONTRACT.md §5).
 * Coordinates never appear in either projection (LP-1).
 */
import type { LocationResult, MyLocation } from '../domain/location.types';

/** PUT /users/me/location response. */
export function toLocationResultDto(result: LocationResult) {
  return {
    displayArea: result.displayArea,
    areaLevel: result.areaLevel,
    updatedAt: result.updatedAt,
  };
}

/** GET /users/me/location response. */
export function toMyLocationDto(location: MyLocation) {
  return {
    displayArea: location.displayArea,
    areaLevel: location.areaLevel,
    hasPin: location.hasPin,
  };
}
