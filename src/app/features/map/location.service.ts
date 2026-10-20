import { Injectable, InjectionToken, inject } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';

export type LngLat = [number, number];

export type LocationResult =
  | { kind: 'located'; position: LngLat }
  | { kind: 'denied' }
  | { kind: 'unavailable' };

export const GEOLOCATION = new InjectionToken<
  Pick<typeof Geolocation, 'getCurrentPosition' | 'checkPermissions'>
>('GEOLOCATION', { providedIn: 'root', factory: () => Geolocation });

/** Foreground, on-device location for map context only. The position is never transmitted. */
@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly geolocation = inject(GEOLOCATION);

  async isGranted(): Promise<boolean> {
    try {
      return (await this.geolocation.checkPermissions()).location === 'granted';
    } catch {
      // Throws when system location services are disabled.
      return false;
    }
  }

  /** Prompts for permission when needed (native plugin and browser both do this on request). */
  async locate(): Promise<LocationResult> {
    try {
      const { coords } = await this.geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 60_000,
      });
      return { kind: 'located', position: [coords.longitude, coords.latitude] };
    } catch {
      return (await this.isDenied()) ? { kind: 'denied' } : { kind: 'unavailable' };
    }
  }

  private async isDenied(): Promise<boolean> {
    try {
      return (await this.geolocation.checkPermissions()).location === 'denied';
    } catch {
      return false;
    }
  }
}
