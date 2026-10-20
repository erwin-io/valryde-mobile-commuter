import { AppConfig } from '../app/core/app-config';

export const environment: AppConfig = {
  // OpenFreeMap is the approved MVP reference style; swap per environment without code changes.
  mapStyleUrl: 'https://tiles.openfreemap.org/styles/liberty',
  // Metro Manila overview until the user opts in to location.
  defaultCenter: [121.0, 14.6],
  defaultZoom: 11,
};
