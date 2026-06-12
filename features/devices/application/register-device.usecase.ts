/**
 * POST /me/devices (NT-3, R15) — register the caller's push device token. Thin
 * orchestration: the upsert + ownership semantics live in the RPC behind the
 * repository, so this just forwards the validated command.
 */
import type { DevicesRepository } from '../domain/devices.repository';
import type { RegisterDeviceCommand } from '../domain/device.types';

export class RegisterDeviceUseCase {
  constructor(private readonly repo: DevicesRepository) {}

  execute(accessToken: string, command: RegisterDeviceCommand): Promise<void> {
    return this.repo.registerToken(accessToken, command);
  }
}
