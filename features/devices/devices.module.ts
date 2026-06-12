/**
 * Composition root for the Devices feature — wires the Supabase repository into
 * the register use-case and exposes a ready controller. Route Handlers import
 * only `devicesController`.
 */
import { SupabaseDevicesRepository } from './infrastructure/supabase-devices.repository';
import { RegisterDeviceUseCase } from './application/register-device.usecase';
import { DevicesController } from './presentation/devices.controller';

const repository = new SupabaseDevicesRepository();

export const devicesController = new DevicesController({
  register: new RegisterDeviceUseCase(repository),
});
