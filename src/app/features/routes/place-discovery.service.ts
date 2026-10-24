import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, timeout } from 'rxjs';
import { APP_CONFIG } from '../../core/app-config';
import { REQUIRES_AUTH } from '../../core/auth/auth-api.service';

/** Mirrors merged valryde-api G6 routes at 810c8a1, not the historical proposal. */
export interface Place {
  id: string;
  name: string;
  label: string;
  lat: number;
  lng: number;
}
export interface PlaceResults {
  places: Place[];
  attribution: string;
}
export interface DirectRoute {
  route: { id: string; routeCode: string; publicName: string; routeColorHex: string };
  direction: { id: string; directionLabel: string; originName: string; destinationName: string };
  originDistanceM: number;
  destinationDistanceM: number;
}
export interface DiscoveryResults {
  candidates: DirectRoute[];
  directRouteFound: boolean;
}
export type Point = Pick<Place, 'lat' | 'lng'>;

export function withinPhilippines(point: Point): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= 4 &&
    point.lat <= 21.5 &&
    point.lng >= 116 &&
    point.lng <= 127
  );
}

/** Queries and coordinates remain in memory; no client cache or provider calls. */
@Injectable({ providedIn: 'root' })
export class PlaceDiscoveryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(APP_CONFIG).apiBaseUrl;

  search(query: string): Observable<PlaceResults> {
    return this.http
      .get<PlaceResults>(`${this.baseUrl}/places/search`, {
        context: new HttpContext().set(REQUIRES_AUTH, true),
        params: new HttpParams().set('q', query.trim()).set('limit', 5),
      })
      .pipe(timeout(15_000));
  }

  discover(origin: Point, destination: Point): Observable<DiscoveryResults> {
    return this.http
      .get<DiscoveryResults>(`${this.baseUrl}/transit-routes/discover`, {
        params: new HttpParams()
          .set('lat', origin.lat)
          .set('lng', origin.lng)
          .set('destinationLat', destination.lat)
          .set('destinationLng', destination.lng)
          .set('maxWalkM', 500)
          .set('limit', 5),
      })
      .pipe(timeout(15_000));
  }
}
