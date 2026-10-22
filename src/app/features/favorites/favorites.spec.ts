import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { REFRESH_TOKEN_STORE } from '../../core/auth/refresh-token-store';
import { RouteDetailComponent } from '../routes/route-detail.component';
import { direction, transitRoute } from '../routes/test-fixtures';
import { TransitRoutesService } from '../routes/transit-routes.service';
import { FAVORITES_STORE, FavoritesService, MAX_FAVORITES } from './favorites.service';
import { FavoritesPage } from './favorites.page';

/** In-memory Preferences stand-in; `delays` lets a test hold individual writes open. */
function fakePreferences(initial: string | null = null) {
  const data = new Map<string, string>();
  if (initial !== null) data.set('valryde.favorites.v1', initial);
  const writes: string[] = [];
  return {
    data,
    writes,
    get: vi.fn(async ({ key }: { key: string }) => ({ value: data.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      writes.push(value);
      data.set(key, value);
    }),
  };
}

/**
 * ion-button copies aria-* into the native button in its shadow root (what screen readers read), once.
 * Prefer that inner value so a stale label is caught.
 */
function aria(el: Element | null, name: string): string | null {
  return el?.shadowRoot?.querySelector('button')?.getAttribute(name) ?? el?.getAttribute(name) ?? null;
}

const settle = async (fixture: { whenStable(): Promise<unknown> }) => {
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
};

describe('FavoritesService', () => {
  let store: ReturnType<typeof fakePreferences>;
  let favorites: FavoritesService;

  function setup(initial: string | null = null) {
    store = fakePreferences(initial);
    TestBed.configureTestingModule({ providers: [{ provide: FAVORITES_STORE, useValue: store }] });
    favorites = TestBed.inject(FavoritesService);
  }

  it('saves a route with its direction and persists only identifiers', async () => {
    setup();
    expect(await favorites.save('route-1', 'dir-a')).toBe('saved');
    expect(favorites.isFavorite('route-1')).toBe(true);
    const stored = JSON.parse(store.data.get('valryde.favorites.v1')!);
    expect(stored).toEqual([{ routeId: 'route-1', directionId: 'dir-a', savedAt: expect.any(Number) }]);
    expect(Object.keys(stored[0]).sort()).toEqual(['directionId', 'routeId', 'savedAt']);
  });

  it('prevents duplicates: saving again updates the direction and moves it to the top', async () => {
    setup();
    await favorites.save('route-1', 'dir-a');
    await favorites.save('route-2', null);
    await favorites.save('route-1', 'dir-b');
    expect(favorites.favorites().map((f) => [f.routeId, f.directionId])).toEqual([
      ['route-1', 'dir-b'],
      ['route-2', null],
    ]);
  });

  it('removes a favorite and persists the change', async () => {
    setup();
    await favorites.save('route-1', null);
    await favorites.remove('route-1');
    expect(favorites.isFavorite('route-1')).toBe(false);
    expect(JSON.parse(store.data.get('valryde.favorites.v1')!)).toEqual([]);
  });

  it('caps the list and reports when it is full', async () => {
    setup(JSON.stringify(Array.from({ length: MAX_FAVORITES }, (_, i) => ({ routeId: `r${i}`, directionId: null, savedAt: i }))));
    expect(await favorites.save('one-more', null)).toBe('full');
    expect(favorites.favorites()).toHaveLength(MAX_FAVORITES);
    expect(await favorites.save('r3', 'dir')).toBe('saved'); // re-saving an existing one still works
  });

  it('loads saved favorites and drops malformed, duplicate or oversized entries', async () => {
    setup(
      JSON.stringify([
        { routeId: 'route-1', directionId: 'dir-a', savedAt: 2 },
        { routeId: 'route-1', directionId: 'dup', savedAt: 1 },
        { routeId: 42 },
        null,
        { routeId: 'x'.repeat(65) },
        { routeId: 'route-2', directionId: { evil: true } },
      ]),
    );
    await favorites.load();
    expect(favorites.favorites()).toEqual([
      { routeId: 'route-1', directionId: 'dir-a', savedAt: 2 },
      { routeId: 'route-2', directionId: null, savedAt: 0 },
    ]);
  });

  it('starts empty when the stored value is corrupt', async () => {
    setup('{not json');
    await favorites.load();
    expect(favorites.favorites()).toEqual([]);
    expect(favorites.loadFailed()).toBe(false);
  });

  it('surfaces a storage read failure and refuses to overwrite unknown persisted data', async () => {
    setup();
    store.get.mockRejectedValue(new Error('unavailable'));
    await favorites.load();
    expect(favorites.loaded()).toBe(true);
    expect(favorites.loadFailed()).toBe(true);
    await expect(favorites.save('route-1', null)).rejects.toThrow('Favorite storage is unavailable');
    expect(store.set).not.toHaveBeenCalled();
  });

  it('restores saved favorites after an app-service restart', async () => {
    setup();
    await favorites.save('route-1', 'dir-a');
    const persistedStore = store;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: FAVORITES_STORE, useValue: persistedStore }] });
    favorites = TestBed.inject(FavoritesService);
    await favorites.load();
    expect(favorites.favorites()).toEqual([
      { routeId: 'route-1', directionId: 'dir-a', savedAt: expect.any(Number) },
    ]);
  });

  it('serializes writes so the last change wins', async () => {
    setup();
    await Promise.all([favorites.save('route-1', null), favorites.save('route-2', null), favorites.remove('route-1')]);
    expect(JSON.parse(store.data.get('valryde.favorites.v1')!).map((f: { routeId: string }) => f.routeId)).toEqual([
      'route-2',
    ]);
  });

  it('keeps memory truthful after a failed write and allows a later operation to recover', async () => {
    setup();
    store.set.mockRejectedValueOnce(new Error('storage full'));
    await expect(favorites.save('route-1', null)).rejects.toThrow('storage full');
    expect(favorites.isFavorite('route-1')).toBe(false);

    expect(await favorites.save('route-2', 'dir-a')).toBe('saved');
    expect(favorites.favorites().map((favorite) => favorite.routeId)).toEqual(['route-2']);
  });

  it('never touches secure authentication storage', async () => {
    const secure = { read: vi.fn(), write: vi.fn(), clear: vi.fn() };
    store = fakePreferences();
    TestBed.configureTestingModule({
      providers: [
        { provide: FAVORITES_STORE, useValue: store },
        { provide: REFRESH_TOKEN_STORE, useValue: secure },
      ],
    });
    await TestBed.inject(FavoritesService).save('route-1', null);
    expect(secure.write).not.toHaveBeenCalled();
    expect(secure.read).not.toHaveBeenCalled();
  });
});

describe('FavoritesPage', () => {
  const get = vi.fn();
  beforeEach(() => get.mockReset());

  async function render(initial: unknown[], store = fakePreferences(JSON.stringify(initial))) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: FAVORITES_STORE, useValue: store },
        { provide: TransitRoutesService, useValue: { get } },
      ],
    });
    const fixture = TestBed.createComponent(FavoritesPage);
    fixture.autoDetectChanges();
    await settle(fixture);
    await settle(fixture);
    return { fixture, page: fixture.componentInstance, store, text: () => fixture.nativeElement.textContent as string };
  }

  it('shows a useful empty state and the device-only note', async () => {
    const { text } = await render([]);
    expect(text()).toContain('No favorite routes yet');
    expect(text()).toContain('saved on this device only');
  });

  it('shows a retry instead of an empty list when device storage cannot be read', async () => {
    const store = fakePreferences(JSON.stringify([{ routeId: 'route-1', directionId: null, savedAt: 1 }]));
    store.get.mockRejectedValueOnce(new Error('device locked'));
    const { fixture, page, text } = await render([], store);
    expect(text()).toContain('Couldn’t read favorites');
    expect(text()).not.toContain('No favorite routes yet');

    get.mockReturnValue(of(transitRoute()));
    await page.refresh();
    await settle(fixture);
    expect(text()).toContain('17B');
  });

  it('lists saved routes with the saved direction and opens the existing map flow', async () => {
    const route = transitRoute({
      directions: [direction({ id: 'out' }), direction({ id: 'in', originName: 'IT Park', destinationName: 'Carbon Market' })],
    });
    get.mockReturnValue(of(route));
    const { fixture, page, text } = await render([{ routeId: 'route-1', directionId: 'in', savedAt: 1 }]);
    expect(text()).toContain('17B');
    expect(text()).toContain('IT Park → Carbon Market');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    (fixture.nativeElement.querySelector('ion-item') as HTMLElement).click();
    expect(navigate).toHaveBeenCalledWith(['/tabs/map'], { queryParams: { route: 'route-1', direction: 'in' } });
    expect(page).toBeTruthy();
  });

  it('drops a saved direction the route no longer has when opening', async () => {
    get.mockReturnValue(of(transitRoute()));
    const { fixture } = await render([{ routeId: 'route-1', directionId: 'gone', savedAt: 1 }]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    (fixture.nativeElement.querySelector('ion-item') as HTMLElement).click();
    expect(navigate).toHaveBeenCalledWith(['/tabs/map'], { queryParams: { route: 'route-1' } });
  });

  it('marks a route that became unavailable and lets the user remove it', async () => {
    get.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const { fixture, text } = await render([{ routeId: 'gone-route', directionId: null, savedAt: 1 }]);
    expect(text()).toContain('Route no longer available');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    (fixture.nativeElement.querySelector('ion-item') as HTMLElement).click();
    expect(navigate).not.toHaveBeenCalled();
    const buttons = [...fixture.nativeElement.querySelectorAll('ion-item ion-button')] as HTMLElement[];
    const remove = buttons.at(-1)!;
    expect(aria(remove, 'aria-label')).toBe('Remove from favorites');
    remove.click();
    await settle(fixture);
    expect(text()).toContain('No favorite routes yet');
  });

  it('does not request a route twice when the tab is entered while it is loading', async () => {
    get.mockReturnValue(of(transitRoute()));
    const { page } = await render([{ routeId: 'route-1', directionId: null, savedAt: 1 }]);
    get.mockClear();
    get.mockReturnValue(new Subject());
    const favorites = TestBed.inject(FavoritesService);
    await favorites.remove('route-1');
    await favorites.save('route-2', null);
    void page.refresh();
    page.ionViewWillEnter();
    await new Promise((resolve) => setTimeout(resolve));
    expect(get).toHaveBeenCalledOnce();
  });

  it('distinguishes a network failure (retry) from an unavailable route', async () => {
    get.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
    const { fixture, text } = await render([{ routeId: 'route-1', directionId: null, savedAt: 1 }]);
    expect(text()).toContain('Couldn’t load this route');
    get.mockReturnValueOnce(of(transitRoute()));
    (fixture.nativeElement.querySelector('ion-item ion-button') as HTMLElement).click();
    await settle(fixture);
    expect(text()).toContain('17B');
  });

  it('keeps a favorite visible and reports when device removal cannot be stored', async () => {
    get.mockReturnValue(of(transitRoute()));
    const initial = [{ routeId: 'route-1', directionId: null, savedAt: 1 }];
    const store = fakePreferences(JSON.stringify(initial));
    store.set.mockRejectedValueOnce(new Error('storage unavailable'));
    const { fixture, text } = await render(initial, store);

    const buttons = [...fixture.nativeElement.querySelectorAll('ion-item ion-button')] as HTMLElement[];
    buttons.at(-1)!.click();
    await settle(fixture);
    expect(text()).toContain('Couldn’t update favorites on this device');
    expect(text()).toContain('17B');
  });
});

describe('Route sheet favorite toggle', () => {
  it('saves with the shown direction, reflects state for assistive tech, and removes', async () => {
    const store = fakePreferences();
    TestBed.configureTestingModule({ providers: [{ provide: FAVORITES_STORE, useValue: store }] });
    const fixture = TestBed.createComponent(RouteDetailComponent);
    const route = transitRoute({ directions: [direction({ id: 'out' }), direction({ id: 'in' })] });
    fixture.componentRef.setInput('state', { status: 'ready', route });
    fixture.componentRef.setInput('direction', route.directions[1]);
    fixture.autoDetectChanges();
    await settle(fixture);

    // The star is the first header button when the route is ready (the close button is last).
    const button = () => fixture.nativeElement.querySelectorAll('ion-buttons ion-button')[0] as HTMLElement;
    expect(fixture.nativeElement.querySelectorAll('ion-buttons ion-button')).toHaveLength(2);
    expect(aria(button(), 'aria-label')).toBe('Save to favorites');
    await fixture.componentInstance.toggleFavorite();
    await settle(fixture);
    expect(JSON.parse(store.data.get('valryde.favorites.v1')!)[0]).toMatchObject({ routeId: 'route-1', directionId: 'in' });
    expect(aria(button(), 'aria-pressed')).toBe('true');
    expect(aria(button(), 'aria-label')).toBe('Remove from favorites');
    expect(fixture.nativeElement.textContent).toContain('Saved to favorites on this device.');

    await fixture.componentInstance.toggleFavorite();
    await settle(fixture);
    expect(JSON.parse(store.data.get('valryde.favorites.v1')!)).toEqual([]);
    expect(aria(button(), 'aria-label')).toBe('Save to favorites');
  });

  it('reports a storage failure without showing a false saved state', async () => {
    const store = fakePreferences();
    store.set.mockRejectedValueOnce(new Error('storage unavailable'));
    TestBed.configureTestingModule({ providers: [{ provide: FAVORITES_STORE, useValue: store }] });
    const fixture = TestBed.createComponent(RouteDetailComponent);
    fixture.componentRef.setInput('state', { status: 'ready', route: transitRoute() });
    fixture.autoDetectChanges();
    await settle(fixture);

    await fixture.componentInstance.toggleFavorite();
    await settle(fixture);
    expect(fixture.nativeElement.textContent).toContain('Couldn’t update favorites on this device');
    expect(aria(fixture.nativeElement.querySelectorAll('ion-buttons ion-button')[0], 'aria-label')).toBe(
      'Save to favorites',
    );
  });

  it('offers no favorite action while the route is loading or failed', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: FAVORITES_STORE, useValue: fakePreferences() }] });
    const fixture = TestBed.createComponent(RouteDetailComponent);
    fixture.componentRef.setInput('state', { status: 'loading' });
    fixture.autoDetectChanges();
    await settle(fixture);
    // Only the close button is offered.
    expect(fixture.nativeElement.querySelectorAll('ion-buttons ion-button')).toHaveLength(1);
  });
});
