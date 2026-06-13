/**
 * Composition root for the Admin feature — wires the Supabase repository into the
 * admin-reports use-case and exposes a ready controller. Route Handlers import
 * only `adminController`.
 */
import { SupabaseAdminRepository } from './infrastructure/supabase-admin.repository';
import { AdminReportsUseCase } from './application/admin-reports.usecase';
import { AdminController } from './presentation/admin.controller';

const repository = new SupabaseAdminRepository();

export const adminController = new AdminController({
  reports: new AdminReportsUseCase(repository),
});
