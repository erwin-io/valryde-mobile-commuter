import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { toApiFailure } from './api-failure';

function httpError(status: number, body: unknown = null, headers = new HttpHeaders()) {
  return new HttpErrorResponse({ status, error: body, headers });
}

describe('toApiFailure', () => {
  const envelope = { error: { code: 'NOT_FOUND', message: 'raw server text', requestId: 'req-7' } };

  it('treats a missing HTTP response as a network failure', () => {
    expect(toApiFailure(httpError(0))).toEqual({ kind: 'network' });
  });

  it('keeps the server requestId for support but never the raw message', () => {
    expect(toApiFailure(httpError(404, envelope))).toEqual({ kind: 'not-found', requestId: 'req-7' });
  });

  it('recognises rate limits sent as 500 with retry-after (backend defect D1) and as 429', () => {
    const retry = new HttpHeaders({ 'retry-after': '60' });
    expect(toApiFailure(httpError(500, null, retry)).kind).toBe('rate-limited');
    expect(toApiFailure(httpError(429)).kind).toBe('rate-limited');
  });

  it('maps other errors, including non-HTTP errors, to unavailable', () => {
    expect(toApiFailure(httpError(503)).kind).toBe('unavailable');
    expect(toApiFailure(new Error('boom')).kind).toBe('unavailable');
  });
});
