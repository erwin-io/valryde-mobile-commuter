import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { toApiFailure } from '../../core/api-failure';
import { ConnectivityService } from '../../core/connectivity.service';
import { RouteLine } from '../map/transit-map.component';
import { RouteDetailState } from './route-detail.component';
import { RouteCacheService } from './route-cache.service';
import { drawableCoordinates, routeColor } from './route-geometry';
import { TransitRoutesService } from './transit-routes.service';

/** Page-scoped state for the route shown over the map: detail request, chosen direction, drawable line. */
@Injectable()
export class RouteSelectionService {
  private readonly routes = inject(TransitRoutesService);
  private readonly cache = inject(RouteCacheService);
  private readonly connectivity = inject(ConnectivityService);
  private request?: Subscription;
  private routeId: string | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
    let wasOnline = this.connectivity.online();
    effect(() => {
      const online = this.connectivity.online();
      const recovered = online && !wasOnline;
      wasOnline = online;
      if (!recovered) return;
      // React only to a real offline -> online transition. Reading request state as a dependency
      // would cause a retry loop when navigator is online but the API still cannot be reached.
      untracked(() => {
        const state = this.state();
        if (state?.status === 'ready' && state.savedAt !== undefined) this.retry();
      });
    });
  }

  readonly state = signal<RouteDetailState | null>(null);
  private readonly directionId = signal<string | null>(null);

  /** The explicitly requested direction, or the first active one. */
  readonly direction = computed(() => {
    const s = this.state();
    if (s?.status !== 'ready') return null;
    const { directions } = s.route;
    return directions.find((d) => d.id === this.directionId()) ?? directions[0] ?? null;
  });

  readonly line = computed<RouteLine | null>(() => {
    const s = this.state();
    const direction = this.direction();
    if (s?.status !== 'ready' || !direction) return null;
    const coordinates = drawableCoordinates(direction.geometry);
    return coordinates
      ? { id: direction.id, coordinates, color: routeColor(s.route.routeColorHex) }
      : null;
  });

  select(routeId: string | null, directionId: string | null): void {
    this.directionId.set(directionId);
    if (routeId === this.routeId) return;
    this.routeId = routeId;
    this.request?.unsubscribe();
    if (!routeId) {
      this.state.set(null);
      return;
    }
    this.state.set({ status: 'loading' });
    this.request = this.routes.get(routeId).subscribe({
      next: (route) => this.state.set({ status: 'ready', route }),
      error: (error) => {
        const failure = toApiFailure(error);
        // The route id is the only input, so a 400 (e.g. a malformed deep link) means "no such route".
        if (error instanceof HttpErrorResponse && error.status === 400) failure.kind = 'not-found';
        // Offline or timed out: fall back to an unexpired saved copy, clearly labelled as such.
        const saved = failure.kind === 'network' ? this.cache.detail(routeId) : null;
        this.state.set(
          saved
            ? { status: 'ready', route: saved.value, savedAt: saved.savedAt }
            : { status: 'error', failure },
        );
      },
    });
  }

  retry(): void {
    const routeId = this.routeId;
    this.routeId = null;
    this.select(routeId, this.directionId());
  }
}
