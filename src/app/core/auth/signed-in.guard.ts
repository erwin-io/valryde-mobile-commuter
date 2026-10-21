import { inject, Injector } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanMatchFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { SessionService } from './session.service';

/** UX-only gate for signed-in pages; waits for launch-time restore, then sends guests to sign in. */
export const signedInGuard: CanMatchFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);
  return toObservable(session.status, { injector: inject(Injector) }).pipe(
    filter((status) => status !== 'restoring'),
    take(1),
    map((status) => (status === 'signed-in' ? true : router.parseUrl('/tabs/account/sign-in'))),
  );
};
