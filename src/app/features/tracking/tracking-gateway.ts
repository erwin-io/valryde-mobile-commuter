import { InjectionToken } from '@angular/core';
import { Observable, of } from 'rxjs';
import { LngLat } from '../map/location.service';

/** Internal UI adapter model, NOT an approved Agent B REST/Pusher DTO. */
export interface PublicVehicle {
  id: string;
  directionId: string;
  position: LngLat;
  plateNumber: string;
  routeLabel: string;
  directionLabel: string;
  vehicleColor: string;
  statusLabel: string;
  observedAtMs: number;
  /** Adapter must copy the server-authoritative eligibility decision; never derive compliance here. */
  available: boolean;
}
export type GatewayState =
  | { kind: 'unavailable' }
  | { kind: 'snapshot'; revision: number; vehicles: readonly PublicVehicle[] };

export interface TrackingGateway {
  /** Each subscription must start with a fresh authoritative snapshot, including after reconnect/resume.
   * Revisions increase within that subscription. Full snapshots replace membership and remove missing IDs.
   * The future wire adapter owns authorization, ordering, removals and REST reconciliation. */
  watch(directionId: string): Observable<GatewayState>;
}

/** Fail closed until Agent B publishes the approved gateway contract. No mock or URL in production. */
export const TRACKING_GATEWAY = new InjectionToken<TrackingGateway>('TRACKING_GATEWAY', {
  providedIn: 'root',
  factory: () => ({ watch: () => of({ kind: 'unavailable' }) }),
});
