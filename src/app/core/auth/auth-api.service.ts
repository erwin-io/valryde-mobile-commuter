import { HttpClient, HttpContext, HttpContextToken } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { APP_CONFIG } from '../app-config';

// DTOs mirror Agent A's merged OpenAPI (valryde-api docs/integration/AGENT_A_OPENAPI_AUDIT.json).
export type UserRole = 'COMMUTER' | 'DRIVER' | 'OPERATOR' | 'ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  status: 'ACTIVE' | 'DISABLED';
  emailVerified: boolean;
  roles: UserRole[];
  createdAt: string;
  updatedAt: string;
}

export interface TokenBundle {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires (default 900). */
  accessTokenExpiresIn: number;
  refreshTokenExpiresAt: string;
  user: AuthUser;
}

/** Set on requests that need `Authorization: Bearer`; the interceptor never adds tokens otherwise. */
export const REQUIRES_AUTH = new HttpContextToken<boolean>(() => false);

/** Agent A `/api/auth/*` endpoints. Registration is always `role: "COMMUTER"` in this app. */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_CONFIG).apiBaseUrl}/auth`;
  private readonly authed = { context: new HttpContext().set(REQUIRES_AUTH, true) };

  register(body: { email: string; password: string; displayName: string }): Observable<AuthUser> {
    return this.http
      .post<{ user: AuthUser }>(`${this.base}/register`, { ...body, role: 'COMMUTER' })
      .pipe(map((r) => r.user));
  }

  verifyEmail(token: string): Observable<AuthUser> {
    return this.http.post<{ user: AuthUser }>(`${this.base}/verify-email`, { token }).pipe(map((r) => r.user));
  }

  resendVerification(email: string): Observable<unknown> {
    return this.http.post(`${this.base}/resend-verification`, { email });
  }

  login(email: string, password: string): Observable<TokenBundle> {
    return this.http.post<TokenBundle>(`${this.base}/login`, { email, password });
  }

  /** Rotates: the submitted refresh token is revoked server-side. */
  refresh(refreshToken: string): Observable<TokenBundle> {
    return this.http.post<TokenBundle>(`${this.base}/refresh`, { refreshToken });
  }

  logout(refreshToken: string): Observable<unknown> {
    return this.http.post(`${this.base}/logout`, { refreshToken });
  }

  forgotPassword(email: string): Observable<unknown> {
    return this.http.post(`${this.base}/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<unknown> {
    return this.http.post(`${this.base}/reset-password`, { token, password });
  }

  confirmEmailChange(token: string): Observable<AuthUser> {
    return this.http
      .post<{ user: AuthUser }>(`${this.base}/confirm-email-change`, { token })
      .pipe(map((r) => r.user));
  }

  me(): Observable<AuthUser> {
    return this.http.get<{ user: AuthUser }>(`${this.base}/me`, this.authed).pipe(map((r) => r.user));
  }

  updateProfile(displayName: string): Observable<AuthUser> {
    return this.http
      .patch<{ user: AuthUser }>(`${this.base}/me`, { displayName }, this.authed)
      .pipe(map((r) => r.user));
  }

  /** Bumps the credential version: every existing session must sign in again. */
  changePassword(currentPassword: string, newPassword: string): Observable<unknown> {
    return this.http.post(`${this.base}/me/change-password`, { currentPassword, newPassword }, this.authed);
  }

  requestEmailChange(email: string): Observable<unknown> {
    return this.http.post(`${this.base}/me/change-email`, { email }, this.authed);
  }
}
