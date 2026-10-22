import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { RoutesPage } from './routes.page';
import { transitRoute } from './test-fixtures';
import { TransitRoutePage, TransitRoutesService } from './transit-routes.service';

describe('RoutesPage', () => {
  let responses: Subject<TransitRoutePage>[];
  const list = vi.fn();

  const page = (routes = [transitRoute()], p = 1, totalPages = 1, total = routes.length): TransitRoutePage => ({
    routes,
    pagination: { page: p, pageSize: 20, total, totalPages },
  });

  async function setup() {
    responses = [];
    list.mockReset().mockImplementation(() => {
      const s = new Subject<TransitRoutePage>();
      responses.push(s);
      return s;
    });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: TransitRoutesService, useValue: { list } }],
    });
    const fixture = TestBed.createComponent(RoutesPage);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    return { fixture, page: fixture.componentInstance, text: () => fixture.nativeElement.textContent as string };
  }

  /** Lets promise chains (firstValueFrom, await) finish, then waits for change detection. */
  async function settle(fixture: { whenStable(): Promise<unknown> }) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  function respond(index: number, body: TransitRoutePage) {
    responses[index].next(body);
    responses[index].complete();
  }

  it('loads page 1 from the real list endpoint and renders route rows', async () => {
    const { fixture, text } = await setup();
    expect(list).toHaveBeenCalledWith({ q: '', page: 1, pageSize: 20 });
    respond(0, page());
    await settle(fixture);
    expect(text()).toContain('17B');
    expect(text()).toContain('Carbon – IT Park');
    expect(text()).toContain('Carbon Market – IT Park');
    expect(text()).toContain('1 route');
  });

  it('distinguishes "nothing published" from "no match for the query"', async () => {
    const { fixture, page: p, text } = await setup();
    respond(0, page([]));
    await settle(fixture);
    expect(text()).toContain('No routes published yet');

    p.query.set('Talamban');
    void p.load(true);
    respond(1, page([]));
    await settle(fixture);
    expect(text()).toContain('No routes match “Talamban”');
  });

  it('debounces typing and sends the trimmed query', async () => {
    vi.useFakeTimers();
    try {
      const { page: p } = await setup();
      p.search.setValue(' 17');
      p.search.setValue(' 17B ');
      vi.advanceTimersByTime(299);
      expect(list).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(1);
      expect(list).toHaveBeenLastCalledWith({ q: '17B', page: 1, pageSize: 20 });
      expect(list).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops a slower response for a superseded query', async () => {
    const { fixture, page: p, text } = await setup();
    p.query.set('17B');
    void p.load(true);
    expect(responses[0].observed).toBe(false);
    respond(1, page([transitRoute({ routeCode: '17B' })]));
    respond(0, page([transitRoute({ id: 'old', routeCode: '04L' })]));
    await settle(fixture);
    expect(text()).toContain('17B');
    expect(text()).not.toContain('04L');
  });

  it('shows a safe error with the support reference and recovers on retry', async () => {
    const { fixture, page: p, text } = await setup();
    responses[0].error(
      new HttpErrorResponse({ status: 503, error: { error: { code: 'X', message: 'pg down', requestId: 'req-9' } } }),
    );
    await settle(fixture);
    expect(text()).toContain('VALRYDE is temporarily unavailable');
    expect(text()).toContain('req-9');
    expect(text()).not.toContain('pg down');

    void p.load(true);
    respond(1, page());
    await settle(fixture);
    expect(text()).toContain('17B');
  });

  it('appends the next page and keeps rows when loading more fails', async () => {
    const { fixture, page: p, text } = await setup();
    respond(0, page([transitRoute()], 1, 2, 2));
    await settle(fixture);
    expect(p.hasMore()).toBe(true);

    void p.loadMore();
    expect(list).toHaveBeenLastCalledWith({ q: '', page: 2, pageSize: 20 });
    responses[1].error(new HttpErrorResponse({ status: 0 }));
    await settle(fixture);
    expect(text()).toContain('Couldn’t load more routes.');
    expect(text()).toContain('17B');

    void p.loadMore();
    respond(2, page([transitRoute({ id: 'route-2', routeCode: '62C' })], 2, 2, 2));
    await settle(fixture);
    expect(p.routes().map((r) => r.routeCode)).toEqual(['17B', '62C']);
    expect(p.hasMore()).toBe(false);
  });

  it('allows only one page request at a time and de-duplicates a shifted page boundary', async () => {
    const { fixture, page: p } = await setup();
    respond(0, page([transitRoute()], 1, 2, 2));
    await settle(fixture);

    const first = p.loadMore();
    const duplicate = p.loadMore();
    expect(list).toHaveBeenCalledTimes(2);
    respond(
      1,
      page(
        [
          transitRoute({ routeCode: '17B updated' }),
          transitRoute({ id: 'route-2', routeCode: '62C' }),
        ],
        2,
        2,
        2,
      ),
    );
    await Promise.all([first, duplicate]);
    await settle(fixture);

    expect(p.routes().map((route) => route.routeCode)).toEqual(['17B updated', '62C']);
    expect(p.loadingMore()).toBe(false);
  });

  it('cancels an unfinished request when the page is destroyed', async () => {
    const { fixture } = await setup();
    expect(responses[0].observed).toBe(true);
    fixture.destroy();
    expect(responses[0].observed).toBe(false);
  });

  it('opens a route on the map via a deep-linkable query parameter', async () => {
    const { page: p } = await setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    p.open(transitRoute());
    expect(navigate).toHaveBeenCalledWith(['/tabs/map'], { queryParams: { route: 'route-1' } });
  });
});
