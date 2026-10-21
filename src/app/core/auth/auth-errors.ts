import { HttpErrorResponse } from '@angular/common/http';
import { failureCopy, toApiFailure } from '../api-failure';

/** The Agent A error `code` (branch on this, never on `message`). */
export function apiErrorCode(error: unknown): string | undefined {
  return error instanceof HttpErrorResponse ? error.error?.error?.code : undefined;
}

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Email or password is incorrect.',
  EMAIL_NOT_VERIFIED: 'Please verify your email address before signing in.',
  INVALID_CHALLENGE: 'This link has expired or has already been used.',
  CONFLICT: 'This email can’t be used to create an account. If you already have one, sign in instead.',
  VALIDATION_ERROR: 'Please check the details you entered.',
  SESSION_REVOKED: 'Your session has ended. Please sign in again.',
  AUTH_REQUIRED: 'Please sign in again.',
  FORBIDDEN: 'This account can’t do that.',
  EMAIL_DELIVERY_UNAVAILABLE: 'We can’t send email right now. Please try again later.',
};

/** Safe, user-facing text for an auth call failure. Raw server messages are never shown. */
export function authErrorMessage(error: unknown): string {
  const code = apiErrorCode(error);
  if (code && MESSAGES[code]) return MESSAGES[code];
  const failure = toApiFailure(error);
  const { title, body } = failureCopy(failure);
  const reference = failure.requestId ? ` (Reference: ${failure.requestId})` : '';
  return `${title}. ${body}${reference}`;
}
