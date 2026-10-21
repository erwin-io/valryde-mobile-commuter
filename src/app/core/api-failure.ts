import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

/** UI-level failure categories. Raw server messages are never shown to commuters. */
export type ApiFailureKind = 'network' | 'not-found' | 'rate-limited' | 'unavailable';

export interface ApiFailure {
  kind: ApiFailureKind;
  /** Server `requestId` for support diagnostics, when the API returned its error envelope. */
  requestId?: string;
}

export function toApiFailure(error: unknown): ApiFailure {
  // A request that outlived its timeout is treated like no connection (slow or captive network).
  if (error instanceof TimeoutError) return { kind: 'network' };
  if (!(error instanceof HttpErrorResponse)) return { kind: 'unavailable' };
  const requestId: string | undefined = error.error?.error?.requestId;
  // Status 0: no HTTP response (offline, DNS, CORS, or API down).
  if (error.status === 0) return { kind: 'network' };
  if (error.status === 404) return { kind: 'not-found', requestId };
  // Backend defect D1: rate limits currently arrive as 500 INTERNAL_ERROR with a retry-after header.
  if (error.status === 429 || error.headers?.has('retry-after')) return { kind: 'rate-limited', requestId };
  return { kind: 'unavailable', requestId };
}

export function failureCopy(failure: ApiFailure): { title: string; body: string } {
  switch (failure.kind) {
    case 'network':
      return {
        title: 'Can’t reach VALRYDE',
        body: 'Check your internet connection and try again.',
      };
    case 'not-found':
      return {
        title: 'Route not found',
        body: 'This route may have been withdrawn. Go back to the route list to pick another.',
      };
    case 'rate-limited':
      return { title: 'Too many requests', body: 'Please wait a minute, then try again.' };
    case 'unavailable':
      return {
        title: 'VALRYDE is temporarily unavailable',
        body: 'Please try again in a moment.',
      };
  }
}
