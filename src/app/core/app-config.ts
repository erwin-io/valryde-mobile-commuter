import { InjectionToken } from '@angular/core';

export interface AppConfig {
  mapStyleUrl: string;
  /** WGS84 [longitude, latitude]. */
  defaultCenter: [number, number];
  defaultZoom: number;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');
