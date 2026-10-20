import { RouteDirection, TransitRoute } from './transit-routes.service';

/** Test-only DTO builders shaped like Agent A's OpenAPI. Never imported by runtime code. */
export function direction(overrides: Partial<RouteDirection> = {}): RouteDirection {
  return {
    id: 'dir-a',
    routeId: 'route-1',
    directionLabel: 'Outbound',
    originName: 'Carbon Market',
    destinationName: 'IT Park',
    geometry: {
      type: 'LineString',
      coordinates: [
        [123.8995, 10.2925],
        [123.9055, 10.3301],
      ],
    },
    corridorM: 100,
    status: 'ACTIVE',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

export function transitRoute(overrides: Partial<TransitRoute> = {}): TransitRoute {
  return {
    id: 'route-1',
    routeCode: '17B',
    publicName: 'Carbon – IT Park',
    description: null,
    routeColorHex: '#1E3A8A',
    status: 'ACTIVE',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    directions: [direction()],
    ...overrides,
  };
}
