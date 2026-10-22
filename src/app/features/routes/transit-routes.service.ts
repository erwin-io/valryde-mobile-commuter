import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, tap, timeout } from 'rxjs';
import { APP_CONFIG } from '../../core/app-config';
import { LngLat } from '../map/location.service';
import { RouteCacheService } from './route-cache.service';

// DTOs mirror Agent A's merged OpenAPI (valryde-api docs/integration/AGENT_A_OPENAPI_AUDIT.json).
export type TransitStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface RouteDirection {
  id: string;
  routeId: string;
  directionLabel: string;
  originName: string;
  destinationName: string;
  /** GeoJSON LineString, WGS84 [longitude, latitude]. */
  geometry: { type: 'LineString'; coordinates: LngLat[] };
  corridorM: number;
  status: TransitStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TransitRoute {
  id: string;
  routeCode: string;
  publicName: string;
  description: string | null;
  routeColorHex: string;
  status: TransitStatus;
  createdAt: string;
  updatedAt: string;
  directions: RouteDirection[];
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface TransitRoutePage {
  routes: TransitRoute[];
  pagination: Pagination;
}

/** Slow mobile networks fail into the offline path instead of spinning indefinitely. */
export const ROUTE_REQUEST_TIMEOUT_MS = 15_000;

/** Public, unauthenticated Agent A transit-route endpoints (active routes and directions only). */
@Injectable({ providedIn: 'root' })
export class TransitRoutesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(APP_CONFIG).apiBaseUrl}/transit-routes`;
  private readonly cache = inject(RouteCacheService);

  list(query: { q?: string; page?: number; pageSize?: number }): Observable<TransitRoutePage> {
    let params = new HttpParams();
    // Contract: q is 1–160 chars; omit it rather than send an empty string.
    const q = query.q?.trim().slice(0, 160);
    if (q) params = params.set('q', q);
    if (query.page) params = params.set('page', query.page);
    if (query.pageSize) params = params.set('pageSize', query.pageSize);
    const cacheable = !q && (query.page ?? 1) === 1;
    return this.http.get<TransitRoutePage>(this.baseUrl, { params }).pipe(
      timeout(ROUTE_REQUEST_TIMEOUT_MS),
      tap((page) => cacheable && this.cache.saveList(page)),
    );
  }

  get(routeId: string): Observable<TransitRoute> {
    return this.http
      .get<{ route: TransitRoute }>(`${this.baseUrl}/${encodeURIComponent(routeId)}`)
      .pipe(
        timeout(ROUTE_REQUEST_TIMEOUT_MS),
        map((body) => body.route),
        tap({
          next: (route) => this.cache.saveDetail(route),
          // Deleted, deactivated (no longer public) or malformed id: drop any saved copy.
          error: (error) =>
            error instanceof HttpErrorResponse && [400, 404].includes(error.status) && this.cache.removeDetail(routeId),
        }),
      );
  }
}
