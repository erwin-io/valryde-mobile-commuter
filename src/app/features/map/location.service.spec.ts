import { TestBed } from '@angular/core/testing';
import { GEOLOCATION, LocationService } from './location.service';

describe('LocationService', () => {
  function setup(geolocation: { getCurrentPosition?: () => Promise<unknown>; permission?: string }) {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: GEOLOCATION,
          useValue: {
            getCurrentPosition: geolocation.getCurrentPosition ?? (() => Promise.reject(new Error())),
            checkPermissions: () =>
              geolocation.permission
                ? Promise.resolve({ location: geolocation.permission, coarseLocation: geolocation.permission })
                : Promise.reject(new Error('location services disabled')),
          },
        },
      ],
    });
    return TestBed.inject(LocationService);
  }

  it('returns WGS84 [longitude, latitude] when located', async () => {
    const service = setup({
      getCurrentPosition: () => Promise.resolve({ coords: { latitude: 14.6, longitude: 121.0 } }),
      permission: 'granted',
    });
    expect(await service.locate()).toEqual({ kind: 'located', position: [121.0, 14.6] });
  });

  it('reports denied when the request fails and permission is denied', async () => {
    const service = setup({ permission: 'denied' });
    expect(await service.locate()).toEqual({ kind: 'denied' });
  });

  it('reports unavailable for timeouts or disabled location services', async () => {
    expect(await setup({ permission: 'prompt' }).locate()).toEqual({ kind: 'unavailable' });
    TestBed.resetTestingModule();
    expect(await setup({}).locate()).toEqual({ kind: 'unavailable' });
  });

  it('rejects non-finite and out-of-range coordinates', async () => {
    const service = setup({
      getCurrentPosition: () => Promise.resolve({ coords: { latitude: 95, longitude: Number.NaN } }),
      permission: 'granted',
    });
    expect(await service.locate()).toEqual({ kind: 'unavailable' });
  });

  it('treats a permission check failure as not granted', async () => {
    expect(await setup({}).isGranted()).toBe(false);
    TestBed.resetTestingModule();
    expect(await setup({ permission: 'granted' }).isGranted()).toBe(true);
  });

  describe('watch (follow mode)', () => {
    type Callback = (position: { coords: { latitude: number; longitude: number } } | null, error?: unknown) => void;

    function setupWatch(permission = 'granted') {
      const state: { callback?: Callback; cleared: string[] } = { cleared: [] };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          {
            provide: GEOLOCATION,
            useValue: {
              checkPermissions: () => Promise.resolve({ location: permission, coarseLocation: permission }),
              watchPosition: (_options: unknown, callback: Callback) => {
                state.callback = callback;
                return Promise.resolve('watch-1');
              },
              clearWatch: ({ id }: { id: string }) => {
                state.cleared.push(id);
                return Promise.resolve();
              },
            },
          },
        ],
      });
      return { service: TestBed.inject(LocationService), state };
    }

    it('delivers [longitude, latitude] updates until stopped, then clears the watch', async () => {
      const { service, state } = setupWatch();
      const positions: unknown[] = [];
      const stop = await service.watch((p) => positions.push(p), vi.fn());
      state.callback?.({ coords: { latitude: 10.31, longitude: 123.89 } });
      stop();
      state.callback?.({ coords: { latitude: 10.4, longitude: 123.9 } });
      expect(positions).toEqual([[123.89, 10.31]]);
      expect(state.cleared).toEqual(['watch-1']);
    });

    it('clears a watch only once when stop is repeated', async () => {
      const { service, state } = setupWatch();
      const stop = await service.watch(vi.fn(), vi.fn());
      stop();
      stop();
      expect(state.cleared).toEqual(['watch-1']);
    });

    it('stops and reports unavailable for an invalid coordinate update', async () => {
      const { service, state } = setupWatch();
      const onError = vi.fn();
      const onPosition = vi.fn();
      await service.watch(onPosition, onError);
      state.callback?.({ coords: { latitude: 10.31, longitude: Number.POSITIVE_INFINITY } });
      expect(onPosition).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith({ kind: 'unavailable' });
      expect(state.cleared).toEqual(['watch-1']);
    });

    it('reports a denied watch once and stops it', async () => {
      const { service, state } = setupWatch('denied');
      const onError = vi.fn();
      await service.watch(vi.fn(), onError);
      state.callback?.(null, new Error('denied'));
      await new Promise((resolve) => setTimeout(resolve));
      expect(onError).toHaveBeenCalledWith({ kind: 'denied' });
      expect(state.cleared).toEqual(['watch-1']);
    });
  });
});
