import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { AuthApiService, TokenBundle } from './auth-api.service';
import { bundle } from './auth.test-helpers';
import { REFRESH_TOKEN_STORE, memoryRefreshTokenStore } from './refresh-token-store';
import { SessionService } from './session.service';

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
    await Promise.resolve();
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
});
