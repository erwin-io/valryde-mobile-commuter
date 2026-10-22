import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { REQUIRES_AUTH } from './auth-api.service';
import { authInterceptor } from './auth.interceptor';
import { SessionService } from './session.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let token: string;
  const session = { validAccessToken: vi.fn(), refresh: vi.fn(), clearLocal: vi.fn() };
  const authed = { context: new HttpContext().set(REQUIRES_AUTH, true) };
  const flush = () => new Promise((resolve) => setTimeout(resolve));

  beforeEach(() => {
    token = 'access-1';
    session.validAccessToken.mockReset().mockImplementation(async () => token);
    session.refresh.mockReset().mockImplementation(async () => void (token = 'access-2'));
    session.clearLocal.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: SessionService, useValue: session },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('never attaches a token to unflagged requests (public API, map tiles, other hosts)', () => {
    http.get('/api/transit-routes').subscribe();
    const req = backend.expectOne('/api/transit-routes');
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(session.validAccessToken).not.toHaveBeenCalled();
    req.flush({});
  });

  it('adds the bearer token to flagged requests', async () => {
    const result = firstValueFrom(http.get('/api/auth/me', authed));
    await flush();
    const req = backend.expectOne('/api/auth/me');
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-1');
    req.flush({ user: {} });
    await result;
  });

  it('refreshes once and retries after a 401', async () => {
    const result = firstValueFrom(http.get('/api/auth/me', authed));
    await flush();
    backend.expectOne('/api/auth/me').flush({ error: { code: 'AUTH_REQUIRED' } }, { status: 401, statusText: 'x' });
    await flush();
    const retry = backend.expectOne('/api/auth/me');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
    retry.flush({ user: { id: 'u1' } });
    expect(await result).toEqual({ user: { id: 'u1' } });
    expect(session.refresh).toHaveBeenCalledOnce();
  });

  it('returns a second 401 to the caller instead of looping', async () => {
    const result = firstValueFrom(http.get('/api/auth/me', authed));
    await flush();
    backend.expectOne('/api/auth/me').flush({}, { status: 401, statusText: 'x' });
    await flush();
    backend.expectOne('/api/auth/me').flush({}, { status: 401, statusText: 'x' });
    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(session.refresh).toHaveBeenCalledOnce();
    expect(session.clearLocal).toHaveBeenCalledWith(true);
  });

  it('does not attempt another refresh when token acquisition already rejected as revoked', async () => {
    session.validAccessToken.mockRejectedValue(
      new HttpErrorResponse({ status: 401, error: { error: { code: 'SESSION_REVOKED' } } }),
    );
    const result = firstValueFrom(http.get('/api/auth/me', authed));

    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(session.refresh).not.toHaveBeenCalled();
    backend.expectNone('/api/auth/me');
  });

  it('does not refresh for non-401 errors', async () => {
    const result = firstValueFrom(http.get('/api/auth/me', authed));
    await flush();
    backend.expectOne('/api/auth/me').flush({}, { status: 403, statusText: 'x' });
    await expect(result).rejects.toMatchObject({ status: 403 });
    expect(session.refresh).not.toHaveBeenCalled();
  });
});
