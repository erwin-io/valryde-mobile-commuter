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

  it('treats a permission check failure as not granted', async () => {
    expect(await setup({}).isGranted()).toBe(false);
    TestBed.resetTestingModule();
    expect(await setup({ permission: 'granted' }).isGranted()).toBe(true);
  });
});
