import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { AuthApiService, TokenBundle } from './auth-api.service';
import { bundle, testUser } from './auth.test-helpers';
import { REFRESH_TOKEN_STORE, RefreshTokenStore, memoryRefreshTokenStore } from './refresh-token-store';
import { SessionService } from './session.service';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => (resolve = res));
  return { promise, resolve };
}

/** Lets pending promise chains (await, firstValueFrom, queued storage) run to completion. */
const flush = () => new Promise((resolve) => setTimeout(resolve));

const revoked = () =>
  new HttpErrorResponse({ status: 401, error: { error: { code: 'SESSION_REVOKED', requestId: 'r' } } });

describe('SessionService', () => {
  const api = { login: vi.fn(), refresh: vi.fn(), logout: vi.fn() };
  let store: ReturnType<typeof memoryRefreshTokenStore>;
  let session: SessionService;

  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    store = memoryRefreshTokenStore();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthApiService, useValue: api },
        { provide: REFRESH_TOKEN_STORE, useValue: store },
      ],
    });
    session = TestBed.inject(SessionService);
  });

  it('signs in, keeps the access token in memory and stores only the refresh token', async () => {
    api.login.mockReturnValue(of(bundle(1)));
    await session.signIn('rider@example.test', 'correct horse battery');
    expect(session.status()).toBe('signed-in');
    expect(session.user()?.email).toBe('rider@example.test');
    expect(await store.read()).toBe('refresh-1');
    expect(await session.validAccessToken()).toBe('access-1');
  });

  it('restores a stored session by rotating the refresh token', async () => {
    await store.write('refresh-0');
    api.refresh.mockReturnValue(of(bundle(1)));
    await session.restore();
    expect(api.refresh).toHaveBeenCalledWith('refresh-0');
    expect(session.status()).toBe('signed-in');
    expect(await store.read()).toBe('refresh-1');
  });

  it('is signed out at launch when nothing is stored', async () => {
    await session.restore();
    expect(session.status()).toBe('signed-out');
    expect(api.refresh).not.toHaveBeenCalled();
  });

  it('shares one rotation between concurrent refreshes (rotated tokens must not be reused)', async () => {
    await store.write('refresh-0');
    const response = new Subject<TokenBundle>();
    api.refresh.mockReturnValue(response);
    const first = session.refresh();
    const second = session.refresh();
    await flush(); // the refresh request is now in flight
    response.next(bundle(1));
    response.complete();
    await Promise.all([first, second]);
    expect(api.refresh).toHaveBeenCalledOnce();
    expect(await store.read()).toBe('refresh-1');
  });

  it('signs out locally when the refresh token is revoked', async () => {
    await store.write('refresh-0');
    api.refresh.mockReturnValue(throwError(revoked));
    await session.restore();
    expect(session.status()).toBe('signed-out');
    expect(await store.read()).toBeNull();
  });

  it('keeps the refresh token when the network or server fails, and reports restore-failed', async () => {
    await store.write('refresh-0');
    api.refresh.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    await session.restore();
    expect(session.status()).toBe('restore-failed');
    expect(await store.read()).toBe('refresh-0');
  });

  it('refreshes before a protected call when the access token is about to expire', async () => {
    vi.useFakeTimers();
    try {
      api.login.mockReturnValue(of(bundle(1, 60)));
      await session.signIn('rider@example.test', 'correct horse battery');
      vi.advanceTimersByTime(31_000); // inside the 30 s safety margin
      api.refresh.mockReturnValue(of(bundle(2)));
      expect(await session.validAccessToken()).toBe('access-2');
      expect(api.refresh).toHaveBeenCalledWith('refresh-1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores a late profile update for a user who already signed out', async () => {
    api.login.mockReturnValue(of(bundle(1)));
    await session.signIn('rider@example.test', 'correct horse battery');
    api.logout.mockReturnValue(of(null));
    await session.signOut();
    session.setUser({ ...testUser, displayName: 'Late' });
    expect(session.user()).toBeNull();
  });

  it('clears local state on sign-out even when the logout call fails', async () => {
    api.login.mockReturnValue(of(bundle(1)));
    await session.signIn('rider@example.test', 'correct horse battery');
    api.logout.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    await session.signOut();
    expect(api.logout).toHaveBeenCalledWith('refresh-1');
    expect(session.status()).toBe('signed-out');
    expect(session.user()).toBeNull();
    expect(await store.read()).toBeNull();
    expect(await session.validAccessToken()).toBeNull();
  });

  // Regression suite for the PR #4 Tech Lead finding: no late auth result may outlive a sign-out.
  describe('session lifecycle races', () => {
    beforeEach(() => api.logout.mockReturnValue(of(null)));

    async function signedIn(expiresIn = 900) {
      api.login.mockReturnValue(of(bundle(1, expiresIn)));
      await session.signIn('rider@example.test', 'correct horse battery');
    }

    async function expectSignedOutAndEmpty() {
      expect(session.status()).toBe('signed-out');
      expect(session.user()).toBeNull();
      expect(await session.validAccessToken()).toBeNull();
      expect(await store.read()).toBeNull();
    }

    it('C-RACE-01: a refresh that resolves after sign-out cannot sign in again or store its token', async () => {
      await signedIn();
      const response = new Subject<TokenBundle>();
      api.refresh.mockReturnValue(response);
      const refreshing = session.refresh();
      await flush(); // the refresh request is now in flight
      await session.signOut();
      response.next(bundle(2));
      await refreshing;
      await flush();
      await expectSignedOutAndEmpty();
      // The orphaned token the server just issued is revoked rather than left valid.
      expect(api.logout).toHaveBeenCalledWith('refresh-2');
    });

    it('C-RACE-02: callers sharing one refresh cannot restore the session after sign-out', async () => {
      await signedIn();
      const response = new Subject<TokenBundle>();
      api.refresh.mockReturnValue(response);
      const callers = [session.refresh(), session.refresh(), session.refresh()];
      await flush();
      expect(api.refresh).toHaveBeenCalledOnce();
      await session.signOut();
      response.next(bundle(2));
      await Promise.allSettled(callers);
      await flush();
      await expectSignedOutAndEmpty();
      // A refresh started after sign-out must not join the stale in-flight one.
      await expect(session.refresh()).rejects.toThrow();
      expect(api.refresh).toHaveBeenCalledOnce();
    });

    it('C-RACE-03: a sign-in that resolves after the session was cancelled cannot authenticate', async () => {
      const response = new Subject<TokenBundle>();
      api.login.mockReturnValue(response);
      const signingIn = session.signIn('rider@example.test', 'correct horse battery');
      await flush();
      await session.signOut();
      response.next(bundle(1));
      await signingIn.catch(() => undefined);
      await flush();
      await expectSignedOutAndEmpty();
      expect(api.logout).toHaveBeenCalledWith('refresh-1');
    });

    it('C-RACE-04: a slow native secure-storage write cannot resurrect a signed-out session', async () => {
      const inner = memoryRefreshTokenStore();
      const gate = deferred();
      const slow: RefreshTokenStore = {
        read: () => inner.read(),
        clear: () => inner.clear(),
        write: async (token) => {
          await gate.promise; // e.g. Keychain/Keystore latency
          await inner.write(token);
        },
      };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: AuthApiService, useValue: api },
          { provide: REFRESH_TOKEN_STORE, useValue: slow },
        ],
      });
      session = TestBed.inject(SessionService);
      store = inner;

      api.login.mockReturnValue(of(bundle(1)));
      const signingIn = session.signIn('rider@example.test', 'correct horse battery');
      await flush(); // the token write is now pending
      const signingOut = session.signOut();
      gate.resolve();
      await Promise.allSettled([signingIn, signingOut]);
      await flush();
      await expectSignedOutAndEmpty();
      // Sign-out waited for the write, so it revoked the token that was actually stored.
      expect(api.logout).toHaveBeenCalledWith('refresh-1');
    });

    it('C-RACE-05: a legitimate refresh rotates once for concurrent callers and stays signed in', async () => {
      vi.useFakeTimers();
      try {
        await signedIn(60);
        vi.advanceTimersByTime(31_000);
        const response = new Subject<TokenBundle>();
        api.refresh.mockReturnValue(response);
        const tokens = Promise.all([
          session.validAccessToken(),
          session.validAccessToken(),
          session.validAccessToken(),
        ]);
        await vi.advanceTimersByTimeAsync(0);
        response.next(bundle(2));
        expect(await tokens).toEqual(['access-2', 'access-2', 'access-2']);
        expect(api.refresh).toHaveBeenCalledOnce();
        expect(api.refresh).toHaveBeenCalledWith('refresh-1');
        expect(session.status()).toBe('signed-in');
        expect(await store.read()).toBe('refresh-2');
        expect(api.logout).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('C-RACE-06: a revoked refresh signs out; an outage, server error or rate limit keeps the session recoverable', async () => {
      await signedIn(0);
      api.refresh.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
      await expect(session.refresh()).rejects.toMatchObject({ status: 0 });
      api.refresh.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })));
      await expect(session.refresh()).rejects.toMatchObject({ status: 503 });
      // Rate limits are 429 RATE_LIMITED since valryde-api 34cc664 (defect D1 fix); still recoverable.
      api.refresh.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status: 429, error: { error: { code: 'RATE_LIMITED' } } })),
      );
      await expect(session.refresh()).rejects.toMatchObject({ status: 429 });
      expect(session.status()).toBe('signed-in');
      expect(await store.read()).toBe('refresh-1');

      api.refresh.mockReturnValueOnce(throwError(revoked));
      await expect(session.refresh()).rejects.toMatchObject({ status: 401 });
      await expectSignedOutAndEmpty();
    });
  });
});
