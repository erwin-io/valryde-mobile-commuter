import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthApiService, AuthUser, TokenBundle } from './auth-api.service';
import { REFRESH_TOKEN_STORE } from './refresh-token-store';

export type SessionStatus = 'restoring' | 'signed-out' | 'signed-in' | 'restore-failed';

/** Refresh this long before the access token's stated expiry to absorb clock skew and latency. */
const EXPIRY_MARGIN_MS = 30_000;

/**
 * The commuter's session. The server stays authoritative for roles and account state;
 * this only holds tokens and the last user payload the API returned.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly api = inject(AuthApiService);
  private readonly store = inject(REFRESH_TOKEN_STORE);

  readonly status = signal<SessionStatus>('restoring');
  readonly user = signal<AuthUser | null>(null);

  private accessToken: string | null = null;
  private accessExpiresAt = 0;
  private rotation?: Promise<void>;

  /** Called once at launch: rotate a stored refresh token into a fresh session, if any. */
  async restore(): Promise<void> {
    this.status.set('restoring');
    if (!(await this.store.read())) {
      this.status.set('signed-out');
      return;
    }
    try {
      await this.refresh();
    } catch {
      // A dead token already signed us out; otherwise (offline, server down) keep it and let the user retry.
      if (this.status() !== 'signed-out') this.status.set('restore-failed');
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.apply(await firstValueFrom(this.api.login(email, password)));
  }

  /**
   * Rotates the refresh token. Serialized so concurrent callers share one rotation: reusing a
   * rotated token is answered with 401 SESSION_REVOKED and would end the session.
   */
  refresh(): Promise<void> {
    this.rotation ??= this.rotate().finally(() => (this.rotation = undefined));
    return this.rotation;
  }

  /** A usable access token for a protected call, refreshing first when it is (nearly) expired. */
  async validAccessToken(): Promise<string | null> {
    if (this.accessToken && Date.now() < this.accessExpiresAt - EXPIRY_MARGIN_MS) return this.accessToken;
    if (this.status() !== 'signed-in') return null;
    await this.refresh();
    return this.accessToken;
  }

  /** Ends the session on this device. Local state is cleared whatever the network outcome. */
  async signOut(): Promise<void> {
    const token = await this.store.read();
    await this.clearLocal();
    if (token) await firstValueFrom(this.api.logout(token)).catch(() => undefined);
  }

  setUser(user: AuthUser): void {
    this.user.set(user);
  }

  /** Forget tokens locally, e.g. after a password change revoked every session server-side. */
  async clearLocal(): Promise<void> {
    this.accessToken = null;
    this.accessExpiresAt = 0;
    this.user.set(null);
    this.status.set('signed-out');
    await this.store.clear();
  }

  private async rotate(): Promise<void> {
    const token = await this.store.read();
    if (!token) {
      await this.clearLocal();
      throw new Error('No stored session');
    }
    try {
      await this.apply(await firstValueFrom(this.api.refresh(token)));
    } catch (error) {
      // 400/401/403: the refresh token is invalid, revoked or the account is blocked. Network errors,
      // 5xx and rate limits (429, or 500 under defect D1) keep the token so a later retry can succeed.
      if (error instanceof HttpErrorResponse && [400, 401, 403].includes(error.status)) await this.clearLocal();
      throw error;
    }
  }

  private async apply(bundle: TokenBundle): Promise<void> {
    await this.store.write(bundle.refreshToken);
    this.accessToken = bundle.accessToken;
    this.accessExpiresAt = Date.now() + bundle.accessTokenExpiresIn * 1000;
    this.user.set(bundle.user);
    this.status.set('signed-in');
  }
}
