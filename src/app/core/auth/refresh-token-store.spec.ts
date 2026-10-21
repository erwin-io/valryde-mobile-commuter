import { HttpErrorResponse } from '@angular/common/http';
import { authErrorMessage } from './auth-errors';
import { memoryRefreshTokenStore, secureRefreshTokenStore } from './refresh-token-store';

describe('secureRefreshTokenStore', () => {
  it('writes, reads and removes one key in the native secure store', async () => {
    const values = new Map<string, string>();
    const plugin = {
      get: vi.fn(async ({ key }: { key: string }) => {
        if (!values.has(key)) throw new Error('Item with given key does not exist');
        return { value: values.get(key)! };
      }),
      set: vi.fn(async ({ key, value }: { key: string; value: string }) => (values.set(key, value), { value: true })),
      remove: vi.fn(async ({ key }: { key: string }) => {
        if (!values.delete(key)) throw new Error('missing');
        return { value: true };
      }),
    };
    const store = secureRefreshTokenStore(plugin);

    expect(await store.read()).toBeNull(); // missing key rejects inside the plugin
    await store.write('refresh-1');
    expect(plugin.set).toHaveBeenCalledWith({ key: 'valryde.refreshToken', value: 'refresh-1' });
    expect(await store.read()).toBe('refresh-1');
    await store.clear();
    await store.clear(); // clearing twice is harmless
    expect(await store.read()).toBeNull();
  });
});

describe('memoryRefreshTokenStore', () => {
  it('never touches localStorage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const store = memoryRefreshTokenStore();
    await store.write('refresh-1');
    expect(await store.read()).toBe('refresh-1');
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});

describe('authErrorMessage', () => {
  const err = (status: number, code?: string, requestId?: string) =>
    new HttpErrorResponse({ status, error: code ? { error: { code, message: 'raw', requestId } } : null });

  it('branches on the API code, never on the raw message', () => {
    expect(authErrorMessage(err(401, 'INVALID_CREDENTIALS'))).toBe('Email or password is incorrect.');
    expect(authErrorMessage(err(400, 'INVALID_CHALLENGE'))).toContain('expired');
    expect(authErrorMessage(err(403, 'EMAIL_NOT_VERIFIED'))).toContain('verify');
    expect(authErrorMessage(err(401, 'INVALID_CREDENTIALS'))).not.toContain('raw');
  });

  it('falls back to generic copy with the support reference', () => {
    expect(authErrorMessage(err(0))).toContain('Can’t reach VALRYDE');
    expect(authErrorMessage(err(500, 'INTERNAL_ERROR', 'req-5'))).toContain('req-5');
  });
});
