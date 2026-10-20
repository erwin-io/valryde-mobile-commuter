import { LngLat } from '../map/location.service';
import { RouteDirection } from './transit-routes.service';

/**
 * Returns the direction's coordinates only when they form a drawable WGS84 LineString.
 * Admin geometry is authoritative: invalid input is rejected, never repaired or simplified.
 */
export function drawableCoordinates(geometry: RouteDirection['geometry'] | null | undefined): LngLat[] | null {
  const coordinates = geometry?.coordinates;
  if (geometry?.type !== 'LineString' || !Array.isArray(coordinates) || coordinates.length < 2) return null;
  const valid = coordinates.every(
    (p) =>
      Array.isArray(p) &&
      Number.isFinite(p[0]) &&
      Number.isFinite(p[1]) &&
      Math.abs(p[0]) <= 180 &&
      Math.abs(p[1]) <= 90,
  );
  return valid ? coordinates.map((p) => [p[0], p[1]] as LngLat) : null;
}

/** Black or white text for a route-color badge, by WCAG relative luminance. */
export function badgeTextColor(hex: string): '#000000' | '#FFFFFF' {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  // Pick whichever contrast ratio is higher against the badge color.
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : '#FFFFFF';
}
