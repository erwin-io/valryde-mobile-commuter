import { Injectable, InjectionToken, inject } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';

export type LngLat = [number, number];

export type LocationResult =
  | { kind: 'located'; position: LngLat }
  | { kind: 'denied' }
  | { kind: 'unavailable' };

export const GEOLOCATION = new InjectionToken<
  Pick<typeof Geolocation, 'getCurrentPosition' | 'checkPermissions' | 'watchPosition' | 'clearWatch'>
>('GEOLOCATION', { providedIn: 'root', factory: () => Geolocation });

/** Foreground phone location. Trip discovery may send a requested fix to VALRYDE with explicit consent. */
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
      const position = validPosition(coords.longitude, coords.latitude);
      return position ? { kind: 'located', position } : { kind: 'unavailable' };
    } catch {
      return (await this.isDenied()) ? { kind: 'denied' } : { kind: 'unavailable' };
    }
  }

  /**
   * Foreground position updates for follow mode. Returns a stop function; call it whenever following
   * ends so the GPS is not kept running. `onError` reports a denied or failed watch once, then stops.
   */
  async watch(onPosition: (position: LngLat) => void, onError: (result: LocationResult) => void): Promise<() => void> {
    let stopped = false;
    let cleared = false;
    let id: string | undefined;
    const clear = () => {
      if (id === undefined || cleared) return;
      cleared = true;
      void this.geolocation.clearWatch({ id }).catch(() => undefined);
    };
    const stop = () => {
      if (stopped) {
        clear();
        return;
      }
      stopped = true;
      clear();
    };
    try {
      id = await this.geolocation.watchPosition({ enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000 }, (position, error) => {
        if (stopped) return;
        if (position) {
          const coordinates = validPosition(position.coords.longitude, position.coords.latitude);
          if (coordinates) onPosition(coordinates);
          else {
            stop();
            onError({ kind: 'unavailable' });
          }
        } else if (error) {
          stop();
          void this.isDenied().then((denied) => onError(denied ? { kind: 'denied' } : { kind: 'unavailable' }));
        }
      });
      if (stopped) clear(); // stop() was called before the watch id arrived
    } catch {
      stop();
      onError((await this.isDenied()) ? { kind: 'denied' } : { kind: 'unavailable' });
    }
    return stop;
  }

  private async isDenied(): Promise<boolean> {
    try {
      return (await this.geolocation.checkPermissions()).location === 'denied';
    } catch {
      return false;
    }
  }
}

function validPosition(longitude: number, latitude: number): LngLat | null {
  return Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90
    ? [longitude, latitude]
    : null;
}
