/**
 * Location & geocoding domain models (API_CONTRACT.md §5, FSD §5.2.1/§5.2.2,
 * LP-1…LP-5). Precise `lat`/`lng` are accepted on write but live server-side
 * only (owner-only `user_locations`); they never appear in any read projection
 * here — clients only ever see `displayArea` + `areaLevel` (LP-1, LP-2).
 */

/**
 * The pin a user confirmed (FSD §5.2.1 — the single source of truth), plus the
 * area label the *client* resolved by reverse geocoding (device-native or OSM).
 * The server stores the area as-is; it is a cosmetic kecamatan-level label, while
 * privacy-critical distance is always computed server-side from the coordinates.
 * `displayArea`/`areaLevel` are optional: if the client could not resolve an
 * area, the pin is still saved and any previously cached area is kept.
 */
export interface SetLocationCommand {
  lat: number;
  lng: number;
  displayArea?: string;
  areaLevel?: string;
}

/** Result of setting a pin — area + when it was set. Never coordinates (LP-1). */
export interface LocationResult {
  displayArea: string | null;
  areaLevel: string | null;
  updatedAt: string;
}

/** Settings "Location & area" row projection (§5 GET). Never coordinates. */
export interface MyLocation {
  displayArea: string | null;
  areaLevel: string | null;
  hasPin: boolean;
}
