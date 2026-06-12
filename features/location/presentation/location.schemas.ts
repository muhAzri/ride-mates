/**
 * Request-shape validation (zod) for Location (API_CONTRACT.md §5). Shape only:
 * `lat`/`lng` must be present numbers (else 400); their *range* is a semantic
 * rule enforced by `CoordinatesPolicy` (→ 422). `displayArea`/`areaLevel` are the
 * client-resolved area label (reverse geocoding is done client-side) — optional,
 * since a client that could not resolve an area still saves its pin.
 */
import { z } from 'zod';

export const setLocationSchema = z.object({
  lat: z.number({ message: 'Latitude is required.' }),
  lng: z.number({ message: 'Longitude is required.' }),
  displayArea: z
    .string()
    .trim()
    .min(1, 'Area name cannot be empty.')
    .max(120, 'Area name must be at most 120 characters.')
    .optional(),
  areaLevel: z.string().trim().max(40).optional(),
});

export type SetLocationBody = z.infer<typeof setLocationSchema>;
