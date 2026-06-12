/**
 * Composition root for the auth feature — the one place that knows concrete
 * implementations. It wires the Supabase adapter into the use-cases and exposes
 * a ready-to-use controller. Route Handlers import only `authController`, so
 * swapping the adapter or a use-case never touches the routes.
 */
import { SupabaseAuthRepository } from './infrastructure/supabase-auth.repository';
import { RegisterUseCase } from './application/register.usecase';
import { LoginUseCase } from './application/login.usecase';
import { GoogleLoginUseCase } from './application/google-login.usecase';
import { RefreshSessionUseCase } from './application/refresh-session.usecase';
import { LogoutUseCase } from './application/logout.usecase';
import { ForgotPasswordUseCase } from './application/forgot-password.usecase';
import { ResetPasswordUseCase } from './application/reset-password.usecase';
import { ChangePasswordUseCase } from './application/change-password.usecase';
import { AuthController } from './presentation/auth.controller';

const repository = new SupabaseAuthRepository();

export const authController = new AuthController({
  register: new RegisterUseCase(repository),
  login: new LoginUseCase(repository),
  google: new GoogleLoginUseCase(repository),
  refresh: new RefreshSessionUseCase(repository),
  logout: new LogoutUseCase(repository),
  forgotPassword: new ForgotPasswordUseCase(repository),
  resetPassword: new ResetPasswordUseCase(repository),
  changePassword: new ChangePasswordUseCase(repository),
});
