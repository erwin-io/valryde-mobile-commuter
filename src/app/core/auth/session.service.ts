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
 *
 * Every sign-in, refresh and restore captures the current `generation`. Signing out (or any local
 * clear) bumps it synchronously, so results that arrive later are discarded instead of signing the
 * user back in. Storage operations run strictly in order, so a clear is never overtaken by a slow write.
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
  private generation = 0;
  private storage: Promise<unknown> = Promise.resolve();

  /** Called once at launch: rotate a stored refresh token into a fresh session, if any. */
  async restore(): Promise<void> {
    const generation = this.generation;
    this.status.set('restoring');
    const token = await this.queue(() => this.store.read());
    if (generation !== this.generation) return;
    if (!token) {
      this.status.set('signed-out');
      return;
    }
    try {
      await this.refresh();
    } catch {
      // A dead token already signed us out; otherwise (offline, server down) keep it and let the user retry.
      if (generation === this.generation && this.status() !== 'signed-out') this.status.set('restore-failed');
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    const generation = this.generation;
    await this.apply(await firstValueFrom(this.api.login(email, password)), generation);
  }

  /**
   * Rotates the refresh token. Serialized so concurrent callers share one rotation: reusing a
   * rotated token is answered with 401 SESSION_REVOKED and revokes the whole token family.
   */
  refresh(): Promise<void> {
    if (!this.rotation) {
      const rotation = this.rotate(this.generation).finally(() => {
        if (this.rotation === rotation) this.rotation = undefined;
      });
      this.rotation = rotation;
    }
    return this.rotation;
  }

  /** A usable access token for a protected call, refreshing first when it is (nearly) expired. */
  async validAccessToken(): Promise<string | null> {
    if (this.accessToken && Date.now() < this.accessExpiresAt - EXPIRY_MARGIN_MS) return this.accessToken;
    if (this.status() !== 'signed-in') return null;
    await this.refresh();
    return this.accessToken;
  }

  /** Ends the session on this device. Local state is cleared at once, whatever the network outcome. */
  async signOut(): Promise<void> {
    this.invalidate();
    // Queued behind any pending write, so this reads (and revokes) the token that was actually stored.
    const token = await this.queue(async () => {
      const stored = await this.store.read();
      await this.store.clear();
      return stored;
    });
    if (token) await this.revoke(token);
  }

  /** Accepts a newer user payload only for the account that is still signed in. */
  setUser(user: AuthUser): void {
    if (this.status() === 'signed-in' && this.user()?.id === user.id) this.user.set(user);
  }

  /** Forget tokens locally, e.g. after a password change revoked every session server-side. */
  async clearLocal(): Promise<void> {
    this.invalidate();
    await this.queue(() => this.store.clear());
  }

  /** Synchronously ends the current generation: later results from it are ignored. */
  private invalidate(): void {
    this.generation++;
    this.rotation = undefined;
    this.accessToken = null;
    this.accessExpiresAt = 0;
    this.user.set(null);
    this.status.set('signed-out');
  }

  private async rotate(generation: number): Promise<void> {
    const token = await this.queue(() => this.store.read());
    if (generation !== this.generation) return;
    if (!token) {
      await this.clearLocal();
      throw new Error('No stored session');
    }
    let bundle: TokenBundle;
    try {
      bundle = await firstValueFrom(this.api.refresh(token));
    } catch (error) {
      // 400/401/403: the refresh token is invalid, revoked or the account is blocked. Network errors,
      // 5xx and rate limits (429, or 500 under defect D1) keep the token so a later retry can succeed.
      const dead = error instanceof HttpErrorResponse && [400, 401, 403].includes(error.status);
      if (dead && generation === this.generation) await this.clearLocal();
      throw error;
    }
    await this.apply(bundle, generation);
  }

  private async apply(bundle: TokenBundle, generation: number): Promise<void> {
    if (generation !== this.generation) {
      // Signed out while the request was in flight: never store it, and revoke the token the server just issued.
      await this.revoke(bundle.refreshToken);
      return;
    }
    await this.queue(() => this.store.write(bundle.refreshToken));
    // Signed out during the write: the queued sign-out read, revoked and cleared this token.
    if (generation !== this.generation) return;
    this.accessToken = bundle.accessToken;
    this.accessExpiresAt = Date.now() + bundle.accessTokenExpiresIn * 1000;
    this.user.set(bundle.user);
    this.status.set('signed-in');
  }

  /** Best-effort server-side revocation; local state never depends on it. */
  private async revoke(refreshToken: string): Promise<void> {
    await firstValueFrom(this.api.logout(refreshToken)).catch(() => undefined);
  }

  /** Runs refresh-token storage operations one at a time, in call order. */
  private queue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.storage.then(operation, operation);
    this.storage = result.catch(() => undefined);
    return result;
  }
}
