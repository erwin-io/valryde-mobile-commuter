import { DestroyRef, Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { PublicVehicle, TRACKING_GATEWAY } from './tracking-gateway';

export const VEHICLE_FRESHNESS_MS = 30_000;
type TrackingStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'offline';

/** UI state only: narrows a server-eligible set and hides expired/malformed observations; never grants eligibility. */
@Injectable()
export class VehicleTrackingStore {
  private readonly gateway = inject(TRACKING_GATEWAY);
  private readonly zone = inject(NgZone);
  private expiryTimer?: ReturnType<typeof setTimeout>;
  private request?: Subscription;
  private directionId: string | null = null;
  private visible = false;
  private online = true;
  private generation = 0;
  private revision = -1;
  private readonly observations = signal<PublicVehicle[]>([]);
  private readonly now = signal(Date.now());
  readonly status = signal<TrackingStatus>('idle');
  readonly selectedId = signal<string | null>(null);
  readonly vehicles = computed(() =>
    this.status() === 'ready'
      ? this.observations().filter(
          (vehicle) => this.now() - vehicle.observedAtMs <= VEHICLE_FRESHNESS_MS,
        )
      : [],
  );
  readonly count = computed(() => (this.status() === 'ready' ? this.vehicles().length : null));
  readonly selected = computed(
    () => this.vehicles().find((v) => v.id === this.selectedId()) ?? null,
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.disconnect();
    });
  }

  connect(directionId: string | null, visible: boolean, online: boolean): void {
    if (directionId === this.directionId && visible === this.visible && online === this.online)
      return;
    this.directionId = directionId;
    this.visible = visible;
    this.online = online;
    this.reconcile();
  }

  reconcile(): void {
    this.disconnect();
    this.observations.set([]);
    this.selectedId.set(null);
    this.revision = -1;
    if (!this.directionId || !this.visible) {
      this.status.set('idle');
      return;
    }
    if (!this.online) {
      this.status.set('offline');
      return;
    }
    this.status.set('loading');
    const generation = this.generation;
    try {
      this.request = this.gateway.watch(this.directionId).subscribe({
        next: (state) => {
          if (generation !== this.generation) return;
          if (state.kind === 'unavailable') {
            this.observations.set([]);
            this.scheduleExpiry();
            this.status.set('unavailable');
            return;
          }
          if (!Number.isSafeInteger(state.revision) || state.revision <= this.revision) return;
          this.revision = state.revision;
          const now = Date.now();
          this.now.set(now);
          const previous = new Map(this.observations().map((v) => [v.id, v]));
          const vehicles = new Map<string, PublicVehicle>();
          for (const incoming of state.vehicles) {
            if (!validVehicle(incoming, this.directionId, now)) continue;
            const old = previous.get(incoming.id);
            // Never move backward in observation time, even in a newer snapshot.
            const chosen = old && incoming.observedAtMs < old.observedAtMs ? old : incoming;
            const duplicate = vehicles.get(chosen.id);
            if (duplicate && duplicate.observedAtMs >= chosen.observedAtMs) continue;
            vehicles.set(chosen.id, publicCopy(chosen));
          }
          this.observations.set([...vehicles.values()]);
          this.status.set('ready');
          this.scheduleExpiry();
        },
        error: () => {
          if (generation === this.generation) {
            this.observations.set([]);
            this.scheduleExpiry();
            this.status.set('unavailable');
          }
        },
      });
    } catch {
      this.status.set('unavailable');
    }
  }

  private disconnect(): void {
    this.generation++;
    this.request?.unsubscribe();
    clearTimeout(this.expiryTimer);
  }

  /** Expire at the next observation deadline without polling or stale display drift. */
  private scheduleExpiry(): void {
    clearTimeout(this.expiryTimer);
    const now = Date.now();
    const deadlines = this.observations()
      .map((v) => v.observedAtMs + VEHICLE_FRESHNESS_MS + 1)
      .filter((t) => t > now);
    if (!deadlines.length) return;
    this.expiryTimer = this.zone.runOutsideAngular(() =>
      setTimeout(
        () => {
          this.now.set(Date.now());
          this.scheduleExpiry();
        },
        Math.min(...deadlines) - now,
      ),
    );
  }
}

function validVehicle(v: PublicVehicle, direction: string | null, now: number): boolean {
  return (
    v.available === true &&
    v.directionId === direction &&
    !!v.id &&
    Number.isFinite(v.observedAtMs) &&
    v.observedAtMs <= now &&
    now - v.observedAtMs <= VEHICLE_FRESHNESS_MS &&
    Array.isArray(v.position) &&
    v.position.length === 2 &&
    Number.isFinite(v.position[0]) &&
    Math.abs(v.position[0]) <= 180 &&
    Number.isFinite(v.position[1]) &&
    Math.abs(v.position[1]) <= 90
  );
}

/** Deliberately copy public fields: extra driver/operator/device fields cannot reach DOM state. */
function publicCopy(v: PublicVehicle): PublicVehicle {
  return {
    id: v.id,
    directionId: v.directionId,
    position: [v.position[0], v.position[1]],
    plateNumber: v.plateNumber,
    routeLabel: v.routeLabel,
    directionLabel: v.directionLabel,
    vehicleColor: /^#[0-9a-f]{6}$/i.test(v.vehicleColor) ? v.vehicleColor : '#475467',
    statusLabel: v.statusLabel,
    observedAtMs: v.observedAtMs,
    available: true,
  };
}
