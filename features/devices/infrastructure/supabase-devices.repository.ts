/**
 * Supabase implementation of the `DevicesRepository` port. Writes go through the
 * `register_device_token` SECURITY DEFINER RPC, which upserts on the unique token
 * and re-assigns it to the caller on a device hand-off — always stamping
 * `user_id = auth.uid()` so a caller can never register a token for someone else.
 */
import { createScopedClient } from '@/shared/supabase/server-client';
import { rethrowIfAuthError } from '@/shared/supabase/errors';
import { ApiError } from '@/shared/http/api-error';
import type { DevicesRepository } from '../domain/devices.repository';
import type { RegisterDeviceCommand } from '../domain/device.types';

export class SupabaseDevicesRepository implements DevicesRepository {
  async registerToken(accessToken: string, command: RegisterDeviceCommand): Promise<void> {
    const supabase = createScopedClient(accessToken);

    const { error } = await supabase.rpc('register_device_token', {
      p_token: command.token,
      p_platform: command.platform,
    });

    if (error) {
      rethrowIfAuthError(error);
      if (error.code === '28000') {
        throw ApiError.unauthenticated('Your session has expired. Please sign in again.');
      }
      console.error('[devices] register failed', error);
      throw ApiError.internal('Could not register your device. Please try again.');
    }
  }
}
