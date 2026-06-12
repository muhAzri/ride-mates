/**
 * Location data port (Dependency Inversion). The Supabase adapter implements it
 * via the `set_my_location` SECURITY DEFINER RPC, which stores precise
 * coordinates in the owner-only `user_locations` table and the public area label
 * on `profiles` — coordinates are never returned (LP-1).
 */
import type { LocationResult, MyLocation, SetLocationCommand } from './location.types';

export interface LocationRepository {
  /**
   * Persist the caller's pin + client-supplied area label (MP-9). When the area
   * is omitted, any previously cached area is kept and the pin is saved anyway
   * (saving must not be blocked; NFR Reliability).
   */
  setPin(accessToken: string, command: SetLocationCommand): Promise<LocationResult>;

  /** Read the caller's area + whether a pin exists (§5 GET). No coordinates. */
  getMyLocation(accessToken: string): Promise<MyLocation>;
}
