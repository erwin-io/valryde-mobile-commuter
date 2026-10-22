import { InjectionToken } from '@angular/core';
import { Map as MapLibreMap, Marker } from 'maplibre-gl';
import type { MapLike } from '../map/transit-map.component';
import { LngLat } from '../map/location.service';
import { interpolatePosition, sampleAnimation } from './foundation/animation';
import { PublicVehicle } from './tracking-gateway';

export interface VehicleMarker {
  setLngLat(position: LngLat): unknown;
  remove(): void;
}
export type VehicleMarkerFactory = (map: MapLike, element: HTMLElement) => VehicleMarker;
export const VEHICLE_MARKER_FACTORY = new InjectionToken<VehicleMarkerFactory>(
  'VEHICLE_MARKER_FACTORY',
  {
    providedIn: 'root',
    factory: () => (map, element) =>
      new Marker({ element }).setLngLat([0, 0]).addTo(map as MapLibreMap),
  },
);
export interface AnimationScheduler {
  now(): number;
  request(callback: FrameRequestCallback): number;
  cancel(id: number): void;
}
const scheduler: AnimationScheduler = {
  now: () => performance.now(),
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => cancelAnimationFrame(id),
};
interface Entry {
  marker: VehicleMarker;
  button: HTMLButtonElement;
  position: LngLat;
  frame?: number;
  observedAtMs: number;
  animation: number;
}

/** Accessible route-labelled markers; animation is bounded between received fixes, never extrapolated. */
export class VehicleMarkerRenderer {
  private readonly entries = new Map<string, Entry>();
  constructor(
    private readonly map: MapLike,
    private readonly createMarker: VehicleMarkerFactory,
    private readonly select: (id: string) => void,
    private readonly frames = scheduler,
  ) {}

  render(vehicles: readonly PublicVehicle[], animate: boolean): void {
    const ids = new Set(vehicles.map((v) => v.id));
    for (const [id, entry] of this.entries) if (!ids.has(id)) this.remove(id, entry);
    for (const vehicle of vehicles) {
      let entry = this.entries.get(vehicle.id);
      if (!entry) {
        const button = document.createElement('button');
        button.type = 'button';
        button.style.cssText =
          'min-width:44px;min-height:44px;padding:6px 8px;border:3px solid #fff;border-radius:10px;box-shadow:0 1px 5px #0008;background:#fff;color:#101828;font:600 14px system-ui;cursor:pointer';
        button.addEventListener('click', () => this.select(vehicle.id));
        entry = {
          button,
          marker: this.createMarker(this.map, button),
          position: [...vehicle.position],
          observedAtMs: -1,
          animation: 0,
        };
        this.entries.set(vehicle.id, entry);
      }
      entry.button.textContent = vehicle.routeLabel;
      entry.button.setAttribute(
        'aria-label',
        `${vehicle.routeLabel}, ${vehicle.directionLabel}, plate ${vehicle.plateNumber}, ${vehicle.statusLabel}`,
      );
      entry.button.title = `${vehicle.plateNumber} · ${vehicle.directionLabel}`;
      entry.button.style.borderBottomColor = /^#[0-9a-f]{6}$/i.test(vehicle.vehicleColor)
        ? vehicle.vehicleColor
        : '#475467';
      if (entry.observedAtMs === vehicle.observedAtMs) continue;
      if (entry.frame !== undefined) this.frames.cancel(entry.frame);
      const from = entry.position;
      const startedAt = this.frames.now();
      const duration = animate && entry.observedAtMs >= 0 ? 500 : 0;
      entry.observedAtMs = vehicle.observedAtMs;
      const animation = ++entry.animation;
      const update = () => {
        if (this.entries.get(vehicle.id) !== entry || entry.animation !== animation) return;
        const sample = sampleAnimation(this.frames.now(), startedAt, duration);
        entry.position = interpolatePosition(from, vehicle.position, sample.progress);
        entry.marker.setLngLat(entry.position);
        entry.frame = sample.done ? undefined : this.frames.request(update);
      };
      update();
    }
  }

  clear(): void {
    for (const [id, entry] of this.entries) this.remove(id, entry);
  }
  private remove(id: string, entry: Entry): void {
    if (entry.frame !== undefined) this.frames.cancel(entry.frame);
    entry.marker.remove();
    this.entries.delete(id);
  }
}
