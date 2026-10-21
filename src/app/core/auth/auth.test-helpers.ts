import { AuthUser, TokenBundle } from './auth-api.service';

/** Test-only builders shaped like Agent A's OpenAPI. Never imported by runtime code. */
export const testUser: AuthUser = {
  id: 'u1',
  email: 'rider@example.test',
  displayName: 'Rider',
  status: 'ACTIVE',
  emailVerified: true,
  roles: ['COMMUTER'],
  createdAt: '2026-10-21T00:00:00.000Z',
  updatedAt: '2026-10-21T00:00:00.000Z',
};

export function bundle(n: number, expiresIn = 900): TokenBundle {
  return {
    accessToken: `access-${n}`,
    refreshToken: `refresh-${n}`,
    accessTokenExpiresIn: expiresIn,
    refreshTokenExpiresAt: '2026-11-21T00:00:00.000Z',
    user: testUser,
  };
}
