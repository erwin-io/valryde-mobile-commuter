import { InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

/** Where the refresh token lives between app launches. The access token is memory-only. */
export interface RefreshTokenStore {
  read(): Promise<string | null>;
  write(token: string): Promise<void>;
  clear(): Promise<void>;
}

const KEY = 'valryde.refreshToken';

type SecureStorage = Pick<typeof SecureStoragePlugin, 'get' | 'set' | 'remove' | 'keys'>;

/** iOS Keychain / Android Keystore via capacitor-secure-storage-plugin. */
export function secureRefreshTokenStore(storage: SecureStorage): RefreshTokenStore {
  return {
    async read() {
      // `get` rejects both when the key is absent and when the native store is unavailable.
      // Checking the plugin-owned key list first lets real Keychain/Keystore failures reach the
      // session UI instead of being misreported as a signed-out user.
      if (!(await storage.keys()).value.includes(KEY)) return null;
      return (await storage.get({ key: KEY })).value || null;
    },
    async write(token) {
      await storage.set({ key: KEY, value: token });
    },
    async clear() {
      if ((await storage.keys()).value.includes(KEY)) await storage.remove({ key: KEY });
    },
  };
}

/**
 * Browser fallback. The plugin's web implementation is plain localStorage, which the Agent A
 * handoff forbids for refresh tokens, so the browser keeps the session for the page's lifetime only.
 */
export function memoryRefreshTokenStore(): RefreshTokenStore {
  let token: string | null = null;
  return {
    read: async () => token,
    write: async (value) => void (token = value),
    clear: async () => void (token = null),
  };
}

export const REFRESH_TOKEN_STORE = new InjectionToken<RefreshTokenStore>('REFRESH_TOKEN_STORE', {
  providedIn: 'root',
  factory: () =>
    Capacitor.isNativePlatform() ? secureRefreshTokenStore(SecureStoragePlugin) : memoryRefreshTokenStore(),
});
