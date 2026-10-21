import { TestBed } from '@angular/core/testing';
import { CacheStorage, ROUTE_CACHE_LIMITS, ROUTE_CACHE_STORAGE, RouteCacheService } from './route-cache.service';
import { direction, transitRoute } from './test-fixtures';

/** In-memory Storage stand-in; `quota` simulates a full WebView store. */
function memoryStorage(quota = Infinity): CacheStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      if (value.length > quota) throw new DOMException('quota', 'QuotaExceededError');
      data.set(key, value);
    },
    removeItem: (key) => void data.delete(key),
  };
}

describe('RouteCacheService', () => {
  let storage: ReturnType<typeof memoryStorage>;
  let cache: RouteCacheService;
  let now: number;

  function setup(store: CacheStorage | null = memoryStorage()) {
    TestBed.configureTestingModule({ providers: [{ provide: ROUTE_CACHE_STORAGE, useValue: store }] });
    cache = TestBed.inject(RouteCacheService);
    now = 1_000_000;
    cache.now = () => now;
  }

  beforeEach(() => {
    storage = memoryStorage();
    setup(storage);
  });

  it('returns a saved route detail with its save time', () => {
    cache.saveDetail(transitRoute());
    expect(cache.detail('route-1')).toEqual({ value: transitRoute(), savedAt: now });
  });

  it('expires entries after the maximum age', () => {
    cache.saveDetail(transitRoute());
    cache.saveList({ routes: [transitRoute()], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });
    now += ROUTE_CACHE_LIMITS.maxAgeMs + 1;
    expect(cache.detail('route-1')).toBeNull();
    expect(cache.list()).toBeNull();
  });

  it('invalidates a route the API no longer serves', () => {
    cache.saveDetail(transitRoute());
    cache.removeDetail('route-1');
    expect(cache.detail('route-1')).toBeNull();
  });

  it('keeps only the most recently saved details (count bound)', () => {
    for (let i = 0; i < ROUTE_CACHE_LIMITS.maxDetails + 5; i++) {
      now += 1;
      cache.saveDetail(transitRoute({ id: `route-${i}` }));
    }
    expect(cache.detail('route-0')).toBeNull();
    expect(cache.detail(`route-${ROUTE_CACHE_LIMITS.maxDetails + 4}`)).not.toBeNull();
    const stored = JSON.parse(storage.data.get('valryde.routeCache.v1')!);
    expect(Object.keys(stored.details)).toHaveLength(ROUTE_CACHE_LIMITS.maxDetails);
  });

  it('evicts the oldest details when the payload exceeds the size cap', () => {
    // ~4,000 points per route, ~80 kB each serialized; 25 of them (~2 M chars) exceed the 1.5 M cap.
    const coordinates = Array.from({ length: 4_000 }, (_, i) => [123.8 + i / 1e4, 10.3 + i / 1e4] as [number, number]);
    for (let i = 0; i < ROUTE_CACHE_LIMITS.maxDetails; i++) {
      now += 1;
      cache.saveDetail(transitRoute({ id: `big-${i}`, directions: [direction({ geometry: { type: 'LineString', coordinates } })] }));
    }
    const raw = storage.data.get('valryde.routeCache.v1')!;
    expect(raw.length).toBeLessThanOrEqual(ROUTE_CACHE_LIMITS.maxChars);
    expect(cache.detail(`big-${ROUTE_CACHE_LIMITS.maxDetails - 1}`)).not.toBeNull(); // newest kept
    expect(cache.detail('big-0')).toBeNull(); // oldest evicted
  });

  it('drops the cache instead of failing when the device store is full', () => {
    storage = memoryStorage(10);
    TestBed.resetTestingModule();
    setup(storage);
    expect(() => cache.saveDetail(transitRoute())).not.toThrow();
    expect(cache.detail('route-1')).toBeNull();
  });

  it('starts over when the stored payload is corrupt', () => {
    storage.data.set('valryde.routeCache.v1', '{not json');
    expect(cache.detail('route-1')).toBeNull();
    cache.saveDetail(transitRoute());
    expect(cache.detail('route-1')).not.toBeNull();
  });

  it('works without any storage (private mode or storage disabled)', () => {
    TestBed.resetTestingModule();
    setup(null);
    expect(() => cache.saveDetail(transitRoute())).not.toThrow();
    expect(cache.detail('route-1')).toBeNull();
  });

  it('stores only public route fields', () => {
    cache.saveDetail(transitRoute());
    const raw = storage.data.get('valryde.routeCache.v1')!;
    expect(raw).not.toMatch(/token|password|accessToken|refreshToken|email/i);
  });
});
