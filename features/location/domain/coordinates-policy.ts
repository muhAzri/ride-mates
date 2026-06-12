/**
 * Coordinate range rule (API_CONTRACT.md §5: "422 UNPROCESSABLE if lat/lng out
 * of range"). Like `PasswordPolicy`, this is a *semantic* rule: a request with a
 * lat of 200 is well-formed JSON (passes shape validation → not 400) but
 * geographically invalid, so it maps to 422 UNPROCESSABLE.
 */
import { ApiError } from '@/shared/http/api-error';

export const LAT_RANGE = { min: -90, max: 90 } as const;
export const LNG_RANGE = { min: -180, max: 180 } as const;

export const CoordinatesPolicy = {
  isValid(lat: number, lng: number): boolean {
    return (
      Number.isFinite(lat) &&
      lat >= LAT_RANGE.min &&
      lat <= LAT_RANGE.max &&
      Number.isFinite(lng) &&
      lng >= LNG_RANGE.min &&
      lng <= LNG_RANGE.max
    );
  },

  /** Throw `422 UNPROCESSABLE` when the coordinates fall outside valid ranges. */
  assertValid(lat: number, lng: number): void {
    if (this.isValid(lat, lng)) return;
    throw ApiError.unprocessable('Coordinates are out of range.', {
      lat: `Latitude must be between ${LAT_RANGE.min} and ${LAT_RANGE.max}.`,
      lng: `Longitude must be between ${LNG_RANGE.min} and ${LNG_RANGE.max}.`,
    });
  },
};
