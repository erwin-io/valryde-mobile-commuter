import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { APP_CONFIG } from '../app-config';
import { AUTH_REQUEST_TIMEOUT_MS, AuthApiService } from './auth-api.service';

describe('AuthApiService', () => {
  let api: AuthApiService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: '/api', mapStyleUrl: '/style.json' } },
      ],
    });
    api = TestBed.inject(AuthApiService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    backend.verify();
  });

  it('sends credentials in the login body, never in the URL', async () => {
    const result = firstValueFrom(api.login('rider@example.test', 'correct horse battery'));
    const request = backend.expectOne('/api/auth/login');

    expect(request.request.params.keys()).toEqual([]);
    expect(request.request.body).toEqual({
      email: 'rider@example.test',
      password: 'correct horse battery',
    });
    request.flush({});
    await result;
  });

  it('times out an authentication request on a half-open connection', async () => {
    vi.useFakeTimers();
    const result = firstValueFrom(api.forgotPassword('rider@example.test'));
    backend.expectOne('/api/auth/forgot-password');

    await vi.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);

    await expect(result).rejects.toBeInstanceOf(TimeoutError);
  });
});
