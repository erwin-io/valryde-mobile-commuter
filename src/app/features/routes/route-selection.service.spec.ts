import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { RouteSelectionService } from './route-selection.service';
import { direction, transitRoute } from './test-fixtures';
import { TransitRoute, TransitRoutesService } from './transit-routes.service';

describe('RouteSelectionService', () => {
  let responses: Subject<TransitRoute>[];
  let selection: RouteSelectionService;
  const get = vi.fn();

  beforeEach(() => {
    responses = [];
    get.mockReset().mockImplementation(() => {
      const s = new Subject<TransitRoute>();
      responses.push(s);
      return s;
    });
    TestBed.configureTestingModule({
      providers: [RouteSelectionService, { provide: TransitRoutesService, useValue: { get } }],
    });
    selection = TestBed.inject(RouteSelectionService);
  });

  const twoWay = transitRoute({
    directions: [
      direction({ id: 'out', directionLabel: 'Outbound' }),
      direction({ id: 'in', directionLabel: 'Inbound', originName: 'IT Park', destinationName: 'Carbon Market' }),
    ],
  });

  it('loads the route, defaults to the first direction and builds a colored line', () => {
    selection.select('route-1', null);
    expect(selection.state()).toEqual({ status: 'loading' });
    responses[0].next(twoWay);

    expect(selection.direction()?.id).toBe('out');
    expect(selection.line()).toEqual({
      id: 'out',
      coordinates: twoWay.directions[0].geometry.coordinates,
      color: '#1E3A8A',
    });
  });

  it('switches direction without refetching, and falls back to the first for an unknown id', () => {
    selection.select('route-1', null);
    responses[0].next(twoWay);
    selection.select('route-1', 'in');
    expect(selection.direction()?.id).toBe('in');
    expect(get).toHaveBeenCalledOnce();
    selection.select('route-1', 'stale-id');
    expect(selection.direction()?.id).toBe('out');
  });

  it('reports no line for geometry the map must not draw', () => {
    selection.select('route-1', null);
    responses[0].next(
      transitRoute({ directions: [direction({ geometry: { type: 'LineString', coordinates: [[1, 2]] } })] }),
    );
    expect(selection.direction()).not.toBeNull();
    expect(selection.line()).toBeNull();
  });

  it('maps errors, retries the same route, and clears on deselect', () => {
    selection.select('route-1', null);
    responses[0].error(new HttpErrorResponse({ status: 404 }));
    expect(selection.state()).toEqual({ status: 'error', failure: { kind: 'not-found', requestId: undefined } });

    selection.retry();
    expect(get).toHaveBeenLastCalledWith('route-1');
    expect(selection.state()).toEqual({ status: 'loading' });

    selection.select(null, null);
    expect(selection.state()).toBeNull();
    expect(selection.line()).toBeNull();
  });

  it('ignores a slow response for a route the user already left', () => {
    selection.select('route-1', null);
    selection.select('route-2', null);
    responses[0].next(transitRoute({ id: 'route-1' }));
    expect(selection.state()).toEqual({ status: 'loading' });
  });
});
