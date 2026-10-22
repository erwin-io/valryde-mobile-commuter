import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, TimeoutError, firstValueFrom, throwError } from 'rxjs';
import { toApiFailure } from '../../core/api-failure';
import { APP_CONFIG } from '../../core/app-config';
import { RouteBadgeComponent } from './route-badge.component';
import { ROUTE_CACHE_STORAGE, RouteCacheService } from './route-cache.service';
import { FALLBACK_ROUTE_COLOR, routeColor } from './route-geometry';
import { RouteSelectionService } from './route-selection.service';
import { RoutesPage } from './routes.page';
import { transitRoute } from './test-fixtures';
import { ROUTE_REQUEST_TIMEOUT_MS, TransitRoute, TransitRoutePage, TransitRoutesService } from './transit-routes.service';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const page = (routes = [transitRoute()]): TransitRoutePage => ({
  routes,
  pagination: { page: 1, pageSize: 20, total: routes.length, totalPages: 1 },
});
const offline = () => new HttpErrorResponse({ status: 0 });

describe('Route color validation', () => {
  it('accepts the contract #RRGGBB color and falls back to neutral for anything else', () => {
    expect(routeColor('#43A047')).toBe('#43A047');
    for (const bad of ['red', '#FFF', 'url(javascript:x)', '#12345G', null, undefined, 42]) {
      expect(routeColor(bad)).toBe(FALLBACK_ROUTE_COLOR);
    }
  });

  it('badges never render a malformed Admin color', () => {
    const fixture = TestBed.createComponent(RouteBadgeComponent);
    fixture.componentRef.setInput('code', '17B');
    fixture.componentRef.setInput('color', 'red;background:url(x)');
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.badge') as HTMLElement;
    expect(badge.style.background).toBe('rgb(94, 107, 101)'); // FALLBACK_ROUTE_COLOR
    expect(badge.textContent).toContain('17B');
  });
});

describe('TransitRoutesService caching and timeouts', () => {
  let http: HttpTestingController;
  let service: TransitRoutesService;
  let cache: RouteCacheService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: '/api' } },
        { provide: ROUTE_CACHE_STORAGE, useValue: memoryStorage() },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(TransitRoutesService);
    cache = TestBed.inject(RouteCacheService);
  });

  afterEach(() => http.verify());

  it('saves only the unfiltered first page of the list', () => {
    service.list({ q: '17B' }).subscribe();
    http.expectOne((r) => r.params.get('q') === '17B').flush(page());
    expect(cache.list()).toBeNull();
    service.list({ page: 2 }).subscribe();
    http.expectOne((r) => r.params.get('page') === '2').flush(page());
    expect(cache.list()).toBeNull();
    service.list({ page: 1 }).subscribe();
    http.expectOne((r) => r.params.get('page') === '1').flush(page());
    expect(cache.list()?.value.routes[0].routeCode).toBe('17B');
  });

  it('saves fresh route details and invalidates them on 404', async () => {
    service.get('route-1').subscribe();
    http.expectOne('/api/transit-routes/route-1').flush({ route: transitRoute() });
    expect(cache.detail('route-1')).not.toBeNull();

    const gone = firstValueFrom(service.get('route-1'));
    http.expectOne('/api/transit-routes/route-1').flush({ error: { code: 'NOT_FOUND' } }, { status: 404, statusText: 'x' });
    await expect(gone).rejects.toMatchObject({ status: 404 });
    expect(cache.detail('route-1')).toBeNull();
  });

  it('keeps the saved copy on a network failure', async () => {
    cache.saveDetail(transitRoute());
    const failed = firstValueFrom(service.get('route-1'));
    http.expectOne('/api/transit-routes/route-1').error(new ProgressEvent('error'));
    await expect(failed).rejects.toMatchObject({ status: 0 });
    expect(cache.detail('route-1')).not.toBeNull();
  });

  it('times out slow requests and treats them as offline', async () => {
    vi.useFakeTimers();
    try {
      const result = firstValueFrom(service.get('route-1'));
      const req = http.expectOne('/api/transit-routes/route-1');
      vi.advanceTimersByTime(ROUTE_REQUEST_TIMEOUT_MS + 1);
      const error = await result.catch((e: unknown) => e);
      expect(error).toBeInstanceOf(TimeoutError);
      expect(toApiFailure(error)).toEqual({ kind: 'network' });
      expect(req.cancelled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Offline fallbacks', () => {
  const get = vi.fn();
  const list = vi.fn();
  let cache: RouteCacheService;

  beforeEach(() => {
    get.mockReset();
    list.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        RouteSelectionService,
        { provide: TransitRoutesService, useValue: { get, list } },
        { provide: ROUTE_CACHE_STORAGE, useValue: memoryStorage() },
      ],
    });
    cache = TestBed.inject(RouteCacheService);
  });

  it('route detail: shows the saved copy, labelled with its save time, when offline', () => {
    cache.saveDetail(transitRoute());
    const savedAt = cache.detail('route-1')!.savedAt;
    get.mockReturnValue(throwError(offline));
    const selection = TestBed.inject(RouteSelectionService);
    selection.select('route-1', null);
    expect(selection.state()).toEqual({ status: 'ready', route: transitRoute(), savedAt });
    expect(selection.line()).not.toBeNull();
  });

  it('route detail: never uses the cache for server errors or missing routes', () => {
    cache.saveDetail(transitRoute());
    const selection = TestBed.inject(RouteSelectionService);
    get.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    selection.select('route-1', null);
    expect(selection.state()).toMatchObject({ status: 'error', failure: { kind: 'unavailable' } });
    selection.select(null, null);
    get.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    selection.select('route-1', null);
    expect(selection.state()).toMatchObject({ status: 'error', failure: { kind: 'not-found' } });
  });

  it('route detail: shows the offline error when nothing is saved', () => {
    get.mockReturnValue(throwError(offline));
    const selection = TestBed.inject(RouteSelectionService);
    selection.select('route-9', null);
    expect(selection.state()).toMatchObject({ status: 'error', failure: { kind: 'network' } });
  });

  async function renderRoutes() {
    const fixture = TestBed.createComponent(RoutesPage);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    return fixture;
  }
  const settle = async (fixture: { whenStable(): Promise<unknown> }) => {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };

  it('route list: shows the saved list with an offline label when the unfiltered load fails', async () => {
    cache.saveList(page([transitRoute({ routeCode: '04L' })]));
    list.mockReturnValue(throwError(offline));
    const fixture = await renderRoutes();
    await settle(fixture);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('04L');
    expect(text).toContain('You’re offline. Showing routes saved');
    expect(fixture.componentInstance.hasMore()).toBe(false);
  });

  it('route list: offline search shows an error instead of guessing from the cache', async () => {
    cache.saveList(page());
    const responses: Subject<TransitRoutePage>[] = [];
    list.mockImplementation(() => {
      const s = new Subject<TransitRoutePage>();
      responses.push(s);
      return s;
    });
    const fixture = await renderRoutes();
    const routesPage = fixture.componentInstance;
    routesPage.query.set('Talamban');
    void routesPage.load(true);
    responses[1].error(offline());
    await settle(fixture);
    expect(routesPage.status()).toBe('error');
    expect(fixture.nativeElement.textContent).toContain('Can’t reach VALRYDE');
  });

  it('route list: live data replaces the offline label', async () => {
    cache.saveList(page());
    list.mockReturnValueOnce(throwError(offline));
    const fixture = await renderRoutes();
    await settle(fixture);
    expect(fixture.componentInstance.offlineSavedAt()).not.toBeNull();
    const fresh = new Subject<TransitRoutePage>();
    list.mockReturnValueOnce(fresh);
    void fixture.componentInstance.load(true);
    fresh.next(page());
    await settle(fixture);
    expect(fixture.componentInstance.offlineSavedAt()).toBeNull();
  });

  it('opening a cached route still navigates through the normal map flow', async () => {
    cache.saveList(page());
    list.mockReturnValue(throwError(offline));
    const fixture = await renderRoutes();
    await settle(fixture);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.componentInstance.open(transitRoute() as TransitRoute);
    expect(navigate).toHaveBeenCalledWith(['/tabs/map'], { queryParams: { route: 'route-1' } });
  });
});
