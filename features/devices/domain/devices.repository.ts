/**
 * Devices data port (Dependency Inversion). The application use-case depends on
 * this interface; the Supabase adapter implements it via the
 * `register_device_token` RPC. The token is owner-scoped server-side (NT-3).
 */
import type { RegisterDeviceCommand } from './device.types';

export interface DevicesRepository {
  /** Upsert the caller's device token (re-owns it on device hand-off). */
  registerToken(accessToken: string, command: RegisterDeviceCommand): Promise<void>;
}
