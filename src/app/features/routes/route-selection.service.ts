import { Injectable, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { toApiFailure } from '../../core/api-failure';
import { RouteLine } from '../map/transit-map.component';
import { RouteDetailState } from './route-detail.component';
import { drawableCoordinates } from './route-geometry';
import { TransitRoutesService } from './transit-routes.service';

/** Page-scoped state for the route shown over the map: detail request, chosen direction, drawable line. */
@Injectable()
export class RouteSelectionService {
  private readonly routes = inject(TransitRoutesService);
  private request?: Subscription;
  private routeId: string | null = null;

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
    return coordinates ? { id: direction.id, coordinates, color: s.route.routeColorHex } : null;
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
      error: (error) => this.state.set({ status: 'error', failure: toApiFailure(error) }),
    });
  }

  retry(): void {
    const routeId = this.routeId;
    this.routeId = null;
    this.select(routeId, this.directionId());
  }
}
