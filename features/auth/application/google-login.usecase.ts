/**
 * UA-6 — sign in (or sign up) with a Google ID token. First-time accounts come
 * back with onboarding flags set so the client routes through profile + location
 * setup (API_CONTRACT.md §3 social).
 */
import type { AuthRepository } from '../domain/auth.repository';
import type { AuthResult } from '../domain/auth.types';

export class GoogleLoginUseCase {
  constructor(private readonly repo: AuthRepository) {}

  async execute(idToken: string): Promise<AuthResult> {
    const session = await this.repo.signInWithGoogle(idToken);
    const snapshot = await this.repo.getAccountSnapshot(session);

    return { ...snapshot, tokens: session.tokens };
  }
}
