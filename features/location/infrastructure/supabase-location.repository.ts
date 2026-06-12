/**
 * Supabase implementation of the `LocationRepository` port. Writes go through the
 * `set_my_location` SECURITY DEFINER RPC, which atomically stores the precise pin
 * in the owner-only `user_locations` table and caches the area label on
 * `profiles` — returning the profile row *without* coordinates (LP-1).
 */
import { createScopedClient } from '@/shared/supabase/server-client';
import { rethrowIfAuthError } from '@/shared/supabase/errors';
import { ApiError } from '@/shared/http/api-error';
import type { LocationRepository } from '../domain/location.repository';
import type { LocationResult, MyLocation, SetLocationCommand } from '../domain/location.types';

interface ProfileLocationRow {
  display_area: string | null;
  area_level: string | null;
  updated_at: string;
}

export class SupabaseLocationRepository implements LocationRepository {
  async setPin(accessToken: string, command: SetLocationCommand): Promise<LocationResult> {
    const supabase = createScopedClient(accessToken);

    const { data, error } = await supabase.rpc('set_my_location', {
      p_lat: command.lat,
      p_lng: command.lng,
      p_display_area: command.displayArea ?? null,
      p_area_level: command.areaLevel ?? null,
    });

    if (error) {
      rethrowIfAuthError(error); // expired/invalid JWT → 401, not 500
      console.error('[location] set_my_location failed', error);
      throw ApiError.internal('Could not save your location. Please try again.');
    }

    // The RPC returns the updated `profiles` row (composite) — some PostgREST
    // versions wrap it in an array; normalise to a single row.
    const row = (Array.isArray(data) ? data[0] : data) as ProfileLocationRow | null;
    if (!row) {
      console.error('[location] set_my_location returned no row');
      throw ApiError.internal('Could not save your location. Please try again.');
    }

    return {
      displayArea: row.display_area,
      areaLevel: row.area_level,
      updatedAt: row.updated_at,
    };
  }

  async getMyLocation(accessToken: string): Promise<MyLocation> {
    const supabase = createScopedClient(accessToken);
    const { data: authUser } = await supabase.auth.getUser(accessToken);
    const userId = authUser.user?.id;
    if (!userId) {
      throw ApiError.unauthenticated('Your session has expired. Please sign in again.');
    }

    const [profileRes, pinRes] = await Promise.all([
      supabase.from('profiles').select('display_area, area_level').eq('id', userId).single(),
      supabase.from('user_locations').select('user_id').eq('user_id', userId).maybeSingle(),
    ]);

    if (profileRes.error || !profileRes.data) {
      rethrowIfAuthError(profileRes.error);
      console.error('[location] profile read failed', profileRes.error);
      throw ApiError.internal();
    }

    return {
      displayArea: profileRes.data.display_area,
      areaLevel: profileRes.data.area_level,
      hasPin: Boolean(pinRes.data),
    };
  }
}
