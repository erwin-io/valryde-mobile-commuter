import { AppConfig } from '../app/core/app-config';

export const environment: AppConfig = {
  // Relative path works behind the ng serve proxy (proxy.conf.json); native builds need an absolute API origin.
  apiBaseUrl: '/api',
  // OpenFreeMap is the approved MVP reference style; swap per environment without code changes.
  mapStyleUrl: 'https://tiles.openfreemap.org/styles/liberty',
  // Cebu City overview (Tech Lead decision for the initial MVP) until the user opts in to location.
  defaultCenter: [123.8854, 10.3157],
  defaultZoom: 12,
};
